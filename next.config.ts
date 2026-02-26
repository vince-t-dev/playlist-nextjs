/** @type {import('next').NextConfig} */
const nextConfig = {
	trailingSlash: true,
	images: { unoptimized: true },
	env: {
		DOMAIN_URL: process.env.DOMAIN_URL,
		PUBLIC_API_BASE: process.env.PUBLIC_API_BASE,
		// INSTANCE_TOKEN intentionally omitted — never expose to client
	},
};

export default nextConfig;