"use client";

import Image from "next/image";
import { useState } from "react";

type TeamCardProps = {
    name: string;
    role: string;
    img: string;
    bio: string;
};

export default function TeamCard({ name, role, img, bio }: TeamCardProps) {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className="bg-white rounded-lg shadow-md p-4 space-y-3 text-left w-full lg:w-1/3">
            <div className="relative w-full h-48">
                <Image
                    src={img}
                    alt={name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    onLoad={() => setLoaded(true)}
                    className={`object-cover rounded-lg shadow-md transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
                    style={{ objectFit: "cover" }}
                />
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-semibold">{name}</h3>
                <p className="text-sm text-slate-500">{role}</p>
                <p className="text-sm text-slate-600">{bio}</p>
            </div>
        </div>
    );
}