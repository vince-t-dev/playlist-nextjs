import Head from "next/head";
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { getSitemap, getPlaylists } from "@/lib/api";
import { fetchBosonTemplate } from "@/lib/bosonTemplates";
import Playlists from "@/components/Playlists";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
	const slug = params?.slug as string;

	const [playlists, sitemap] = await Promise.all([
		getPlaylists({ slug }),
		getSitemap(),
	]);

	const section = sitemap._embedded?.Children.find(
		(s: any) => s.Slug === slug
	) ?? { Slug: slug, Name: 'Unknown' };

	const playlistsWithTemplates = await Promise.all(
		(playlists ?? []).map(async (p: any) => ({
			...p,
			_template: await fetchBosonTemplate(p.RendererBundlePath),
		}))
	);

	return { props: { playlists: playlistsWithTemplates, section, sitemap } };
};

export default function Page({
	playlists,
	section,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
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