"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/types";
import type { Step } from "@/lib/cover-steps";
import { Viewer } from "./three/viewer";

/** Full-black cover: scrolling takes the pod apart along the booklet renderer's exploded pose. */
export function CoverTeardown({ scene, steps, date }: { scene: Scene; steps: Step[]; date: string }) {
    const router = useRouter();
    const cover = useRef<HTMLElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const lead = useRef<SVGLineElement>(null);
    const dot = useRef<SVGCircleElement>(null);
    const progress = useRef<HTMLDivElement>(null);
    const captions = useRef<(HTMLDivElement | null)[]>([]);
    const [step, setStep] = useState(-1);
    const stepRef = useRef(-1);

    useEffect(() => {
        const viewer = new Viewer(stage.current!, { style: "ink", autoRotate: true, fov: 24 });
        let alive = true;
        const onScroll = () => {
            const box = cover.current!.getBoundingClientRect();
            const t = Math.min(1, Math.max(0, -box.top / (box.height - innerHeight)));
            viewer.setExplode(Math.min(1, t * 1.2));
            const next = t > 0.04 ? Math.min(steps.length - 1, Math.floor(((t - 0.04) / 0.96) * steps.length)) : -1;
            if (next !== stepRef.current) {
                stepRef.current = next;
                setStep(next);
                viewer.setFocus(next >= 0 ? steps[next].model : null);
            }
            progress.current!.style.width = `${t * 100}%`;
        };
        viewer.on("pick", (p) => p.registered && router.push(`/parts/${p.model}`));
        // Leader line from the focused part to its caption.
        viewer.on("frame", () => {
            const i = stepRef.current;
            const anchor = i >= 0 ? viewer.anchors().find((a) => a.part.model === steps[i].model) : undefined;
            const caption = i >= 0 ? captions.current[i] : null;
            const show = Boolean(anchor && caption && innerWidth >= 768);
            lead.current!.style.opacity = dot.current!.style.opacity = show ? "1" : "0";
            if (!show) return;
            const c = caption!.getBoundingClientRect();
            const s = stage.current!.getBoundingClientRect();
            lead.current!.setAttribute("x1", String(anchor!.x));
            lead.current!.setAttribute("y1", String(anchor!.y));
            lead.current!.setAttribute("x2", String(c.left - s.left - 10));
            lead.current!.setAttribute("y2", String(c.top - s.top + 14));
            dot.current!.setAttribute("cx", String(anchor!.x));
            dot.current!.setAttribute("cy", String(anchor!.y));
        });
        viewer.loadScene(scene).then(() => {
            if (!alive) return;
            // camera-pod.scad: line-hole radius = 230 / 2 - 22 / 2,
            // at 45°, 135°, 225°, 315°; the spider's top face is Z = 7 / 2 mm.
            const hole = (230 / 2 - 22 / 2) / Math.SQRT2;
            viewer.addSuspensionLines("camera-pod-spider", [
                [hole, hole, 3.5], [-hole, hole, 3.5],
                [-hole, -hole, 3.5], [hole, -hole, 3.5],
            ]);
            viewer.setExplode(1);
            viewer.frame({ distance: 0.86, elevation: 0.22 });
            viewer.setExplode(0);
            viewer.settle();
            onScroll();
        });
        addEventListener("scroll", onScroll, { passive: true });
        return () => {
            alive = false;
            removeEventListener("scroll", onScroll);
            viewer.dispose();
        };
    }, [scene, steps, router]);

    return (
        <section ref={cover} className="relative h-[360vh] bg-ink text-paper">
            <div className="inked sticky top-0 h-screen overflow-hidden">
                <div ref={stage} className="absolute inset-0" />
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    <line ref={lead} stroke="#ffffff" strokeWidth={1} opacity={0} />
                    <circle ref={dot} r={3} fill="#ffffff" opacity={0} />
                </svg>
                <div className="pointer-events-none absolute top-6 left-0 px-4 sm:px-6">
                    <div className="tag text-paper/60">Open hardware · design baseline · {date}</div>
                    <h1 className="cond mt-4 text-[clamp(52px,7.4vw,132px)] leading-[0.82]">
                        Automatic
                        <br />
                        raised bed
                        <br />
                        imaging
                    </h1>
                </div>
                <p className="pointer-events-none absolute bottom-8 left-0 max-w-[44ch] px-4 text-[15px] leading-snug text-paper/80 sm:px-6">
                    A four-cable outdoor camera robot for repeatable images of raised beds. Every drawing, part and number here is compiled from the repository.
                </p>
                <div className="absolute right-4 bottom-8 hidden h-[150px] w-[300px] sm:right-6 md:block">
                    {steps.map((s, i) => (
                        <div
                            key={s.model}
                            ref={(el) => {
                                captions.current[i] = el;
                            }}
                            className={`absolute inset-x-0 bottom-0 transition-all duration-500 ${i === step ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="mono grid size-7 place-items-center rounded-full border-[1.5px] border-paper text-[11px] font-semibold">{i + 1}</span>
                                <span className="tag text-paper/60">
                                    {String(i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                                </span>
                            </div>
                            <div className="cond mt-3 text-[30px] leading-none">{s.title}</div>
                            <p className="mt-2 text-[13px] text-paper/70">{s.text}</p>
                            <Link href={`/parts/${s.model}`} className="tag mt-3 inline-block underline">
                                {s.model} →
                            </Link>
                        </div>
                    ))}
                </div>
                <div className={`tag absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-paper/60 transition-opacity ${step >= 0 ? "opacity-0" : ""}`}>
                    Scroll to disassemble
                    <br />↓
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
                    <div ref={progress} className="h-full w-0 bg-paper" />
                </div>
            </div>
        </section>
    );
}
