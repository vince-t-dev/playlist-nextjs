import dynamic from "next/dynamic";
import type { ReactElement, ComponentType } from "react";
import { useMemo } from "react";

export interface PlaylistFromAPI {
    RendererBundlePath: string;
    [key: string]: any;
}

export interface SectionFromAPI {
    Slug: string;
    Name: string;
    [key: string]: any;
}

interface PlaylistsProps {
    playlists: PlaylistFromAPI[];
    section: SectionFromAPI;
}

// fallback component when the actual one can't be imported
const MissingComponent = () => (
    <div className="p-4 border rounded bg-red-100 text-red-600">
        ⚠️ Playlist component not found or failed to load.
    </div>
);

export default function Playlists({
    playlists,
    section,
}: PlaylistsProps): ReactElement {
    const playlistEntries = useMemo(() => {
        return playlists.map((p) => {
            const key = p.RendererBundlePath.replace(
                /^.*:playlist-nextjs\/element\//,
                ""
            );
            let Component: ComponentType<any> = MissingComponent;
            try {
                Component = dynamic(() =>
                    import(`@/components/playlists/${key}`)
                        .then((mod) => mod.default)
                        .catch((err) => {
                            console.warn(
                                `⚠️ Failed to import playlist: ${key}`,
                                err.message
                            );
                            return MissingComponent;
                        })
                );
            } catch (e) {
                console.warn(`⚠️ Error in dynamic import for key ${key}`, e);
                Component = MissingComponent;
            }

            return {
                key,
                Component,
                props: {
                    playlist: p,
                    section,
                },
            };
        });
    }, [playlists, section]);

    return (
        <>
            {playlistEntries.map(({ key, Component, props }) => (
                <Component key={key} {...props} />
            ))}
        </>
    );
}