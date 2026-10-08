"use client";

import { useEffect, useRef } from "react";
import type { Scene, SceneMeta } from "@/lib/types";
import { Viewer } from "./three/viewer";

/** Draw CAD at thumbnail resolution so outlines stay readable and the whole pose fits. */
export function SystemThumbnail({ scene }: { scene: SceneMeta }) {
    const stage = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        let viewer: Viewer | undefined;
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
                    await viewer.loadScene(data);
                    if (alive) viewer.frame({ distance: 1.04 });
                })
                .catch(() => {
                    if (alive) {
                        viewer?.dispose();
                        stage.current!.textContent = "3D preview unavailable";
                    }
                });
        });
        observer.observe(stage.current!);
        return () => {
            alive = false;
            observer.disconnect();
            viewer?.dispose();
        };
    }, [scene]);

    return <div ref={stage} aria-hidden="true" className="tag h-[128px] w-full" />;
}
