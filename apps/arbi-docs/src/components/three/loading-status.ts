import type { LoadProgress } from "./progressive-load";

/** Lives beside the canvas so progress never blocks orbit, scrolling or partially loaded CAD. */
export class LoadingStatus {
    private element = document.createElement("div");
    private label = document.createElement("span");

    constructor(host: HTMLElement, dark = false) {
        this.element.className = `viewer-loading tag${dark ? " viewer-loading-dark" : ""}`;
        this.element.setAttribute("role", "status");
        const spinner = document.createElement("span");
        spinner.className = "viewer-loading-spinner";
        spinner.setAttribute("aria-hidden", "true");
        this.element.append(spinner, this.label);
        this.label.textContent = "Loading 3D model…";
        host.appendChild(this.element);
    }

    update({ loaded, failed, total }: LoadProgress) {
        const done = loaded + failed === total;
        this.element.hidden = done && failed === 0;
        this.element.classList.toggle("viewer-loading-error", done && failed > 0);
        this.label.textContent = done && failed > 0
            ? loaded > 0 ? `${loaded} / ${total} parts shown · ${failed} unavailable` : "3D model unavailable"
            : `Loading parts · ${loaded} / ${total}`;
    }

    unavailable() {
        this.update({ loaded: 0, failed: 1, total: 1 });
    }

    dispose() {
        this.element.remove();
    }
}
