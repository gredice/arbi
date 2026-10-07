import type { Metadata } from "next";
import { ContentsList } from "@/components/ContentsList";
import { Crumb } from "@/components/Crumb";
import { data } from "@/lib/site";

export const metadata: Metadata = { title: "Systems" };

export default function Systems() {
    const { systems } = data();
    return (
        <>
            <Crumb left="Systems" right={`${systems.length} physical assemblies`} />
            <div className="px-4 pb-20 sm:px-6">
                <h1 className="cond border-b-2 border-ink py-8 text-[88px] leading-[0.85]">Systems</h1>
                <ContentsList systems={systems} />
            </div>
        </>
    );
}
