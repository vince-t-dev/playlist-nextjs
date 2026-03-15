// actions/index.js
// Every case from /content_api.js, ported to async/await.
// Each handler receives (body, instanceToken) and returns a plain object.

const { xprApi, fetchBundle, xprWww } = require("../expresiaClient");
const crypto = require("crypto");

// Lazily required so the module loads even if @tailwindcss/node isn't installed yet
let _compile = null;
async function getTailwindCompile() {
    if (!_compile) _compile = (await require("@tailwindcss/node")).compile;
    return _compile;
}

// In-memory cache: sha256(cssText) → compiled CSS string
const cssCache = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanJSON(obj) {
    if (Array.isArray(obj)) {
        return obj.map(cleanJSON).filter((el) => el !== null);
    }
    if (typeof obj === "object" && obj !== null) {
        const out = {};
        for (const key of Object.keys(obj)) {
            if (key === "_links") continue;
            const value = cleanJSON(obj[key]);
            if (value !== null && value !== "") out[key] = value;
        }
        return Object.keys(out).length > 0 ? out : null;
    }
    return obj;
}

function endsWithSlash(url) {
    return url.split("?")[0].endsWith("/");
}

function findSchemaForBundle(bundlePath, schemas) {
    return schemas.find((s) => s._bundlePath === bundlePath) ?? null;
}

function formatPlaylistData(data, schema) {
    if (!data || typeof data !== "object" || !schema) return data;
    const result = Array.isArray(data) ? [] : {};
    for (const key of Object.keys(schema)) {
        if (["String", "Long string", "Date string"].includes(schema[key])) {
            result[key] = data[key];
        } else if (["Image", "Video"].includes(schema[key])) {
            const img = data[key];
            result[key] = img
                ? { Id: img.Id, Name: img.Name, FilePath: img.FilePath, SourcePath: img.SourcePath }
                : null;
        } else if (typeof schema[key] === "object") {
            result[key] = formatPlaylistData(data[key], schema[key]);
        }
    }
    return result;
}

function transformPlaylistData(playlistData, playlistsSchema) {
    const selectedSchema = findSchemaForBundle(playlistData.RendererBundlePath, playlistsSchema);
    if (!selectedSchema) {
        console.error(`[actions] Schema not found for bundlePath: ${playlistData.RendererBundlePath}`);
        return null;
    }
    const out = { ...playlistData };
    delete out._embedded;
    const contentSchema = selectedSchema._playlistSchema?.playlist_content ?? {};
    Object.assign(out, formatPlaylistData(playlistData, contentSchema));
    if (playlistData._embedded?.PlaylistItems) {
        const itemsSchema = selectedSchema._playlistSchema?.playlist_items;
        out._embedded = {
            PlaylistItems: playlistData._embedded.PlaylistItems.map((item) => {
                const article = item._embedded?.Article ?? {};
                return {
                    Id: item.Id,
                    _embedded: {
                        Article: {
                            Id: article.Id,
                            ...formatPlaylistData(article, itemsSchema),
                        },
                    },
                };
            }),
        };
    }
    return out;
}

async function getPlaylistsMetaData(token) {
    const raw = await xprApi({
        uri: "/bundleEntities/",
        params: { Path__eq: "PlaylistsMetaData", with: "TextContentObject" },
        token,
    });
    if (!raw.Total) return [];
    return raw._embedded.BundleEntity.flatMap((entity) =>
        JSON.parse(entity._embedded.TextContentObject.Text)
    );
}

async function mapPlaylistDataToSchema(playlistData, elementId, token) {
    const playlistsSchema = await getPlaylistsMetaData(token);
    const playlistSchema = findSchemaForBundle(playlistData.RendererBundlePath, playlistsSchema);

    let datasourceArticles = [];
    if (playlistSchema?.datasources) {
        datasourceArticles = await Promise.all(
            playlistSchema.datasources.map(async (ds) => {
                try {
                    // get_boson_context equivalent — fetch the boson entity context
                    const boson = await xprApi({
                        uri: `/bosons/${elementId}`,
                        params: { with: "BundleEntities" },
                        token,
                    });
                    const context = boson?._context?.[ds.Name] ?? {};
                    return cleanJSON(context);
                } catch {
                    return {};
                }
            })
        );
    }

    return {
        playlist_schema: playlistSchema,
        playlist_data_schema: {
            ...transformPlaylistData(playlistData, playlistsSchema),
            datasource_articles: datasourceArticles,
        },
    };
}

// ── Action handlers ───────────────────────────────────────────────────────────

async function login(body) {
    const authRes = await xprApi({
        uri: "/auth/admin/login",
        method: "POST",
        data: {
            UserLogin: body.UserLogin,
            UserPassword: body.UserPassword,
            TwoFactorCode: body.TwoFactorCode,
            UserType: "token",
        },
    });

    const users = await xprApi({
        uri: "/users/",
        params: { _noUnhydrated: 1, with: "CustomFields", Username__eq: body.UserLogin },
    });

    const u = users[0];
    const profileImage = u._embedded?.CustomFields?._embedded?.ProfileImage ?? {};

    return {
        ...authRes,
        user: {
            Id: u.Id,
            FirstName: u.FirstName,
            LastName: u.LastName,
            Username: u.Username,
            City: u.City,
            ActiveFrontendBranch: u.ActiveFrontendBranch,
            ActiveDevelopmentBranch: u.ActiveDevelopmentBranch,
            _embedded: { CustomFields: { _embedded: { ProfileImage: profileImage } } },
        },
    };
}

async function logout(authToken) {
    const tokens = await xprApi({
        uri: "/auth/tokens/",
        params: { Token__eq: authToken },
    });
    await xprApi({ uri: `/auth/tokens/${tokens[0].Id}`, method: "DELETE" });
    return xprApi({ uri: "/auth/admin/logout" });
}

async function resetPassword(body) {
    return xprApi({
        uri: "/auth/admin/login",
        method: "POST",
        data: { UserLogin: body.UserLogin, action: "reset" },
    });
}

async function setPassword(body) {
    const tokens = await xprApi({
        uri: "/auth/tokens/",
        params: { Type__eq: "password-reset", Token__eq: body.token, per_page: 1, with: "User" },
    });
    if (!tokens.length) return { error: true, message: "Invalid Token" };

    const token = tokens[0];
    await xprApi({ uri: `/users/${token._embedded.User.Id}`, method: "PUT", data: { Password: body.UserPassword } });
    await xprApi({ uri: `/auth/tokens/${token.Id}`, method: "DELETE" });
    return { message: "Success" };
}

async function checkAuth(authToken) {
    // Validate the bearer token against Expresia
    try {
        const res = await xprApi({ uri: "/auth/tokens/", params: { Token__eq: authToken } });
        if (!res.length) return { error: true, message: "Invalid token" };
        return { authenticated: true, token: res[0] };
    } catch {
        return { error: true, message: "Auth check failed" };
    }
}

async function getSitemap(token) {
    return xprApi({
        uri: "/sections/7",
        params: {
            Invisible__eq: false,
            related_Children_Invisible__eq: false,
            Status__eq: 1,
            related_Children_Status__eq: 1,
            with: "Children(Children),CustomFields,Categories",
            order_fields: "SortOrder",
            order_dirs: "ASC",
            order_Section_Children_fields: "SortOrder",
            order_Section_Children_dirs: "ASC",
            max_depth: 5,
        },
        token,
    });
}

async function getPlaylists(body, token) {
    const params = {
        with: "CustomFields,PlaylistItems(Article(Categories,CustomFields,Language,Picture))",
        order_field: "SortOrder",
        order_Playlist_PlaylistItems_fields: "SortOrder",
        order_dir: "asc",
        Locale__eq: "en_CA",
        per_page: "all",
    };
    if (body.slug) params.related_Section_Slug__eq = body.slug;
    else params.related_Section_Id__eq = 7;

    const playlists = await xprApi({ uri: "/playlists/", params, token });

    // Filter out inactive articles + attach Boson templates in parallel
    const filtered = (playlists ?? []).map((playlist) => {
        if (playlist._embedded?.PlaylistItems) {
            playlist._embedded.PlaylistItems = playlist._embedded.PlaylistItems.map((item) => {
                if (!item._embedded?.Article?.Active) item._embedded = { Article: {} };
                return item;
            });
        }
        return playlist;
    });

    return Promise.all(
        filtered.map(async (p) => ({
            ...p,
            _template: p.RendererBundlePath
                ? await fetchBundle(p.RendererBundlePath)
                : null,
        }))
    );
}

async function getPlaylist(body, token) {
    const params = body.hydrated
        ? { with: "PlaylistItems(Article(Picture,CustomFields)),CustomFields", _noUnhydrated: 1 }
        : { with: "PlaylistItems(Article)" };

    const raw = await xprApi({ uri: `/playlists/${body.playlistId}`, params, token });
    const cleaned = cleanJSON(raw);

    if (cleaned._embedded?.PlaylistItems) {
        cleaned._embedded.PlaylistItems = cleaned._embedded.PlaylistItems.sort(
            (a, b) => a.SortOrder - b.SortOrder
        );
    }

    if (body.hydrated) return mapPlaylistDataToSchema(cleaned, body.elementId, token);
    return cleaned;
}

async function getAIPlaylists(token) {
    const [bosons, customFields, metaRaw] = await Promise.all([
        xprApi({
            uri: "/bosons/",
            params: {
                with: "ModuleContentTypeDefinition(TagDefinition(ListOptions))",
                per_page: "all",
                Template__like: "%data-fee-%",
                Name__like: "%master%",
                IsModule__eq: 1,
                _noUnhydrated: 1,
            },
            token,
        }),
        xprApi({
            uri: "/customFields/definitions/",
            params: { _noUnhydrated: 1, with: "ListOptions,ForeignKeyType", per_page: "all" },
            token,
        }),
        xprApi({
            uri: "/bundleEntities/",
            params: { Path__eq: "PlaylistsMetaData", with: "TextContentObject" },
            token,
        }),
    ]);

    const allMeta = metaRaw.Total > 0
        ? metaRaw._embedded.BundleEntity.flatMap((e) => JSON.parse(e._embedded.TextContentObject.Text))
        : [];

    const tagDefinitions = [];
    if (bosons.Total > 0) {
        for (const meta of allMeta) {
            const boson = bosons._embedded.Boson.find((b) => b._bundlePath === meta._bundlePath);
            if (boson) {
                meta.Id = boson.Id;
                if (boson._embedded?.ModuleContentTypeDefinition) {
                    tagDefinitions.push({
                        Id: boson.Id,
                        _embedded: { ModuleContentTypeDefinition: boson._embedded.ModuleContentTypeDefinition },
                    });
                }
            }
        }
    }

    return {
        playlists: allMeta,
        customfields: customFields.Total > 0 ? customFields._embedded.CustomFieldDefinition : [],
        tag_definitions: tagDefinitions,
    };
}

async function updatePlaylistData(body, token) {
    // Normalise embedded images for products / variants
    if (body.uri === "/store/products/" && body._embedded?.ProductImages) {
        body._embedded.ProductImages = body._embedded.ProductImages.map((img) => ({
            ...img,
            _embedded: img._embedded ?? { File: { Id: img.Id } },
        }));
    }
    if (body.uri === "/store/productVariants/" && body._embedded?.Images) {
        body._embedded.Images = body._embedded.Images.map((img) => ({
            ...img,
            _embedded: img._embedded ?? { File: { Id: img.Id } },
        }));
    }

    const updated = await xprApi({ uri: `${body.uri}${body.Id}`, method: "PUT", data: body.data, token });

    const bundleInfo = body.bundlePath
        ? { RendererBundlePath: body.bundlePath }
        : await xprApi({ uri: `/playlists/${body.playlistId}`, params: { select_fields: "RendererBundlePath" }, token });

    return { ...updated, _bundle: bundleInfo };
}

async function getImages(body, token) {
    const page = parseInt(body.page ?? 1);
    const perPage = 40;
    const params = {
        page,
        per_page: perPage,
        order_dir: "desc",
        order_field: "DateUploaded",
        with: "CNode,CustomFields,Categories",
        select_fields: "Id,Name,Type",
    };
    if (body.type) params.Type__like = body.type;
    if (body.q) params.q = body.q;

    const imageList = await xprApi({ uri: "/files/", params, token });
    if (!imageList.Total) return { error: "fetch image failed", imageList: false };

    const files = imageList._embedded.File.map((f) => ({ ...f, Id: Number(f.Id) }));
    return {
        data: "success",
        imageList: files,
        totalItems: imageList.Total,
        totalPages: Math.ceil(imageList.Total / perPage),
        type: body.type ?? "",
    };
}

async function uploadFile(body, token) {
    const match = body.base64_file.match(/^data:(.+);base64,/);
    const base64 = body.base64_file.replace(
        /^data:(image\/(png|jpg|jpeg|webp|svg\+xml)|video\/mp4|application\/(pdf|octet-stream));base64,/,
        ""
    );
    const ext = match[1].split("/")[1];
    const name = body.file_name ?? `xpr-ai-${Math.random().toString(36).slice(2, 12)}.${ext}`;

    return xprApi({
        uri: "/files/",
        method: "POST",
        data: { Name: name, Type: match[1], Description: "AI generated file", Payload: base64, Encoding: "base64" },
        token,
    });
}

async function updateSortOrder(body, token) {
    const orders = JSON.parse(body.data);
    const results = await Promise.allSettled(
        orders.map((obj) =>
            xprApi({ uri: `${body.uri}${obj.Id}`, method: "PATCH", data: { SortOrder: obj.SortOrder }, token })
        )
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) console.error(`[actions] updateSortOrder: ${failed.length} failures`);
    return { updated: results.length - failed.length, failed: failed.length };
}

async function getEditCodeURL(body, token) {
    const boson = await xprApi({ uri: `/bosons/${body.Id}`, params: { with: "BundleEntities" }, token });
    const entity = boson._embedded.BundleEntities[0];
    return { url: `/xpr/bundles/edit/${entity.BundleId}/${entity.Id}` };
}

async function showIntro() {
    return xprWww(`https://www.expresia.com/elementAjax/Osad/FEE Intro`);
}

async function getProducer() {
    const res = await xprWww(
        `https://www.expresia.com/api/custom/ProducerProfile/?Published__eq=1&order_field=SortOrder&order_dir=ASC`
    );
    if (!res.Total) return null;
    const items = res._embedded.Custom_ProducerProfile;
    return items[Math.floor(Math.random() * items.length)];
}

async function getCurrentPage(body, token) {
    let response = {};
    const domainUrl = process.env.DOMAIN_URL?.replace(/\/$/, "") ?? "";

    if (body.url && body.url !== "/") {
        const fullUrl = body.url.startsWith("http") ? body.url : `${domainUrl}${body.url}`;
        const isSection = endsWithSlash(body.url);
        const lookup = await xprApi({
            uri: "/routingUrl/lookup",
            params: { url: fullUrl, with: isSection ? "Section" : "Section,Article" },
            token,
        });
        if (lookup._embedded?.Article) response = { ...lookup._embedded.Article, LanguageId: lookup.LanguageId };
        else if (lookup._embedded?.Section) response = { ...lookup._embedded.Section, LanguageId: lookup.LanguageId };
    }

    if (!body.url || body.url === "/") {
        const sections = await xprApi({
            uri: "/sections/",
            params: { Type__eq: "domain", with: "DomainLanguages" },
            token,
        });
        response = {
            ...sections[0],
            LanguageId: sections[0]._embedded.DomainLanguages[0]._embedded.Language.Id,
        };
    }

    // Sample images
    let sampleImagesArray = [];
    try {
        const bundles = await xprApi({ uri: "/bundles/", params: { Name__eq: "FEE" }, token });
        const config = JSON.parse(bundles[0].Configuration);
        sampleImagesArray = [config.PlaceholderImage1, config.PlaceholderImage2, config.PlaceholderImage3].filter(Boolean);
    } catch { /* backward-compat: ignore if not present */ }

    const sampleImages = await xprApi({
        uri: "/files/",
        params: {
            Name__in: sampleImagesArray.length > 0 ? sampleImagesArray.join(",") : body.sampleImages,
            select_fields: "Id,Name",
        },
        token,
    });

    return { ...response, SampleImages: sampleImages };
}

async function getJsonDocument(body, token) {
    return xprApi({ uri: "/jsonDocument/", params: body.params, token });
}

// getData / postData / putData / deleteData — generic pass-through (auth-gated)
async function genericCrud(method, body, token) {
    return xprApi({ uri: body.uri, method, data: body.data, params: body.params, token });
}

async function checkCustomerPrivilege(token) {
    // Mirrors library.checkCustomerPrivilege() — validate domain-level privilege
    try {
        const res = await xprApi({ uri: "/auth/tokens/", params: { per_page: 1 }, token });
        return { privileged: res.Total > 0 };
    } catch {
        return { privileged: false };
    }
}

const fs = require("fs");
const path = require("path");

async function compileCss(body) {
    const cssText = body.cssText ?? "";
    const hash = crypto.createHash("sha256").update(cssText).digest("hex");

    if (cssCache.has(hash)) {
        return { css: cssCache.get(hash) };
    }

    // Use the lower-level tailwindcss compile directly — it accepts raw CSS
    // strings without needing the file-system resolver that @tailwindcss/node
    // wraps around it. We skip @import "tailwindcss" and instead feed the
    // pre-resolved Tailwind base CSS + the CMS custom CSS.
    const twPkg = require.resolve("tailwindcss", {
        paths: [path.resolve(__dirname, "../..")]
    });
    const { compile } = require(twPkg.replace(/\/package\.json$/, ""));

    // Extract every potential class token from the raw CMS text.
    const candidates = [...cssText.matchAll(/[^\s"'`<>{}]+/g)].map(m => m[0]);

    // Compile: just the CMS custom CSS (Tailwind utilities are generated
    // from candidates via compiler.build).
    const input = `@import "tailwindcss";\n${cssText}`;

    // Write to a temp file in the project root so the resolver can find
    // node_modules/tailwindcss from there.
    const projectBase = path.resolve(__dirname, "../..");
    const tmpFile = path.join(projectBase, `.tw-tmp-${hash.slice(0, 12)}.css`);
    fs.writeFileSync(tmpFile, input);

    try {
        const twNode = require("@tailwindcss/node");
        const compiler = await twNode.compile(fs.readFileSync(tmpFile, "utf-8"), {
            base: projectBase,
            onDependency: () => { },
        });
        const css = compiler.build(candidates);

        cssCache.set(hash, css);
        console.log(`[compileCss] done — ${css.length} chars, cache size ${cssCache.size}`);
        return { css };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch { }
    }
}

module.exports = {
    login, logout, resetPassword, setPassword, checkAuth, checkCustomerPrivilege,
    getSitemap, getPlaylists, getPlaylist, getAIPlaylists, getPlaylistsMetaData,
    updatePlaylistData, updateSortOrder,
    getImages, uploadFile,
    getEditCodeURL, showIntro, getProducer,
    getCurrentPage, getJsonDocument,
    genericCrud,
    compileCss,
};