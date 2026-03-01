/** @type {import('next').NextConfig} */
const nextConfig = {
	trailingSlash: true,
	images: { unoptimized: true },
	env: {
		DOMAIN_URL: process.env.DOMAIN_URL,
		PUBLIC_API_BASE: process.env.PUBLIC_API_BASE,
	},

	// Proxy static assets (images, fonts, files) from the Expresia instance.
	// This handles dedicated deploys where DOMAIN_URL is set as an env var.
	// In shared ?domain= mode, skins should use absolute URLs from the domain query param.
	async rewrites() {
		const domain = process.env.DOMAIN_URL?.replace(/\/$/, "");
		if (!domain) return [];
		return [
			{
				source: "/media/:path*",
				destination: `${domain}/media/:path*`,
			},
			{
				source: "/files/:path*",
				destination: `${domain}/files/:path*`,
			},
		];
	},
};

export default nextConfig;