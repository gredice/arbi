"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { InventoryItem, Scene } from "@/lib/types";
import { InventoryGrid } from "./InventoryGrid";
import { layoutCallouts, Viewer } from "./three/viewer";

type Props = {
    number: string;
    name: string;
    scene: Scene | null;
    caption: string;
    nav: { slug: string; number: string; name: string }[];
    current: string;
    variants: { slug: string; name: string }[];
    inventory: InventoryItem[];
    inventoryNote: string;
    children: ReactNode;
};

/** Black exploded-view stage with numbered bubbles, hover-synced with the parts inventory. */
export function SystemExplorer({ number, name, scene, caption, nav, current, variants, inventory, inventoryNote, children }: Props) {
    const router = useRouter();
    const stage = useRef<HTMLDivElement>(null);
    const calls = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const [active, setActive] = useState<string | null>(null);
    const [canExplode, setCanExplode] = useState(false);
    const ids = inventory.map((i) => i.id);

    useEffect(() => {
        if (!scene) return;
        const viewer = new Viewer(stage.current!, { style: "ink" });
        viewerRef.current = viewer;
        let alive = true;
        const index = new Map(ids.map((id, i) => [id, i]));
        const layer = calls.current!;
        const lines = [...layer.querySelectorAll<SVGLineElement>("line[data-m]")];
        const bubbles = [...layer.querySelectorAll<HTMLElement>(".bubble")];
        viewer.on("frame", () => {
            const focus = viewer.hovered?.part.model ?? viewer.focus;
            const anchors = viewer.anchors().filter((a) => index.has(a.part.model));
            for (const x of layoutCallouts(anchors, layer.clientWidth)) {
                const i = index.get(x.part.model)!;
                const line = lines[i];
                line.setAttribute("x1", String(x.x));
                line.setAttribute("y1", String(x.y));
                line.setAttribute("x2", String(x.lx));
                line.setAttribute("y2", String(x.ly));
                line.style.opacity = !focus || focus === x.part.model ? "1" : "0.15";
                bubbles[i].style.left = `${x.lx}px`;
                bubbles[i].style.top = `${x.ly}px`;
                bubbles[i].style.visibility = "visible";
                bubbles[i].classList.toggle("on", focus === x.part.model);
            }
        });
        viewer.on("hover", (p) => setActive(p?.registered ? p.model : null));
        viewer.on("pick", (p) => p.registered && router.push(`/parts/${p.model}`));
        viewer.loadScene(scene).then(() => {
            if (!alive) return;
            const lineup = scene.layout === "lineup";
            viewer.setExplode(1);
            viewer.frame({ distance: 1.05, elevation: lineup ? 0.35 : scene.kind === "glb" ? 0.22 : 0.5 });
            setCanExplode(viewer.canExplode);
        });
        return () => {
            alive = false;
            viewer.dispose();
            viewerRef.current = null;
        };
        // ids derive from the scene, so the scene identity is the dependency.
    }, [scene, router]);

    const focus = (id: string | null) => {
        viewerRef.current?.setFocus(id);
        setActive(id);
    };

    return (
        <>
            <section className="inked relative h-[calc(100vh-90px)] min-h-[560px] bg-ink text-paper">
                <div ref={stage} className="absolute inset-0" />
                {scene ? (
                    <div ref={calls} className="pointer-events-none absolute inset-0 z-10 hidden md:block" onMouseLeave={() => focus(null)}>
                        <svg className="absolute inset-0 h-full w-full">
                            {ids.map((id) => (
                                <line key={id} data-m={id} stroke="#ffffff" strokeWidth={1} />
                            ))}
                        </svg>
                        {ids.map((id, i) => (
                            <Link key={id} href={`/parts/${id}`} className="bubble" style={{ visibility: "hidden" }} onMouseEnter={() => focus(id)}>
                                {i + 1}
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="absolute inset-0 grid place-items-center">
                        <div className="text-center">
                            <div className="cond text-[28px]">No registered CAD</div>
                            <p className="mt-2 max-w-[42ch] text-paper/60">This assembly has no OpenSCAD models in hardware/models.json yet. Its documentation and BOM lines are below.</p>
                        </div>
                    </div>
                )}
                <div className="pointer-events-none absolute top-6 left-0 z-20 px-4 sm:px-6">
                    <div className="cond text-[96px] leading-[0.8]">{number}</div>
                    <h1 className="cond mt-3 text-[48px] leading-[0.9]">{name}</h1>
                    {variants.length > 0 && (
                        <nav aria-label="Winch configuration" className="pointer-events-auto mt-4 flex flex-wrap gap-2">
                            {variants.map((variant) => (
                                <Link key={variant.slug} href={`/systems/${variant.slug}`} aria-current={variant.slug === current ? "page" : undefined}
                                    className={`tag border border-paper px-3 py-2 ${variant.slug === current ? "bg-paper text-ink" : "hover:bg-paper hover:text-ink"}`}>
                                    {variant.name}
                                </Link>
                            ))}
                        </nav>
                    )}
                </div>
                <div className="absolute bottom-6 left-0 z-20 flex flex-wrap items-center gap-2 px-4 sm:px-6">
                    {canExplode && (
                        <label className="flex items-center gap-3 border border-paper px-3 py-2">
                            <span className="tag">Assembled</span>
                            <input aria-label="Assembly explosion" type="range" min={0} max={1} step={0.01} defaultValue={1} className="w-40 accent-white" onChange={(e) => viewerRef.current?.setExplode(Number(e.target.value))} />
                            <span className="tag">Exploded</span>
                        </label>
                    )}
                    {caption && <span className="tag max-w-[60ch] text-paper/60">{caption}</span>}
                </div>
                <nav className="absolute right-4 bottom-6 z-20 hidden gap-1 sm:right-6 md:flex">
                    {nav.map((s) => (
                        <Link
                            key={s.slug}
                            href={`/systems/${s.slug}`}
                            title={s.name}
                            className={`tag border border-paper/40 px-2.5 py-1.5 ${s.slug === current || (current === "winch-powered" && s.slug === "winch") ? "bg-paper text-ink" : "text-paper/70 hover:text-paper"}`}
                        >
                            {s.number}
                        </Link>
                    ))}
                </nav>
            </section>
            {children}
            {inventory.length > 0 && (
                <section className="mt-10 px-4 sm:px-6">
                    <div className="flex items-end justify-between">
                        <h2 className="cond text-[34px] leading-none">Parts inventory</h2>
                        <span className="tag">{inventoryNote}</span>
                    </div>
                    <div className="mt-4">
                        <InventoryGrid items={inventory} numbered active={active} onHover={focus} />
                    </div>
                </section>
            )}
        </>
    );
}
