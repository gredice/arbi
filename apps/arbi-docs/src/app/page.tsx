import Link from "next/link";
import { ContentsList } from "@/components/ContentsList";
import { CoverTeardown } from "@/components/CoverTeardown";
import { Crumb } from "@/components/Crumb";
import { coverSteps } from "@/lib/cover-steps";
import { fmt } from "@/lib/format";
import { data } from "@/lib/site";

export default function Home() {
    const { site, scenes, systems, models } = data();
    const sum = site.bom.summary;
    const stats: [string | number, string][] = [
        [models.length, "CAD models"],
        [site.bom.parts.length, "BOM items"],
        [site.docs.length, "Documents"],
        [fmt.eur(sum.knownSubtotal), "Known partial cost"],
    ];
    return (
        <>
            <Crumb left="Cover" right={`Rev ${site.commit.slice(0, 7)}`} dark />
            <CoverTeardown scene={scenes["camera-pod"]} steps={coverSteps(scenes["camera-pod"])} date={site.commitDate} />
            <section className="grid grid-cols-2 border-b-2 border-ink px-4 sm:px-6 md:grid-cols-4">
                {stats.map(([n, l], i) => (
                    <div key={l} className={`py-6 ${i ? "border-ink md:border-l md:pl-6" : ""}`}>
                        <div className="cond text-[48px] leading-none">{n}</div>
                        <div className="tag mt-1">{l}</div>
                    </div>
                ))}
            </section>
            <section className="mt-12 px-4 sm:px-6">
                <div className="flex items-end justify-between">
                    <h2 className="cond text-[40px] leading-none">Contents</h2>
                    <span className="tag">{systems.length} physical assemblies</span>
                </div>
                <div className="mt-4">
                    <ContentsList systems={systems} />
                </div>
            </section>
            <section className="mt-16 mb-20 px-4 sm:px-6">
                <div className="grid border-2 border-ink lg:grid-cols-12">
                    <figure className="border-b-2 border-ink lg:col-span-8 lg:border-r-2 lg:border-b-0">
                        <div className="bg-ink p-3 sm:p-4">
                            <img src="/data/docs/assets/arbi-cover.png" alt="ARBI concept over raised beds" className="h-auto w-full" />
                        </div>
                        <figcaption className="tag border-t border-ink p-3">Concept imagery. Not a built installation.</figcaption>
                    </figure>
                    <div className="flex flex-col p-6 lg:col-span-4">
                        <div className="tag">Bill of materials · {sum.destinationName}</div>
                        <div className="cond mt-auto text-[64px] leading-none">{fmt.eur(sum.knownSubtotal)}</div>
                        <div className="tag mt-2">Known partial subtotal · not the project cost</div>
                        <Link href="/bom" className="key mt-6 justify-between">
                            Open BOM <span>→</span>
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
