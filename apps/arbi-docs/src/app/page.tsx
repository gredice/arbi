import Link from "next/link";
import { ContentsList } from "@/components/ContentsList";
import { CoverTeardown, type Step } from "@/components/CoverTeardown";
import { Crumb } from "@/components/Crumb";
import { fmt } from "@/lib/format";
import { data } from "@/lib/site";

// Captions for the teardown; the parts and their poses come from the booklet scene.
const STEPS: Step[] = [
    { model: "payload-rain-hood", title: "White shell", text: "A broad rounded crown over the fixed electronics. Four bolts from underneath; lift for service." },
    { model: "payload-electronics-deck", title: "Fixed electronics", text: "Pi 3A+, converter and capacitor stay on the spider. Only the camera moves." },
    { model: "payload-enclosure-base", title: "Rain tray", text: "Raised lip, downward harness ports and drain slots. A splash shield, not a seal." },
    { model: "camera-pod-spider", title: "Four-line spider", text: "The cable spider is the primary chassis and the only tensile load path." },
    { model: "payload-pan-fairing", title: "Pan fairing", text: "Removable lower shield; park pan at 45° before it comes off." },
    { model: "payload-pan-yoke", title: "Two-axis gimbal", text: "Pan ±90° and tilt 0–70° are targets, bounded by software limits and hard stops." },
];

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
            <CoverTeardown scene={scenes["camera-pod"]} steps={STEPS.filter((s) => models.some((m) => m.id === s.model))} date={site.commitDate} />
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
                        <img src="/data/docs/assets/arbi-cover.png" alt="ARBI concept over raised beds" className="aspect-[2.4/1] w-full object-cover grayscale" />
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
