// index.tsx — homepage (root section)
// Same domain/token pattern as [slug].tsx.
// Preview: https://your-nextjs.onrender.com/?domain=https://MyInstance.xpr.cloud&token=abc123

import Head from "next/head";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getPlaylists, getSitemap } from "@/lib/api";
import { fetchBosonTemplate } from "@/lib/bosonTemplates";
import Playlists from "@/components/Playlists";

type Section = { Slug: string; Name: string };

export const getServerSideProps: GetServerSideProps<{
	playlists: any[];
	section: Section;
	sitemap: any;
	domain: string;
	token: string;
}> = async ({ query }) => {
	const domain = (query.domain as string) || process.env.DOMAIN_URL || "";
	const token = (query.token as string) || process.env.INSTANCE_TOKEN || "";

	if (!domain) {
		return { props: { playlists: [], section: { Slug: "", Name: "Home" }, sitemap: {}, domain: "", token: "" } };
	}

	const [playlists, sitemap] = await Promise.all([
		getPlaylists(domain, token),
		getSitemap(domain, token),
	]);

	const section: Section =
		sitemap._embedded?.Children?.find((s: any) => !s.Slug) ??
		{ Slug: "", Name: "Home" };

	const playlistsWithTemplates = await Promise.all(
		(playlists ?? []).map(async (p: any) => ({
			...p,
			_template: await fetchBosonTemplate(domain, token, p.RendererBundlePath),
		}))
	);

	return { props: { playlists: playlistsWithTemplates, section, sitemap, domain, token } };
};

export default function IndexPage({
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