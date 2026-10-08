import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Keep native scrolling and pinch zoom available over every embedded model. */
export function configurePageControls(controls: OrbitControls) {
    controls.enableZoom = false;
    controls.touches = { ONE: null, TWO: null };
    // OrbitControls.connect() sets this to none, so apply it after construction.
    controls.domElement!.style.touchAction = "pan-y pinch-zoom";
}
