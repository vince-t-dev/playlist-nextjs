// bosonTemplates.ts — server-side only (runs in getServerSideProps).
// Fetches Boson.Template from the Expresia instance using the per-instance token.
// The instance token comes from the provisioning response (user_api_tokens[0].token)
// and is passed via query param or env — NOT the admin EXPRESIA_API_TOKEN.

export async function fetchBosonTemplate(
  domain: string,
  token: string,
  rendererBundlePath: string
): Promise<string | null> {
  if (!rendererBundlePath || !domain) return null;

  const base = domain.replace(/\/$/, "");
  const url = `${base}/api/bundles/entities/Boson/${rendererBundlePath}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Instance token — scoped to this user's site only
        ...(token && { "xpr-token-backend": token }),
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const boson = await res.json();
    return typeof boson?.Template === "string" ? boson.Template : null;
  } catch (err) {
    console.error(`[bosonTemplates] fetch failed for "${rendererBundlePath}" on ${domain}:`, err);
    return null;
  }
}