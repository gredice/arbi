import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumb } from "@/components/Crumb";
import { InventoryGrid } from "@/components/InventoryGrid";
import { SystemExplorer } from "@/components/SystemExplorer";
import { SubassemblyList } from "@/components/SubassemblyList";
import { SystemBom } from "@/components/SystemBom";
import { fmt } from "@/lib/format";
import { data, docHref, inventory, sceneModels, systemBySlug, systemConfigurations } from "@/lib/site";

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
    const ids = sys.slug === "corner-station" && sys.scene?.pose === "mounted"
        ? [...new Set([...sceneModels("corner-head"), ...sceneModels("winch")])]
        : sceneModels(sys.slug);
    const others = sys.models.filter((m) => !ids.includes(m.id));
    const from = sys.scene ? (sys.scene.source.kind === "release" ? sys.scene.source.tag ?? "CAD release" : sys.scene.source.kind === "local" ? "current local design package" : sys.scene.source.current ? "current committed booklet snapshot" : "archived booklet snapshot · earlier design") : "";
    const caption = !sys.scene
        ? ""
        : lineup
          ? `Parts laid out side by side · no assembly pose is registered · meshes from ${from}`
          : `${scene?.configuration ? `${scene.configuration} · ` : ""}${sys.scene.pose ? `Exploded pose: ${scene?.figureDir ? "booklet figure" : "CAD layout"} “${sys.scene.pose}”` : "Assembled only: no exploded figure in this pack"} · meshes from ${from}`;
    const doc = docHref(sys.documentation);
    const developmentDocs = sys.slug === "dock"
        ? ["assembly-guide", "booklet/README", "design-proposal", "design-package", "bench-test-plan", "acceptance-record"]
            .flatMap((name) => {
                const entry = site.docs.find((item) => item.path === `docs/assemblies/dock/${name}.md`);
                const href = entry && docHref(entry.path);
                return entry && href ? [{ ...entry, href }] : [];
            })
        : [];
    const layoutDoc = sys.slug === "control-cabinet" ? docHref("docs/assemblies/control-cabinet/layout-proposal.md") : null;
    const winch = sys.slug === "winch" || sys.slug === "winch-powered";
    return (
        <>
            <Crumb left={`${sys.number} · ${sys.name}`} right={scene ? (lineup ? "Parts layout · click a number" : sys.scene?.pose === "mounted" ? "Mounted assembly · post shortened" : "Exploded view · click a number") : ""} dark />
            <SystemExplorer
                number={sys.number}
                name={sys.name}
                scene={scene}
                cadPending={sys.models.length > 0}
                caption={sys.scene?.pose === "mounted" ? `Winch and pulley head mounted on one post · wavy break omits middle length · schematic heights · meshes from ${from}` : caption}
                nav={systems.map((s) => ({ slug: s.slug, number: s.number, name: s.name }))}
                current={sys.slug}
                navCurrent={sys.rootSlug}
                variants={winch || sys.slug === "corner-station" ? systemConfigurations(sys).map(({ slug, name }) => ({ slug, name })) : []}
                inventory={inventory(ids, !lineup, sys.scene?.pose === "mounted" ? undefined : sys.slug)}
                inventoryNote={lineup ? "Registered fabrication parts · quantities in the BOM" : sys.slug === "corner-station" ? "Parts per pulley head and ordinary winch · full set quantities and alternatives in the BOM below" : sys.slug === "control-cabinet" ? "Catalog components in the proposed cabinet · unselected protection and reserved spaces are illustrative" : `Quantities per configured ${sys.slug === "camera-pod" ? "pod" : sys.slug === "corner-head" ? "pulley post head" : sys.slug === "dock" ? "dock bench kit" : sys.slug === "winch-powered" ? "powered winch" : "ordinary winch"}`}
            >
                {children.length > 0 && (
                    <div className="border-b-2 border-ink px-4 py-8 sm:px-6">
                        <SubassemblyList assemblies={children} />
                    </div>
                )}
                <section className="grid gap-8 border-b-2 border-ink px-4 py-8 sm:px-6 lg:grid-cols-12">
                    <p className="text-[17px] leading-snug lg:col-span-5">{sys.description}</p>
                    <div className="border-t-2 border-ink lg:col-span-4">
                        {(
                            [
                                [winch ? "CAD files · full winch set" : sys.slug === "corner-station" ? "CAD files · supports" : "CAD files", sys.models.length],
                                [winch ? "BOM items / kits · full winch set" : sys.slug === "corner-station" ? "BOM items / kits · supports" : "BOM items / kits", sys.usages.length],
                                ...(sys.presentationGroup ? [] : [[winch ? "Known goods · full winch set" : sys.slug === "corner-station" ? "Known goods · supports only" : "Known goods", sys.goods ? fmt.eur(sys.goods) : "—"]] as const),
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
                        {layoutDoc && (
                            <Link href={layoutDoc} className="key mt-3 w-full justify-between">
                                Layout &amp; interfaces <span>→</span>
                            </Link>
                        )}
                    </div>
                </section>
                <SystemBom system={sys} />
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
