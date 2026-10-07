import type { ReactNode } from "react";

export function Crumb({ left, right, dark = false }: { left: ReactNode; right?: ReactNode; dark?: boolean }) {
    return (
        <div className={`tag flex h-8 items-center justify-between border-b px-4 sm:px-6 ${dark ? "border-white/15 bg-ink text-paper/70" : "border-ink"}`}>
            <span className="truncate">{left}</span>
            <span className="shrink-0">{right}</span>
        </div>
    );
}
