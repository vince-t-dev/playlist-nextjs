// components/DynamicPage.tsx
// Evaluates a TSX template string from Expresia at runtime using Sucrase,
// renders it as a React component with playlists/sitemap/section injected as props.

import React, { useMemo } from "react";
import { transform } from "sucrase";
import Playlists from "@/components/Playlists";
import Navbar from "@/components/Navbar";

const STATIC_REGISTRY: Record<string, React.ComponentType<any>> = {
    Playlists,
    Navbar,
};

interface DynamicPageProps {
    template: string;
    playlists: any[];
    sitemap: any;
    section: any;
}

export default function DynamicPage({ template, playlists, sitemap, section }: DynamicPageProps) {
    // PlaylistsRenderer closes over the current playlists + section values.
    // Templates can use it as a zero-prop drop-in: <PlaylistsRenderer />
    // or use <Playlists playlists={playlists} section={section} /> for full control.
    const PlaylistsRenderer = () => <Playlists playlists={playlists} section={section} />;

    const registry = { ...STATIC_REGISTRY, PlaylistsRenderer };

    const PageComponent = useMemo(() => {
        try {
            const { code } = transform(template, {
                transforms: ["typescript", "jsx"],
                jsxPragma: "React.createElement",
                jsxFragmentPragma: "React.Fragment",
                production: true,
            });

            const factory = new Function(
                "React",
                "components",
                `
                const { ${Object.keys(registry).join(", ")} } = components;
                ${code}
                return typeof PageTemplate !== "undefined" ? PageTemplate : null;
                `
            );

            return factory(React, registry) ?? null;
        } catch (err) {
            console.error("[DynamicPage] template compile error:", err);
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template]);

    if (!PageComponent) {
        return <Playlists playlists={playlists} section={section} />;
    }

    return (
        <PageComponent
            playlists={playlists}
            sitemap={sitemap}
            section={section}
        />
    );
}