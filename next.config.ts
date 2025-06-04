const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "export",
	trailingSlash: true,
	distDir: "xpr/web",
	assetPrefix: isProd
		? "/__xpr__/pub_engine/playlist-nextjs/web/"
		: undefined,

	images: {
		unoptimized: true,
	},

	env: {
		DOMAIN_URL: process.env.DOMAIN_URL,
		PUBLIC_API_BASE: process.env.PUBLIC_API_BASE,
	}
};

export default nextConfig;
