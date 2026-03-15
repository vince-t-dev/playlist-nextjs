import Document, { Html, Head, Main, NextScript, DocumentContext } from "next/document";
import { getCmsCompiledCss } from "@/lib/api";

type Props = { compiledCss: string };

export default class MyDocument extends Document<Props> {
    static async getInitialProps(ctx: DocumentContext) {
        const [base, compiledCss] = await Promise.all([
            Document.getInitialProps(ctx),
            // NOTE: update path to match Expresia TextContentObject path for global CSS
            getCmsCompiledCss("NextJSTemplate/css/global").catch(() => ""),
        ]);
        return { ...base, compiledCss };
    }

    render() {
        const { compiledCss } = this.props;
        return (
            <Html>
                <Head>
                    {/* Tailwind 4 global css from Expresia */}
                    {compiledCss &&
                    <style
                        data-source="expresia-cms"
                        dangerouslySetInnerHTML={{ __html: compiledCss }}
                    />}
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}
