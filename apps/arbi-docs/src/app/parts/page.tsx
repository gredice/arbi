import type { Metadata } from "next";
import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { InventoryGrid } from "@/components/InventoryGrid";
import { data, inventory, systemBySlug } from "@/lib/site";

export const metadata: Metadata = { title: "Parts" };

export default function Parts() {
    const { models } = data();
    const groups = Map.groupBy(models, (m) => m.assembly);
    return (
        <>
            <Crumb left="Parts" right={`${models.length} registered models`} />
            <div className="px-4 pb-20 sm:px-6">
                {[...groups].sort(([a], [b]) =>
                    (systemBySlug(a)?.number ?? "99").localeCompare(systemBySlug(b)?.number ?? "99") || a.localeCompare(b)
                ).map(([slug, list]) => {
                    const sys = systemBySlug(slug);
                    return (
                        <section key={slug} className="mt-10">
                            <div className="flex items-end gap-4">
                                <span className="cond text-[56px] leading-none">{sys?.number ?? "—"}</span>
                                <h2 className="cond pb-1 text-[30px] leading-none">{sys?.name ?? slug}</h2>
                            </div>
                            <div className="mt-4">
                                <InventoryGrid items={inventory(list.map((m) => m.id), false)} />
                            </div>
                        </section>
                    );
                })}
                <Link href="/parts/archive" className="mt-10 block underline">Archived models · excluded from current fabrication</Link>
            </div>
        </>
    );
}
