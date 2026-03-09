// components/DynamicPage.tsx
// Evaluates a TSX template string from Expresia at runtime using Sucrase,
// renders it as a React component with playlists/sitemap/section injected as props.

import React, { useMemo } from "react";
import { transform } from "sucrase";
import Playlists from "@/components/Playlists";
import Navbar from "@/components/Navbar";

// Registry of components available inside page templates.
// Add any component here that template authors should be able to use.
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
    Playlists,
    Navbar,
};

interface DynamicPageProps {
    template: string;         // TSX string from Expresia Boson
    playlists: any[];
    sitemap: any;
    section: any;
}

export default function DynamicPage({ template, playlists, sitemap, section }: DynamicPageProps) {
    const PageComponent = useMemo(() => {
        try {
            // 1. Transpile TSX → JS using Sucrase (same as playlist templates)
            const { code } = transform(template, {
                transforms: ["typescript", "jsx"],
                jsxPragma: "React.createElement",
                jsxFragmentPragma: "React.Fragment",
                production: true,
            });

            // 2. Wrap in a factory function that receives React + component registry
            //    Template must export (or declare) a default function named PageTemplate.
            const factory = new Function(
                "React",
                "components",
                `
                const { ${Object.keys(COMPONENT_REGISTRY).join(", ")} } = components;
                ${code}
                return typeof PageTemplate !== "undefined" ? PageTemplate : null;
                `
            );

            const Component = factory(React, COMPONENT_REGISTRY);
            return Component ?? null;
        } catch (err) {
            console.error("[DynamicPage] template compile error:", err);
            return null;
        }
    }, [template]);

    if (!PageComponent) {
        // Fallback: render playlists directly if template fails
        return <Playlists playlists={playlists} section={section} />;
    }

    return <PageComponent playlists={playlists} sitemap={sitemap} section={section} />;
}
