// Server-side only — runs in getServerSideProps.
// Uses INSTANCE_TOKEN from .env.local to authenticate against Expresia.

export async function fetchBosonTemplate(
  rendererBundlePath: string
): Promise<string | null> {
  if (!rendererBundlePath) return null;

  const baseUrl = (process.env.DOMAIN_URL ?? "").replace(/\/$/, "");
  const token = process.env.INSTANCE_TOKEN ?? "";
  const url = `${baseUrl}/api/bundles/entities/Boson/${rendererBundlePath}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const boson = await res.json();
    return typeof boson?.Template === "string" ? boson.Template : null;
  } catch (err) {
    console.error(`[bosonTemplates] fetch failed for "${rendererBundlePath}":`, err);
    return null;
  }
}