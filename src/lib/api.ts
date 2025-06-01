const API_URL = `${process.env.DOMAIN_URL}${process.env.PUBLIC_API_BASE}/ajax_handler`;

async function post<T>(action: string, params = {}): Promise<T> {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
        cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(`API error (${action}): ${res.statusText}`);
    }
    return res.json();
}

export const getSitemap = () => post<any>("getSitemap");
export const getPlaylists = (slug?: string) => post<any[]>("getPlaylists", slug ? { slug } : {});
export const getPlaylistsBySection = (section: string) => post<any[]>("getPlaylistsBySection", { section });