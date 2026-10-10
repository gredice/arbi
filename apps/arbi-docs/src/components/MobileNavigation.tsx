"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function MobileNavigation({ items }: { items: readonly (readonly [string, string])[] }) {
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const dismiss = (event: PointerEvent) => {
            if (!container.current?.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
                button.current?.focus();
            }
        };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("pointerdown", dismiss);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    return (
        <div ref={container} className="relative ml-auto md:hidden">
            <button ref={button} type="button" aria-expanded={open} aria-controls="mobile-navigation"
                onClick={() => setOpen((value) => !value)} className="key-line">
                Menu <span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            {open && (
                <nav id="mobile-navigation" aria-label="Mobile navigation" className="tag absolute right-0 top-full mt-2 w-56 border-2 border-ink bg-paper p-2 shadow-lg">
                    {items.map(([href, label]) => (
                        <Link key={href} href={href} onClick={() => setOpen(false)} className="block px-3 py-3 hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper">
                            {label}
                        </Link>
                    ))}
                </nav>
            )}
        </div>
    );
}
