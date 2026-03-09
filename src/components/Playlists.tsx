import type { ReactElement } from "react";
import DynamicPlaylist from "./DynamicPlaylist";

interface PlaylistsProps {
    playlists: Array<any & { _template?: string | null }>;
    section: any;
}

export default function Playlists({ playlists, section }: PlaylistsProps): ReactElement {
    return (
        <>
            {playlists.map((playlist) =>
                playlist._template ? (
                    <DynamicPlaylist
                        key={playlist.Id}
                        template={playlist._template}
                        playlist={playlist}
                        section={section}
                    />
                ) : (
                    <div
                        key={playlist.Id}
                        className="m-4 p-4 border border-dashed border-slate-300 rounded-lg text-sm text-slate-400 text-center"
                    >
                        No template for{" "}
                        <code className="font-mono text-xs">{playlist.RendererBundlePath}</code>
                    </div>
                )
            )}
        </>
    );
}