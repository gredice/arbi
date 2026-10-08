import type { Scene } from "./types";

export type Step = { model: string; title: string; text: string };

// Select captions from the displayed assembly, which can be a current release
// or an older committed booklet snapshot. Registry membership alone does not
// mean that a model is installed in this scene.
export function coverSteps(scene: Scene): Step[] {
    const installed = new Set(scene.parts.filter((part) => part.registered).map((part) => part.model));
    const choices: Step[][] = [
        [{ model: "payload-rain-hood", title: "White shell", text: "A broad rounded crown over the fixed electronics. Four bolts from underneath; lift for service." }],
        ["payload-integrated-deck", "payload-electronics-deck"].map((model) => ({ model, title: "Fixed electronics", text: "Pi 3A+, converter and capacitor stay on the spider. Only the camera moves." })),
        [{ model: "payload-enclosure-base", title: "Rain tray", text: "Raised lip, downward harness ports and drain slots. A splash shield, not a seal." }],
        [{ model: "camera-pod-spider", title: "Four-line spider", text: "The cable spider is the primary chassis and the only tensile load path." }],
        [
            { model: "payload-integrated-gimbal-head", title: "Moving head", text: "The lower shield rotates with the internal carrier. Remove the upper stack to reach its four clamps for service." },
            { model: "payload-pan-fairing", title: "Pan fairing", text: "Removable lower shield; park pan at 45° before it comes off." },
        ],
        ["payload-integrated-gimbal-carrier", "payload-pan-yoke"].map((model) => ({ model, title: "Two-axis gimbal", text: "Pan ±90° and tilt 0–70° are targets, bounded by software limits and hard stops." })),
    ];
    return choices.flatMap((alternatives) => {
        const step = alternatives.find((candidate) => installed.has(candidate.model));
        return step ? [step] : [];
    });
}
