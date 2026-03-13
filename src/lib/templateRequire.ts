// lib/templateRequire.ts
// ──────────────────────────────────────────────────────────────────────
// Shared module registry for runtime-compiled Expresia templates.
//
// Templates in the CMS can write normal import statements:
//
//   import { motion } from "framer-motion";
//   import confetti from "canvas-confetti";
//
// Sucrase (with the "imports" transform) converts these to require() calls.
// This module provides the require() function that resolves them:
//
//   1. BUILT-IN  → pre-registered modules (React, hooks, UI components, etc.)
//   2. CDN       → fetched from esm.sh on first use, then cached
//   3. ERROR     → helpful message telling the author what went wrong
// ──────────────────────────────────────────────────────────────────────

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── Inline shims for Card / Badge (same as the old factory args) ─────

const Card = ({ className, children, ...p }: any) =>
  React.createElement("div", {
    className: ["rounded-xl border bg-white shadow-sm", className].filter(Boolean).join(" "),
    ...p,
  }, children);

const CardHeader = ({ className, children, ...p }: any) =>
  React.createElement("div", {
    className: ["flex flex-col space-y-1.5 p-6", className].filter(Boolean).join(" "),
    ...p,
  }, children);

const CardContent = ({ className, children, ...p }: any) =>
  React.createElement("div", {
    className: ["p-6 pt-0", className].filter(Boolean).join(" "),
    ...p,
  }, children);

const CardFooter = ({ className, children, ...p }: any) =>
  React.createElement("div", {
    className: ["flex items-center p-6 pt-0", className].filter(Boolean).join(" "),
    ...p,
  }, children);

const CardTitle = ({ className, children, ...p }: any) =>
  React.createElement("h3", {
    className: ["font-semibold leading-none tracking-tight", className].filter(Boolean).join(" "),
    ...p,
  }, children);

const Badge = ({ className, variant, children, ...p }: any) => {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const variants: Record<string, string> = {
    default: "bg-slate-900 text-white",
    secondary: "bg-slate-100 text-slate-900",
    destructive: "bg-red-600 text-white",
    outline: "border border-slate-200 text-slate-900",
  };
  return React.createElement("span", {
    className: [base, variants[variant ?? "default"] ?? variants.default, className].filter(Boolean).join(" "),
    ...p,
  }, children);
};


// ── Built-in registry ────────────────────────────────────────────────
// Maps import specifiers → module objects.
// Supports both default and named exports per npm convention:
//   import React from "react"           → registry["react"] (has .default)
//   import { useState } from "react"    → registry["react"].useState

const BUILTIN_REGISTRY: Record<string, any> = {
  // Core React — the module itself is both the default and namespace
  // __esModule tells Sucrase's _interopRequireDefault to use .default as-is
  "react": (() => {
    const mod = { ...React, default: React, __esModule: true };
    return mod;
  })(),

  // Next.js
  "next/link": { default: Link, Link, __esModule: true },

  // Local UI components — exposed under @/components/ui/* paths
  // so templates can write: import { Button } from "@/components/ui/button"
  "@/components/ui/button": { Button, default: Button, __esModule: true },
  "@/components/ui/input": { Input, default: Input, __esModule: true },
  "@/components/ui/textarea": { Textarea, default: Textarea, __esModule: true },

  // Inline UI shims
  "@/components/ui/card": { Card, CardHeader, CardContent, CardFooter, CardTitle, __esModule: true },
  "@/components/ui/badge": { Badge, default: Badge, __esModule: true },
};


// ── CDN module cache ─────────────────────────────────────────────────
// Modules fetched from esm.sh are cached here so repeat requires are
// synchronous (critical because require() itself must be sync).

const cdnCache: Record<string, any> = {};


// ── Preload: async fetch from esm.sh ─────────────────────────────────
// Called BEFORE the synchronous factory runs.  Scans for all import
// specifiers not already in the registry and fetches them in parallel.

const IMPORT_RE = /(?:^|[\n;])import\s+(?:(?:[\w{},*\s]+)\s+from\s+)?['"]([^'"]+)['"]/g;

export function extractImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset lastIndex since we reuse the regex
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(source)) !== null) {
    specifiers.add(match[1]);
  }
  return [...specifiers];
}

function isBuiltin(specifier: string): boolean {
  return specifier in BUILTIN_REGISTRY;
}

function isBareSpecifier(specifier: string): boolean {
  // npm package names: don't start with . / @ is scoped but not @/
  return (
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("@/") &&
    !specifier.startsWith("@\\")
  );
}

export async function preloadModules(source: string): Promise<string[]> {
  const specifiers = extractImportSpecifiers(source);
  const toFetch = specifiers.filter(s => !isBuiltin(s) && isBareSpecifier(s) && !(s in cdnCache));

  if (toFetch.length === 0) return [];

  const results = await Promise.allSettled(
    toFetch.map(async (specifier) => {
      try {
        // esm.sh serves ESM builds of npm packages.
        // The dynamic import() returns a module namespace object.
        const mod = await import(/* webpackIgnore: true */ `https://esm.sh/${specifier}`);
        cdnCache[specifier] = mod;
        return specifier;
      } catch (err) {
        console.warn(`[templateRequire] CDN fetch failed for "${specifier}":`, err);
        throw err;
      }
    })
  );

  const loaded: string[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") loaded.push(toFetch[i]);
    else failed.push(toFetch[i]);
  });

  if (failed.length) {
    console.warn(`[templateRequire] Could not resolve: ${failed.join(", ")}`);
  }

  return loaded;
}


// ── Synchronous require() shim ───────────────────────────────────────
// This is the function injected into the compiled template's scope.
// By the time it runs, preloadModules() has already cached everything.

export function createRequire(): (specifier: string) => any {
  return function templateRequire(specifier: string): any {
    // 1. Built-in registry
    if (BUILTIN_REGISTRY[specifier]) {
      return BUILTIN_REGISTRY[specifier];
    }

    // 2. CDN cache (populated by preloadModules)
    if (cdnCache[specifier]) {
      return cdnCache[specifier];
    }

    // 3. Unknown — give the template author a useful error
    throw new Error(
      `[Template] Cannot resolve module "${specifier}". ` +
      `It is not a built-in module and could not be loaded from CDN (esm.sh). ` +
      `Check the package name or ensure it is published on npm.`
    );
  };
}


// ── Public API: register additional modules ──────────────────────────
// Optional — lets the Next.js app pre-register extra modules
// that should be available to all templates without CDN fetch.

export function registerModule(specifier: string, moduleExports: any): void {
  // Ensure __esModule so Sucrase's _interopRequireDefault works correctly
  if (typeof moduleExports === "object" && moduleExports !== null && !moduleExports.__esModule) {
    moduleExports.__esModule = true;
  }
  BUILTIN_REGISTRY[specifier] = moduleExports;
}

// Convenience: register a whole map at once
export function registerModules(modules: Record<string, any>): void {
  for (const [specifier, exports] of Object.entries(modules)) {
    registerModule(specifier, exports);
  }
}