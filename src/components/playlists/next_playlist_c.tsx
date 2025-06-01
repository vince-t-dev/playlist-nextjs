"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Playlist3() {
    return (
        <div className="flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen px-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full space-y-6">
                <h1 className="text-2xl font-bold text-center">Contact Playlist Three</h1>
                <form className="space-y-4">
                    <Input type="text" placeholder="Your Name" required />
                    <Input type="email" placeholder="Your Email" required />
                    <Textarea placeholder="Your Message" rows={5} required />
                    <Button type="submit" className="w-full">
                        Send Message
                    </Button>
                </form>
            </div>
        </div>
    );
}
