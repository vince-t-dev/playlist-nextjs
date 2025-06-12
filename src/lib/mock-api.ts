type MockResponse = Record<string, any>;

const mockData: Record<string, MockResponse> = {
    getSitemap: {
        _embedded: {
            Children: [
                { Id: 6352, Slug: "/", Name: "Home" },
                { Id: 2142, Slug: "about", Name: "About" },
            ]
        }
    },
    getPlaylists: [
        { Id: 2867, Name: "Chill Vibes", RendererBundlePath: ":playlist-nextjs/element/next_playlist_b" },
        { Id: 8463, Name: "Top Hits", RendererBundlePath: ":playlist-nextjs/element/next_playlist_a" },
        { Id: 5252, Name: "Contact", RendererBundlePath: ":playlist-nextjs/element/next_playlist_c" },
    ],
    getPlaylistsBySection: {
        about: [
            { Id: 7422, Name: "Hot Now", RendererBundlePath: ":playlist-nextjs/element/next_playlist_a" },
            { Id: 9141, Name: "Editor's Picks", RendererBundlePath: ":playlist-nextjs/element/next_playlist_c" },
        ],
    },
};

async function post<T>(
    action: string,
    params: Record<string, any> = {},
    queryParams: Record<string, string> = {}
): Promise<T> {
    console.log(`Mock API Call -> Action: ${action}, Params:`, params, 'Query:', queryParams);

    // Simulate network delay
    await new Promise(res => setTimeout(res, 100));

    // Return mock data based on action and params
    if (action === "getPlaylistsBySection" && params.section) {
        return (mockData.getPlaylistsBySection[params.section] || []) as T;
    }

    const response = mockData[action];
    if (!response) {
        throw new Error(`No mock data available for action: ${action}`);
    }

    return response as T;
}

export const getSitemap = (query?: Record<string, string>) =>
    post<any>("getSitemap", {}, query);

export const getPlaylists = (slug?: object, query?: Record<string, string>) =>
    post<any[]>("getPlaylists", slug ? slug : {}, query);

export const getPlaylistsBySection = (section: string, query?: Record<string, string>) =>
    post<any[]>("getPlaylistsBySection", { section }, query);
