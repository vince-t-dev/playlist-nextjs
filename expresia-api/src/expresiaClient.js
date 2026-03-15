// expresiaClient.js
//
// HTTP helpers for talking to the Expresia admin API.
// This module runs inside the expresia-api container only — never in Next.js.
//
// xprApi   — authenticated calls to the Expresia REST API (/api/...).
//            Attaches the instance bearer token from the Authorization header
//            forwarded by the route handler. Used for all write operations and
//            any read that requires auth (playlists, files, bundle entities).
//
// fetchBundle — public fetch of a compiled Boson template string by
//               RendererBundlePath. No token required. Used by getPlaylists
//               to attach _template to each playlist for SSR rendering.
//
// xprWww   — calls to expresia.com external endpoints (intro, producer profile).
//            Uses the static EXPRESIA_TOKEN env var, not the instance token.
//
// Note: Tailwind CSS compilation (@tailwindcss/node) also runs in this container
//       via the compileCss action in actions/index.js. It lives here rather than
//       in Next.js because the LightningCSS native binaries it requires are
//       incompatible with the stripped Next.js production image.

const fetch = require("node-fetch");

const DOMAIN_URL = () => (process.env.DOMAIN_URL || "").replace(/\/$/, "");
const EXPRESIA_TOKEN = () => process.env.EXPRESIA_TOKEN || "";

function apiUrl(path) {
    return `${DOMAIN_URL()}/api${path}`;
}

function bundleUrl(rendererBundlePath) {
    return `${DOMAIN_URL()}/api/bundles/entities/Boson/${rendererBundlePath}`;
}

async function xprApi({ uri, method = "GET", data, params, token } = {}) {
    const url = new URL(apiUrl(uri));
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.append(k, String(v));
        }
    }

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    console.log(`[xprApi] ${method} ${url.toString()}`);

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        console.error(`[xprApi] ${res.status} ← ${url.toString()}`);
        console.error(`[xprApi] body:`, text.substring(0, 300));
        throw Object.assign(new Error(`Expresia API error (${method} ${uri}): ${res.status}`), {
            status: res.status, body: text,
        });
    }

    return res.json();
}

async function fetchBundle(rendererBundlePath) {
    if (!rendererBundlePath) return null;
    try {
        const res = await fetch(bundleUrl(rendererBundlePath), {
            headers: { Accept: "application/json" },
        });
        if (!res.ok) return null;
        const boson = await res.json();
        return typeof boson?.Template === "string" ? boson.Template : null;
    } catch (err) {
        console.error(`[api] fetchBundle failed for "${rendererBundlePath}":`, err.message);
        return null;
    }
}

async function xprWww(uri, extraHeaders = {}) {
    const res = await fetch(uri, {
        headers: {
            Authorization: `Bearer ${EXPRESIA_TOKEN()}`,
            ...extraHeaders,
        },
    });
    if (!res.ok) throw new Error(`xprWww error (${uri}): ${res.status}`);
    return res.json();
}

module.exports = { xprApi, fetchBundle, xprWww };