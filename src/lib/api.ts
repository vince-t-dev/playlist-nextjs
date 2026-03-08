// api.ts — public read-only calls go directly to content_api on the Expresia instance.
// No token required — content_api is the public Content Delivery API.

function buildApiUrl(): string {
    const base = (process.env.DOMAIN_URL || "").replace(/\/$/, "");
    const apiBase = process.env.PUBLIC_API_BASE ?? "";
    return `${base}${apiBase}/content_api`;
}

async function post<T>(
    action: string,
    params: Record<string, any> = {},
): Promise<T> {
    const res = await fetch(buildApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`API error (${action}): ${res.statusText}`);
    }

    return res.json();
}

export const getSitemap = () =>
    post<any>("getSitemap");

export const getPlaylistsBySection = (section: string) =>
    post<any[]>("getPlaylistsBySection", { section });

export const getPlaylists = (slug?: object) =>
    post<any[]>("getPlaylists", slug ?? {});