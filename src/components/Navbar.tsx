import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

type SitemapItem = {
    Slug: string;
    Name: string;
    Invisible?: boolean;
};

type NavbarProps = {
    items: SitemapItem[];
};

export default function Navbar({ items }: NavbarProps) {
    const router = useRouter();
    const { asPath } = router;
    const currentSlug = useMemo(() => {
        const pathWithoutQuery = asPath.split("?")[0];
        const trimmed = pathWithoutQuery.replace(/^\/|\/$/g, "");
        return trimmed.split("/")[0];
    }, [asPath]);

    return (
        <nav className="bg-white shadow-sm px-4 py-3 border-b w-full">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" className="text-lg font-semibold text-slate-800">
                    NextJS Site
                </Link>

                <ul className="flex gap-6 text-sm font-medium text-slate-600">
                    {items.map((item) =>
                        !item.Invisible ? (
                            <li key={item.Slug}>
                                <Link
                                    href={`${item.Slug}`}
                                    className={`
                                        hover:text-slate-900 transition-colors
                                        ${item.Slug === currentSlug ? "text-slate-900" : ""}
                                    `}
                                >
                                    {item.Name}
                                </Link>
                            </li>
                        ) : null
                    )}
                </ul>
            </div>
        </nav>
    );
}