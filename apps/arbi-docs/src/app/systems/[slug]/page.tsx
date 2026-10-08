import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumb } from "@/components/Crumb";
import { InventoryGrid } from "@/components/InventoryGrid";
import { SystemExplorer } from "@/components/SystemExplorer";
import { fmt } from "@/lib/format";
import { data, docHref, inventory, sceneModels, systemBySlug } from "@/lib/site";

export const dynamicParams = false;
export const generateStaticParams = () => [...data().systems.map((s) => ({ slug: s.slug })), { slug: "winch-powered" }];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const sys = systemBySlug((await params).slug);
    return { title: sys?.name, description: sys?.description };
}

export default async function SystemPage({ params }: { params: Promise<{ slug: string }> }) {
    const sys = systemBySlug((await params).slug);
    if (!sys) notFound();
    const { systems, scenes } = data();
    const scene = sys.scene ? scenes[sys.slug] : null;
    const lineup = sys.scene?.layout === "lineup";
    const ids = sceneModels(sys.slug);
    const others = sys.models.filter((m) => !ids.includes(m.id));
    const from = sys.scene ? (sys.scene.source.kind === "release" ? sys.scene.source.tag ?? "CAD release" : sys.scene.source.current ? "current committed booklet snapshot" : "archived booklet snapshot · earlier design") : "";
    const caption = !sys.scene
        ? ""
        : lineup
          ? `Parts laid out side by side · no assembly pose is registered · meshes from ${from}`
          : `${sys.scene.pose ? `Exploded pose: booklet figure “${sys.scene.pose}”` : "Assembled only: no exploded figure in this pack"} · meshes from ${from}`;
    const doc = docHref(sys.documentation);
    const winch = sys.slug === "winch" || sys.slug === "winch-powered";
    return (
        <>
            <Crumb left={`${sys.number} · ${sys.name}`} right={scene ? (lineup ? "Parts layout · click a number" : "Exploded view · click a number") : ""} dark />
            <SystemExplorer
                number={sys.number}
                name={sys.name}
                scene={scene}
                caption={caption}
                nav={systems.map((s) => ({ slug: s.slug, number: s.number, name: s.name }))}
                current={sys.slug}
                variants={winch ? [{ slug: "winch", name: "Passive winch" }, { slug: "winch-powered", name: "Powered winch" }] : []}
                inventory={inventory(ids, !lineup, sys.slug)}
                inventoryNote={lineup ? "Registered fabrication parts · quantities in the BOM" : `Quantities per configured ${sys.slug === "camera-pod" ? "pod" : sys.slug === "winch-powered" ? "powered winch" : "passive winch"}`}
            >
                <section className="grid gap-8 border-b-2 border-ink px-4 py-8 sm:px-6 lg:grid-cols-12">
                    <p className="text-[17px] leading-snug lg:col-span-5">{sys.description}</p>
                    <div className="border-t-2 border-ink lg:col-span-4">
                        {(
                            [
                                [winch ? "Registered models · full winch set" : "Registered models", sys.models.length],
                                [winch ? "BOM lines · full winch set" : "BOM lines", sys.usages.length],
                                [winch ? "Known goods · full winch set" : "Known goods", sys.goods ? fmt.eur(sys.goods) : "—"],
                                ["Status", "Concept · unvalidated"],
                            ] as const
                        ).map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-ink py-2">
                                <span className="tag">{k}</span>
                                <span className="mono">{v}</span>
                            </div>
                        ))}
                    </div>
                    <div className="lg:col-span-3">
                        {doc && (
                            <Link href={doc} className="key w-full justify-between">
                                Assembly document <span>→</span>
                            </Link>
                        )}
                    </div>
                </section>
            </SystemExplorer>
            <div className="mb-20">
                {others.length > 0 && (
                    <section className="mt-10 px-4 sm:px-6">
                        <h2 className="cond text-[24px]">Other registered sources</h2>
                        <div className="mt-3">
                            <InventoryGrid items={inventory(others.map((m) => m.id), false)} />
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}
