// pages/index.tsx — homepage (root section)

import Head from "next/head";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getPlaylists, getSitemap } from "@/lib/api";
import Playlists from "@/components/Playlists";
import DynamicPage from "@/components/DynamicPage";

type Section = { Slug: string; Name: string; _template?: string | null };

export const getServerSideProps: GetServerSideProps<{
	playlists: any[];
	section: Section;
	sitemap: any;
}> = async () => {
	const [playlists, sitemap] = await Promise.all([
		getPlaylists(),
		getSitemap(),
	]);

	// Home section = root sitemap node (no Slug) or fall back
	const section: Section =
		sitemap._embedded?.Children?.find((s: any) => !s.Slug) ??
		{ Slug: "", Name: "Home" };

	// Root section template lives on the sitemap root itself
	if (!section._template && sitemap._template) {
		section._template = sitemap._template;
	}

	return { props: { playlists: playlists ?? [], section, sitemap } };
};

export default function IndexPage({
	playlists,
	section,
	sitemap,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	return (
		<>
			<Head>
				<title>{`${section.Name} | NextJS Site`}</title>
				<meta name="description" content={`${section.Name}`} />
			</Head>
			{section._template ? (
				<DynamicPage
					template={section._template}
					playlists={playlists}
					sitemap={sitemap}
					section={section}
				/>
			) : (
				<Playlists playlists={playlists} section={section} />
			)}
		</>
	);
}