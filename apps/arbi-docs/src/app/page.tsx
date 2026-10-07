import { readFileSync } from "node:fs";
import { join } from "node:path";

type Site = {
    commit: string;
    commitDate: string;
    registry: { models: unknown[] };
    bom: { parts: unknown[] };
    docs: unknown[];
};

// Compiled at build time by scripts/compile-data.mjs from committed repository sources.
function loadSite(): Site {
    return JSON.parse(readFileSync(join(process.cwd(), "public/mockups/data/site.json"), "utf8")) as Site;
}

const directions = [
    {
        key: "D · proposed",
        name: "Manual + Ink",
        href: "/mockups/d-manual-ink.html",
        text: "C's white manual system for most pages. Exploded views get full-black inverted sections, and the cover is B's scroll teardown drawn as inverted line art.",
        card: "bg-ink text-white border-2 border-ink md:col-span-3 min-h-[220px]! hover:bg-black",
        mute: "text-white/70",
    },
    {
        key: "A",
        name: "Index",
        href: "/mockups/a-index.html",
        text: "Warm off-white catalogue in rounded tiles, small mono labels and numbered callouts. Shaded product renders. The closest to teenage.engineering.",
        card: "rounded-2xl bg-tile hover:bg-white",
        mute: "text-mute",
    },
    {
        key: "B",
        name: "Studio",
        href: "/mockups/b-studio.html",
        text: "Near-black and full-bleed. Scrolling the home page takes the pod apart. Hover HUD instead of labels; line art is inverted to suit the dark theme.",
        card: "rounded-2xl bg-[#09090a] text-[#efeee9] hover:bg-black",
        mute: "text-[#85858a]",
    },
    {
        key: "C",
        name: "Manual",
        href: "/mockups/c-manual.html",
        text: "Pure white with heavy rules and condensed type. 3D is drawn as live line art in the booklet style, with IKEA-style bubbles and an inventory grid.",
        card: "bg-white border-2 border-ink hover:bg-[#f4f4f2]",
        mute: "text-ink",
    },
];

export default function Home() {
    const site = loadSite();
    return (
        <main className="mx-auto max-w-[1400px] p-4 sm:p-8">
            <div className="label">ARBI · website direction mockups</div>
            <h1 className="mt-3 text-[48px] font-light leading-none tracking-tight">Pick a direction</h1>
            <p className="mt-4 max-w-[70ch] text-[15px] text-[#4a4a48]">
                All three share one data layer compiled from the repository at build time: the CAD registry, BOM report, documents and booklet meshes. Each has a home page, system exploded views, part pages with a 3D viewer, the BOM, documents and downloads.
            </p>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
                {directions.map((d) => (
                    <a key={d.key} href={d.href} className={`flex min-h-[300px] flex-col p-6 ${d.card}`}>
                        <div className={`font-mono text-[11px] uppercase tracking-widest ${d.mute}`}>{d.key}</div>
                        <div className="mt-auto text-[28px] font-light">{d.name}</div>
                        <p className={`mt-2 text-[14px] ${d.mute}`}>{d.text}</p>
                    </a>
                ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 label">
                <span>{site.registry.models.length} CAD models</span>
                <span>{site.bom.parts.length} BOM items</span>
                <span>{site.docs.length} documents</span>
                <a className="underline" href={`https://github.com/gredice/arbi/commit/${site.commit}`}>
                    Built from {site.commit.slice(0, 7)} · {site.commitDate}
                </a>
            </div>
        </main>
    );
}
