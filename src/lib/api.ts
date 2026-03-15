// api.ts — public read-only calls go to content_api via Expresia bundle backend.
// No token required — content_api is the public Content Delivery API.
// Uses multipart/form-data as required by the elementAjax endpoint.

function buildApiUrl(): string {
    const base = (process.env.DOMAIN_URL || "").replace(/\/$/, "");
    const apiBase = process.env.PUBLIC_API_BASE ?? "";
    return `${base}${apiBase}`;
}

// Internal expresia-api base URL — only reachable server-side (Docker network).
function buildInternalApiUrl(): string {
    return (process.env.INTERNAL_API_URL || "http://api:3001").replace(/\/$/, "");
}

async function post<T>(
    action: string,
    jsonData: Record<string, any> = {},
): Promise<T> {
    const form = new FormData();
    form.append("action", action);
    form.append("XPR_PostbackAction", "ContentAPI/content_api");
    form.append("jsonData", JSON.stringify(jsonData));

    const res = await fetch(buildApiUrl(), {
        method: "POST",
        body: form,
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`API error (${action}): ${res.statusText}`);
    }

    return res.json();
}

export const getSitemap = () =>
    post<any>("getSitemap");

export const getPlaylists = (slug?: object) =>
    post<any[]>("getPlaylists", slug ?? {});

export const getPlaylistsBySection = (section: string) =>
    post<any[]>("getPlaylistsBySection", { section });

// Fetches raw CSS text from Expresia (bundleEntities → TextContentObject),
// then sends it to the expresia-api compileCss action for Tailwind compilation.
// Call this server-side only (getServerSideProps / _document getInitialProps).
export async function getCmsCompiledCss(path: string = "css/global"): Promise<string> {
    // 1. Fetch the raw CMS CSS text via the Expresia content API
    const form = new FormData();
    form.append("action", "getCssText");
    form.append("XPR_PostbackAction", "ContentAPI/content_api");
    form.append("jsonData", JSON.stringify({ path }));

    const fetchRes = await fetch(buildApiUrl(), { method: "POST", body: form, cache: "no-store" });
    if (!fetchRes.ok) return "";

    const { cssText } = await fetchRes.json();
    if (!cssText) return "";

    // 2. Compile via the expresia-api container (server-side only)
    const compileRes = await fetch(`${buildInternalApiUrl()}/content_api`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compileCss", cssText }),
        cache: "no-store",
    });
    if (!compileRes.ok) {
        console.error('[getCmsCompiledCss] compile failed:', await compileRes.text());
        return "";
    }

    const { css } = await compileRes.json();
    return css ?? "";
}