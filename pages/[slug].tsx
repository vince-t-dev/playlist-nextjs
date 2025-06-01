import Head from "next/head";
import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { getSitemap, getPlaylists } from "@/lib/api";
import Playlists from "@/components/Playlists";

export const getStaticPaths: GetStaticPaths = async () => {
	const sitemap = await getSitemap();
	const paths =
		sitemap._embedded?.Children.map((s: any) => ({
			params: { slug: s.Slug },
		})) ?? [];

	return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
	const slug = params?.slug as string;
	const [playlists, sitemap] = await Promise.all([
		getPlaylists(slug),
		getSitemap(),
	]);

	const section = sitemap._embedded?.Children.find((s: any) => s.Slug === slug) ?? {
		Slug: slug,
		Name: "Unknown",
	};

	return {
		props: { playlists, section, sitemap },
	};
};

export default function Page({
	playlists,
	section,
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<>
			<Head>
				<title>{`${section.Name} | NextJS Site`}</title>
				<meta name="description" content={`Explore playlists in the ${section.Name} section.`} />
			</Head>
			<Playlists playlists={playlists} section={section} />
		</>
	);
}