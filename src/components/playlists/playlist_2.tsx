"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Playlist2({ section, Name, _embedded }: any) {
    const html = _embedded?.PlaylistItems?.[0]?._embedded?.Article?.Html ?? "";

    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 space-y-10">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full space-y-6 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">
                    {section?.Name} - {Name}
                </h1>
                <div
                    className="text-base text-slate-600"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
                <div className="text-sm text-slate-500">
                    Built with NextJS by developers who care about performance and clean design.
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-6 max-w-4xl w-full space-y-6">
                <h2 className="text-xl font-semibold text-center text-slate-800">
                    Meet the Creator
                </h2>
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="relative w-full h-48 md:w-60 md:h-48 shrink-0">
                        <Image
                            src="https://picsum.photos/seed/project42/1200/800?randomnum=17"
                            alt="Profile Image"
                            fill
                            className="object-cover rounded-lg shadow-md transition-opacity duration-700"
                            sizes="(max-width: 768px) 100vw, 240px"
                            priority={false}
                        />
                    </div>
                    <div className="space-y-4 text-slate-700">
                        <h3 className="text-lg font-semibold">Mateo Silva</h3>
                        <p>
                            Mateo is a front-end developer passionate about elegant user experiences,
                            scalable component architecture, and modern web performance. He built this
                            demo to explore NextJS&apos;s strengths in building content-focused sites
                            enhanced with interactive UI.
                        </p>
                        <Button className="mt-2">Meet The Team</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}