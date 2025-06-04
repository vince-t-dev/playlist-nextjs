"use client";

import TeamCard from "@/components/TeamCard";

const teamMembers = [
    {
        name: "Jamie Tan",
        role: "Frontend Engineer",
        img: "https://picsum.photos/seed/team01/400/300?randomnum=12",
        bio: "Jamie loves creating accessible, scalable component libraries and writing elegant UI code.",
    },
    {
        name: "Lena Chen",
        role: "UX Designer",
        img: "https://picsum.photos/seed/team24/400/300?randomnum=73",
        bio: "Lena designs systems that prioritize clarity, empathy, and user delight across all screens.",
    },
    {
        name: "Ravi Kapoor",
        role: "Performance Architect",
        img: "https://picsum.photos/seed/team88/400/300?randomnum=41",
        bio: "Ravi ensures every interaction is fast and smooth, optimizing performance from the ground up.",
    },
];

export default function TeamSection() {
    return (
        <section className="px-4 py-20 bg-gradient-to-b from-slate-50 to-slate-100 min-h-[500px]">
            <div className="max-w-6xl mx-auto text-center space-y-12 my-5">
                <div className="space-y-4">
                    <h1 className="text-4xl font-extrabold text-slate-800">Meet Playlist One</h1>
                    <p className="text-slate-600 text-base max-w-xl mx-auto">
                        A passionate group of developers, designers, and dreamers building beautiful interfaces and performant web experiences.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto flex flex-col lg:flex-row justify-between gap-6">
                    {teamMembers.map((member) => (
                        <TeamCard key={member.name} {...member} />
                    ))}
                </div>
            </div>
        </section>
    );
}
