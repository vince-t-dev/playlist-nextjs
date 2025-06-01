import Link from "next/link";

type SitemapItem = {
    Slug: string;
    Name: string;
    Invisible?: boolean;
    [key: string]: any;
};

type NavbarProps = {
    items: SitemapItem[];
    [key: string]: any;
};

export default function Navbar({ items }: NavbarProps) {
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
                                    className="hover:text-slate-900 transition-colors"
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