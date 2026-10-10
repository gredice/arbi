import type { Metadata } from "next";
import { ContentsList } from "@/components/ContentsList";
import { Crumb } from "@/components/Crumb";
import { data } from "@/lib/site";

export const metadata: Metadata = { title: "Systems" };

export default function Systems() {
    const { systems, assemblies } = data();
    return (
        <>
            <Crumb left="Systems" right={`${systems.length} physical systems`} />
            <div className="px-4 pb-20 sm:px-6">
                <h1 className="cond border-b-2 border-ink py-8 text-[88px] leading-[0.85]">Systems</h1>
                <p className="max-w-4xl py-4 text-[13px] text-grey">CAD file counts include individual parts, assembly views and alternatives. BOM items include bought parts and fabrication kits; each system’s bill of materials expands the kits into print quantities and material costs.</p>
                <ContentsList systems={systems} assemblies={assemblies} />
            </div>
        </>
    );
}
