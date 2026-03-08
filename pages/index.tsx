// index.tsx — homepage (root section)

import Head from "next/head";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getPlaylists, getSitemap } from "@/lib/api";
import Playlists from "@/components/Playlists";

type Section = { Slug: string; Name: string };

export const getServerSideProps: GetServerSideProps<{
	playlists: any[];
	section: Section;
	sitemap: any;
}> = async () => {
	const [playlists, sitemap] = await Promise.all([
		getPlaylists(),
		getSitemap(),
	]);

	const section: Section =
		sitemap._embedded?.Children?.find((s: any) => !s.Slug) ??
		{ Slug: "", Name: "Home" };

	return { props: { playlists: playlists ?? [], section, sitemap } };
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