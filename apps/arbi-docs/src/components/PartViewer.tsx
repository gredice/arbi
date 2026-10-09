"use client";

import { useEffect, useRef, useState } from "react";
import type { MeshRef, Vec3 } from "@/lib/types";
import { Viewer, type ViewerStyle } from "./three/viewer";

/** Single-part 3D view with booklet line art or the shaded product palette. */
export function PartViewer({ mesh, model, color, output, missing, approximate = false }: { mesh: MeshRef | null; model: string; color: Vec3; output: string; missing: string; approximate?: boolean }) {
    const stage = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<ViewerStyle>("line");
    const [dims, setDims] = useState<string>(mesh ? "" : missing);

    useEffect(() => {
        if (!mesh) return;
        const viewer = new Viewer(stage.current!, { style, autoRotate: true });
        let alive = true;
        viewer.loadModel(mesh, model, color).then((size) => {
            if (alive) setDims(`${approximate ? "Illustrative envelope" : "Envelope"} ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`);
        }).catch(() => {
            if (alive) setDims("Model could not be loaded");
        });
        return () => {
            alive = false;
            viewer.dispose();
        };
    }, [mesh, model, color, style, approximate]);

    return (
        <div ref={stage} className="part-viewer relative h-[72vh] min-h-[460px] border-ink lg:border-r-2">
            <div className="tag absolute top-3 left-4 right-4 z-10 break-words">{approximate ? "Approximate · needs rework" : "Fig."} — {output}</div>
            <div className="tag absolute bottom-16 left-4 right-4 z-10 sm:bottom-3 sm:right-auto">{dims}</div>
            {mesh && (
                <div className="absolute right-4 bottom-3 z-10 flex gap-1">
                    {(["line", "light"] as const).map((s) => (
                        <button key={s} type="button" className={s === style ? "key" : "key-line"} onClick={() => setStyle(s)}>
                            {s === "line" ? "Line" : "Shaded"}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
