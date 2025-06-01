import "@/styles/global.css";
import Navbar from "@/components/Navbar";
import type { AppProps } from "next/app";

export default function MyApp({ Component, pageProps }: AppProps) {
	const sitemap = pageProps?.sitemap?._embedded?.Children ?? [];

	return (
		<>
			<Navbar items={sitemap} />
			<Component {...pageProps} />
		</>
	);
}