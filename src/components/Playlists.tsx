import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';

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

export default function Playlists({
    playlists,
    section,
}: PlaylistsProps): ReactElement {
    const playlistEntries = playlists.map((p) => {
        // 1. strip off everything before ":playlist-astro/element/" so that `key` becomes e.g. "playlist_1".
        const key = p.RendererBundlePath.replace(/^.*:playlist-astro\/element\//, '');

        // 2. dynamically import the file under src/components/playlists/<key>.tsx
        const Component = dynamic(() => import(`@/components/playlists/${key}`));

        // 3. pass down all fields of p, plus the `section` object to each component.
        return {
            key,
            Component,
            props: {
                ...p,
                section,
            },
        };
    });

    return (
        <>
            {playlistEntries.map(({ key, Component, props }) => (
                <Component key={key} {...props} />
            ))}
        </>
    );
}
