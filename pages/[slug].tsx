// [slug].tsx
// Accepts ?domain= and ?token= query params so a single Next.js deployment
// can render any Expresia instance. Falls back to env vars for dedicated deploys.
//
// Preview URL pattern:
//   https://your-nextjs.onrender.com/home?domain=https://MyInstance.xpr.cloud&token=abc123

import Head from "next/head";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getSitemap, getPlaylists } from "@/lib/api";
import { fetchBosonTemplate } from "@/lib/bosonTemplates";
import Playlists from "@/components/Playlists";

export const getServerSideProps: GetServerSideProps = async ({ params, query }) => {
	const slug = params?.slug as string;

	// domain + token: query param takes priority, then env vars (dedicated deploy)
	const domain = (query.domain as string) || process.env.DOMAIN_URL || "";
	const token = (query.token as string) || process.env.INSTANCE_TOKEN || "";

	if (!domain) {
		return { props: { playlists: [], section: { Slug: slug, Name: slug }, sitemap: {}, domain: "", token: "" } };
	}

	const [playlists, sitemap] = await Promise.all([
		getPlaylists(domain, token, { slug }),
		getSitemap(domain, token),
	]);

	const section =
		sitemap._embedded?.Children?.find((s: any) => s.Slug === slug) ??
		{ Slug: slug, Name: slug };

	const playlistsWithTemplates = await Promise.all(
		(playlists ?? []).map(async (p: any) => ({
			...p,
			_template: await fetchBosonTemplate(domain, token, p.RendererBundlePath),
		}))
	);

	return { props: { playlists: playlistsWithTemplates, section, sitemap, domain, token } };
};

export default function Page({
	playlists,
	section,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	return (
		<>
			<Head>
				<title>{`${section.Name} | NextJS Site`}</title>
				<meta name="description" content={`${section.Name}`} />
			</Head>
			<Playlists playlists={playlists} section={section} />
		</>
	);
}