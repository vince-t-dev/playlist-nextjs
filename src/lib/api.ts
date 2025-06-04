const BASE_API_URL = `${process.env.DOMAIN_URL}${process.env.PUBLIC_API_BASE}/ajax_handler`;

async function post<T>(
    action: string,
    params: Record<string, any> = {},
    queryParams: Record<string, string> = {}
): Promise<T> {
    const url = new URL(BASE_API_URL);

    for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.append(key, value);
    }

    const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
        // cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(`API error (${action}): ${res.statusText}`);
    }

    return res.json();
}

export const getSitemap = (query?: Record<string, string>) =>
    post<any>("getSitemap", {}, query);

export const getPlaylists = (slug?: object, query?: Record<string, string>) =>
    post<any[]>("getPlaylists", slug ? slug : {}, query);

export const getPlaylistsBySection = (section: string, query?: Record<string, string>) =>
    post<any[]>("getPlaylistsBySection", { section }, query);
