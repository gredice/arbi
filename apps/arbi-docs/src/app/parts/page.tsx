import type { Metadata } from "next";
import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { InventoryGrid } from "@/components/InventoryGrid";
import { WarningOverview } from "@/components/Warnings";
import { catalogInventory, data, systemBySlug, warningsFor } from "@/lib/site";
import { uniqueWarnings } from "@/lib/warnings";

export const metadata: Metadata = { title: "Parts" };

export default function Parts() {
    const { parts, site } = data();
    const groups = Map.groupBy(parts, (part) => part.assembly);
    return (
        <>
            <Crumb left="Parts" right={`${site.bom.parts.length} BOM items · CAD components and references`} />
            <div className="px-4 pb-20 sm:px-6">
                <WarningOverview warnings={uniqueWarnings(parts.flatMap((part) => warningsFor(part.id)))} linkTo="parts" />
                {[...groups].sort(([a], [b]) =>
                    (systemBySlug(a)?.number ?? "99").localeCompare(systemBySlug(b)?.number ?? "99") || a.localeCompare(b)
                ).map(([slug, list]) => {
                    const sys = systemBySlug(slug);
                    return (
                        <section key={slug} className="mt-10">
                            <div className="flex items-end gap-4">
                                <span className="cond text-[56px] leading-none">{sys?.number ?? "—"}</span>
                                <h2 className="cond pb-1 text-[30px] leading-none">{sys?.name ?? (slug === "shared-procurement-stock" ? "Shared procurement stock" : slug)}</h2>
                            </div>
                            <div className="mt-4">
                                <InventoryGrid items={catalogInventory(list.map((part) => part.id))} />
                            </div>
                        </section>
                    );
                })}
                <Link href="/parts/archive" className="mt-10 block underline">Archived parts and models · excluded from current assemblies</Link>
            </div>
        </>
    );
}
