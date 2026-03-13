// ──────────────────────────────────────────────────────────────────────
// DynamicPage.tsx
// Evaluates a TSX page-template string from Expresia at runtime using
// Sucrase, renders it as a React component with playlists/sitemap/section
// injected as props.
//
// Now uses the same require() shim as DynamicPlaylist — page templates
// can write normal import statements and they resolve from the built-in
// registry or esm.sh CDN.
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, type ComponentType } from "react";
import Playlists from "@/components/Playlists";
import Navbar from "@/components/Navbar";
import {
    preloadModules,
    createRequire,
    registerModule,
} from "@/lib/templateRequire";

// Register page-level components so templates can import them:
//   import Playlists from "@/components/Playlists";
//   import Navbar from "@/components/Navbar";
registerModule("@/components/Playlists", { default: Playlists, Playlists });
registerModule("@/components/Navbar", { default: Navbar, Navbar });

interface DynamicPageProps {
    template: string;
    playlists: any[];
    sitemap: any;
    section: any;
}

function prepareSource(source: string): string {
    return source
        .replace(/^[\s]*["']use client["'];?\s*\n?/m, "")
        .replace(/^[\s]*["']use server["'];?\s*\n?/m, "");
}

async function compilePage(
    source: string,
    globals: Record<string, any>,
): Promise<ComponentType<any> | null> {
    try {
        // Register all globals as importable modules too
        for (const [key, val] of Object.entries(globals)) {
            registerModule(key, typeof val === "function" ? { default: val, [key]: val } : val);
        }

        // Preload CDN deps
        await preloadModules(source);

        // Transpile
        const { transform } = await import("sucrase");
        const cleaned = prepareSource(source);
        const { code } = transform(cleaned, {
            transforms: ["typescript", "jsx", "imports"],
            jsxRuntime: "classic",
            production: true,
        });

        // Execute — inject page-level components as direct globals for
        // backward compatibility with templates that use them without imports.
        const globalNames = Object.keys(globals);
        const templateRequire = createRequire();

        const factory = new Function(
            "require", "React", ...globalNames,
            `"use strict";
       var exports = {};
       var module = { exports: exports };
       ${code}
       if (module.exports.default) return module.exports.default;
       if (typeof PageTemplate !== "undefined") return PageTemplate;
       return module.exports;`
        );

        const result = factory(templateRequire, React, ...globalNames.map(k => globals[k]));
        return typeof result === "function" ? result : null;
    } catch (err) {
        console.error("[DynamicPage] template compile error:", err);
        return null;
    }
}

export default function DynamicPage({
    template,
    playlists,
    sitemap,
    section,
}: DynamicPageProps) {
    const [PageComponent, setPageComponent] = useState<ComponentType<any> | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // PlaylistsRenderer: zero-prop drop-in that closes over current data.
        const PlaylistsRenderer = () => (
            <Playlists playlists={playlists} section={section} />
        );

        // Pass as named globals — old templates use these as bare identifiers
        // (e.g. <Playlists ... />). New templates can also import them.
        compilePage(template, {
            Playlists,
            Navbar,
            PlaylistsRenderer,
        }).then((comp) => {
            if (comp) setPageComponent(() => comp);
            setReady(true);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template]);

    if (!ready) return null;

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