// api.ts — public read-only calls go to content_api via Expresia bundle backend.
// No token required — content_api is the public Content Delivery API.
// Uses multipart/form-data as required by the elementAjax endpoint.

function buildApiUrl(): string {
    const base = (process.env.DOMAIN_URL || "").replace(/\/$/, "");
    const apiBase = process.env.PUBLIC_API_BASE ?? "";
    return `${base}${apiBase}`;
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