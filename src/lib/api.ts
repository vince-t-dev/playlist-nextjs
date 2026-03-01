// api.ts — all calls go through ajax_handler on the Expresia instance.
// domain and token are passed per-request (from getServerSideProps context),
// so a single Next.js deployment can serve multiple Expresia instances.

function buildApiUrl(domain: string): string {
    const base = domain.replace(/\/$/, "");
    const apiBase = process.env.PUBLIC_API_BASE ?? "";
    return `${base}${apiBase}/ajax_handler`;
}

async function post<T>(
    domain: string,
    token: string,
    action: string,
    params: Record<string, any> = {},
    queryParams: Record<string, string> = {}
): Promise<T> {
    const url = new URL(buildApiUrl(domain));
    for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.append(key, value);
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    // Use the per-instance token, not the admin Expresia token
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ action, ...params }),
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`API error (${action}): ${res.statusText}`);
    }

    return res.json();
}

export const getSitemap = (domain: string, token: string, query?: Record<string, string>) =>
    post<any>(domain, token, "getSitemap", {}, query);

export const getPlaylists = (domain: string, token: string, slug?: object, query?: Record<string, string>) =>
    post<any[]>(domain, token, "getPlaylists", slug ?? {}, query);

export const getPlaylistsBySection = (domain: string, token: string, section: string, query?: Record<string, string>) =>
    post<any[]>(domain, token, "getPlaylistsBySection", { section }, query);