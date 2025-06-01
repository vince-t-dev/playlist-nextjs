import Head from "next/head";
import { GetStaticProps, InferGetStaticPropsType } from "next";
import { getPlaylists, getSitemap } from "@/lib/api";
import Playlists from "@/components/Playlists";

export const getStaticProps: GetStaticProps = async () => {
	const [playlists, sitemap] = await Promise.all([
		getPlaylists(),
		getSitemap(),
	]);

	const section = sitemap._embedded?.Children.find((s: any) => !s.Slug) ?? {
		Slug: "",
		Name: "Home",
	};

	return {
		props: { playlists, section, sitemap },
	};
};

export default function IndexPage({
	playlists,
	section,
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<>
			<Head>
				<title>{`${section.Name} | NextJS Site`}</title>
				<meta name="description" content={`View the latest playlists in the ${section.Name} section.`} />
			</Head>
			<Playlists playlists={playlists} section={section} />
		</>
	);
}
