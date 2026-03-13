"use client";
// ──────────────────────────────────────────────────────────────────────
// DynamicPlaylist.tsx
// Receives a Boson.Template (.tsx string) as a prop, compiles it with
// Sucrase at runtime, and renders it as a React component.
//
// Template authors can now write standard import statements:
//
//   import { motion } from "framer-motion";
//   import confetti from "canvas-confetti";
//   import { Button } from "@/components/ui/button";
//
// Built-in modules (React, hooks, UI components) resolve instantly.
// npm packages are fetched from esm.sh on first use and cached.
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, type ComponentType } from "react";
import { preloadModules, createRequire } from "@/lib/templateRequire";

interface Props {
  template: string;
  playlist: any;
  section: any;
}

const componentCache = new Map<string, ComponentType<any>>();

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

// ── Source preparation ────────────────────────────────────────────────
// Strips directives only. Imports are LEFT INTACT for Sucrase to
// convert into require() calls via the "imports" transform.

function prepareSource(source: string): string {
  return source
    .replace(/^[\s]*["']use client["'];?\s*\n?/m, "")
    .replace(/^[\s]*["']use server["'];?\s*\n?/m, "");
}

// ── Compile ──────────────────────────────────────────────────────────

async function compile(source: string): Promise<ComponentType<any> | null> {
  const cleaned = prepareSource(source);
  const key = hash(cleaned);
  if (componentCache.has(key)) return componentCache.get(key)!;

  try {
    // 1. Preload any npm packages the template imports (fetches from esm.sh)
    await preloadModules(source);

    // 2. Transpile — Sucrase converts imports → require() calls
    const { transform } = await import("sucrase");
    const { code } = transform(cleaned, {
      transforms: ["jsx", "typescript", "imports"],
      jsxRuntime: "classic",
      production: false,
    });

    // 3. Execute with our require() shim
    const templateRequire = createRequire();

    const factory = new Function(
      "require", "React",
      `"use strict";
       var exports = {};
       var module = { exports: exports };
       ${code}
       if (module.exports.default) return module.exports.default;
       return module.exports;`
    );

    const Component = factory(templateRequire, React);
    const result = typeof Component === "function" ? Component : null;
    if (result) componentCache.set(key, result);
    return result;
  } catch (err) {
    console.error("[DynamicPlaylist] compile error:", err);
    return null;
  }
}

// ── React wrapper ────────────────────────────────────────────────────

export default function DynamicPlaylist({ template, playlist, section }: Props) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    compile(template)
      .then((comp) => {
        if (comp) setComponent(() => comp);
        else setError("Template compiled to nothing — check that it exports a default function.");
      })
      .catch((err) => {
        setError(err?.message ?? String(err));
      });
  }, [template]);

  if (error) return (
    <div style={{ margin: 16, padding: 16, border: "1px solid #fca5a5", background: "#fef2f2", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
      <strong>Renderer error:</strong> {error}
      <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "#ef4444" }}>
        {playlist?.RendererBundlePath}
      </div>
    </div>
  );

  if (!Component) return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
      Loading…
    </div>
  );

  return <Component playlist={playlist} section={section} />;
}