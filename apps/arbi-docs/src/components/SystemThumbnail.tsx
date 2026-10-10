"use client";

import { useEffect, useRef } from "react";
import type { Scene, SceneMeta } from "@/lib/types";
import { Viewer } from "./three/viewer";
import { LoadingStatus } from "./three/loading-status";

/** Draw CAD at thumbnail resolution so outlines stay readable and the whole pose fits. */
export function SystemThumbnail({ scene, tall = false }: { scene: SceneMeta; tall?: boolean }) {
    const stage = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        let viewer: Viewer | undefined;
        let loading = new LoadingStatus(stage.current!);
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            fetch(`/data/${scene.file}`)
                .then((response) => {
                    if (!response.ok) throw new Error(`Scene: HTTP ${response.status}`);
                    return response.json() as Promise<Scene>;
                })
                .then(async (data) => {
                    if (!alive) return;
                    viewer = new Viewer(stage.current!, { style: "line", interactive: false, animate: false, outlineOpacity: 0.65 });
                    loading.dispose();
                    await viewer.loadScene(data);
                    if (alive) viewer.frame({ distance: 1.04, azimuth: data.pose === "mounted" ? 0.62 : -0.62 });
                })
                .catch(() => {
                    if (alive) {
                        viewer?.dispose();
                        loading.dispose();
                        loading = new LoadingStatus(stage.current!);
                        loading.unavailable();
                    }
                });
        });
        observer.observe(stage.current!);
        return () => {
            alive = false;
            observer.disconnect();
            loading.dispose();
            viewer?.dispose();
        };
    }, [scene]);

    return <div ref={stage} aria-hidden="true" className={`tag relative w-full ${tall ? "h-[240px]" : "h-[128px]"}`} />;
}
