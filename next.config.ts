const nextConfig = {
	output: "export",
	trailingSlash: true,
	// disable image optimization for static export compatibility
	images: {
		unoptimized: true
	},
	env: {
		DOMAIN_URL: process.env.DOMAIN_URL,
		PUBLIC_API_BASE: process.env.PUBLIC_API_BASE,
	},
};

export default nextConfig;