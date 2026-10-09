import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumb } from "@/components/Crumb";
import { InventoryGrid } from "@/components/InventoryGrid";
import { SystemExplorer } from "@/components/SystemExplorer";
import { fmt } from "@/lib/format";
import { data, docHref, inventory, sceneModels, systemBySlug } from "@/lib/site";

export const dynamicParams = false;
export const generateStaticParams = () => [...data().assemblies.map((s) => ({ slug: s.slug })), { slug: "winch-powered" }];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const sys = systemBySlug((await params).slug);
    return { title: sys?.name, description: sys?.description };
}

export default async function SystemPage({ params }: { params: Promise<{ slug: string }> }) {
    const sys = systemBySlug((await params).slug);
    if (!sys) notFound();
    const { systems, assemblies, scenes, site } = data();
    const parent = assemblies.find((assembly) => assembly.id === sys.parentAssemblyId);
    const children = assemblies.filter((assembly) => assembly.parentAssemblyId === sys.id);
    const scene = sys.scene ? scenes[sys.slug] : null;
    const lineup = sys.scene?.layout === "lineup";
    const ids = sceneModels(sys.slug);
    const others = sys.models.filter((m) => !ids.includes(m.id));
    const from = sys.scene ? (sys.scene.source.kind === "release" ? sys.scene.source.tag ?? "CAD release" : sys.scene.source.kind === "local" ? "current local design package" : sys.scene.source.current ? "current committed booklet snapshot" : "archived booklet snapshot · earlier design") : "";
    const caption = !sys.scene
        ? ""
        : lineup
          ? `Parts laid out side by side · no assembly pose is registered · meshes from ${from}`
          : `${scene?.configuration ? `${scene.configuration} · ` : ""}${sys.scene.pose ? `Exploded pose: booklet figure “${sys.scene.pose}”` : "Assembled only: no exploded figure in this pack"} · meshes from ${from}`;
    const doc = docHref(sys.documentation);
    const developmentDocs = sys.slug === "dock"
        ? ["assembly-guide", "booklet/README", "design-proposal", "design-package", "bench-test-plan", "acceptance-record"]
            .flatMap((name) => {
                const entry = site.docs.find((item) => item.path === `docs/assemblies/dock/${name}.md`);
                const href = entry && docHref(entry.path);
                return entry && href ? [{ ...entry, href }] : [];
            })
        : [];
    const winch = sys.slug === "winch" || sys.slug === "winch-powered";
    return (
        <>
            <Crumb left={`${sys.number} · ${sys.name}`} right={scene ? (lineup ? "Parts layout · click a number" : "Exploded view · click a number") : ""} dark />
            <SystemExplorer
                number={sys.number}
                name={sys.name}
                scene={scene}
                cadPending={sys.models.length > 0}
                caption={caption}
                nav={systems.map((s) => ({ slug: s.slug, number: s.number, name: s.name }))}
                current={sys.slug}
                navCurrent={sys.rootSlug}
                variants={winch ? [{ slug: "winch", name: "Ordinary winch" }, { slug: "winch-powered", name: "Powered winch" }] : []}
                inventory={inventory(ids, !lineup, sys.slug)}
                inventoryNote={lineup ? "Registered fabrication parts · quantities in the BOM" : `Quantities per configured ${sys.slug === "camera-pod" ? "pod" : sys.slug === "corner-station" ? "proposed corner head" : sys.slug === "dock" ? "dock bench kit" : sys.slug === "winch-powered" ? "powered winch" : "ordinary winch"}`}
            >
                <section className="grid gap-8 border-b-2 border-ink px-4 py-8 sm:px-6 lg:grid-cols-12">
                    <p className="text-[17px] leading-snug lg:col-span-5">{sys.description}</p>
                    <div className="border-t-2 border-ink lg:col-span-4">
                        {(
                            [
                                [winch ? "Registered models · full winch set" : sys.slug === "corner-station" ? "Registered models · supports" : "Registered models", sys.models.length],
                                [winch ? "BOM lines · full winch set" : sys.slug === "corner-station" ? "BOM lines · supports" : "BOM lines", sys.usages.length],
                                [winch ? "Known goods · full winch set" : sys.slug === "corner-station" ? "Known goods · supports only" : "Known goods", sys.goods ? fmt.eur(sys.goods) : "—"],
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
                        {parent && (
                            <Link href={`/systems/${parent.slug}`} className="key-line mb-3 w-full justify-between">
                                Part of {parent.name} <span>↑</span>
                            </Link>
                        )}
                        {doc && (
                            <Link href={doc} className="key w-full justify-between">
                                Assembly document <span>→</span>
                            </Link>
                        )}
                    </div>
                </section>
            </SystemExplorer>
            <div className="mb-20">
                {developmentDocs.length > 0 && (
                    <section className="mt-10 px-4 sm:px-6">
                        <h2 className="cond text-[24px]">Design and acceptance</h2>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            {developmentDocs.map((entry) => (
                                <Link key={entry.path} href={entry.href} className="border-t-2 border-ink py-4">
                                    <span className="cond text-[21px]">{entry.title} <span aria-hidden="true">→</span></span>
                                    <p className="mt-2 text-[13px] leading-relaxed">{entry.summary}</p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
                {children.length > 0 && (
                    <section className="mt-10 px-4 sm:px-6">
                        <h2 className="cond text-[24px]">Subassemblies</h2>
                        {children.map((child) => (
                            <div key={child.id} className="mt-3 border-t border-ink py-4">
                                <h3 className="cond text-[26px]">{child.name}</h3>
                                <p className="mt-2 max-w-[70ch]">{child.description}</p>
                                <p className="tag mt-2">Known goods · full set {child.goods ? fmt.eur(child.goods) : "—"} · counted separately from supports</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Link href={`/systems/${child.slug}`} className="key-line">{child.slug === "winch" ? "Ordinary winch" : child.name} →</Link>
                                    {child.slug === "winch" && <Link href="/systems/winch-powered" className="key-line">Powered winch →</Link>}
                                </div>
                            </div>
                        ))}
                    </section>
                )}
                {(winch || sys.slug === "corner-station") && (
                    <section className="mt-10 px-4 sm:px-6">
                        <Link href="/docs/assemblies/positioning-lines" className="key-line">Shared positioning-line specification →</Link>
                    </section>
                )}
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
