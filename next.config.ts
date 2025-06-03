const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "export",
	trailingSlash: true,

	// expresia static deployment
	// TODO!
	// basePath: isProd ? "/__xpr__/pub_engine/playlist-nextjs/web" : "",
	assetPrefix: isProd ? "/__xpr__/pub_engine/playlist-nextjs/web/" : "",

	// disable image optimization for static export compatibility
	images: {
		unoptimized: true,
	},

	// expresia static deployment: resolving json data paths
	async rewrites() {
		return isProd
			? [
				{
					source: "/_next/data/:path*",
					destination: "/__xpr__/pub_engine/playlist-nextjs/web/_next/data/:path*"
				},
			]
			: [];
	},
	
	// env variables
	env: {
		DOMAIN_URL: process.env.DOMAIN_URL,
		PUBLIC_API_BASE: process.env.PUBLIC_API_BASE,
	},
};

export default nextConfig;