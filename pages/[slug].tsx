// pages/[slug].tsx

import Head from "next/head";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getSitemap, getPlaylists } from "@/lib/api";
import Playlists from "@/components/Playlists";
import DynamicPage from "@/components/DynamicPage";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
	const slug = params?.slug as string;

	const [playlists, sitemap] = await Promise.all([
		getPlaylists({ slug }),
		getSitemap(),
	]);

	// Find the matching child section — it carries _template from getSitemap
	const section =
		sitemap._embedded?.Children?.find((s: any) => s.Slug === slug) ??
		{ Slug: slug, Name: slug };

	return { props: { playlists: playlists ?? [], section, sitemap } };
};

export default function Page({
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