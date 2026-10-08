"use client";

import Link from "next/link";
import type { InventoryItem } from "@/lib/types";

type Props = {
    items: InventoryItem[];
    numbered?: boolean;
    active?: string | null;
    onHover?: (id: string | null) => void;
};

/** IKEA-style parts inventory: numbered cells with booklet line art and installed quantity. */
export function InventoryGrid({ items, numbered = false, active = null, onHover }: Props) {
    return (
        <div className="grid grid-cols-2 border-t border-l border-ink sm:grid-cols-4 lg:grid-cols-7" onMouseLeave={() => onHover?.(null)}>
            {items.map((item, i) => (
                <Link
                    key={item.id}
                    href={`/parts/${item.id}`}
                    onMouseEnter={() => onHover?.(item.id)}
                    className="group flex min-h-[170px] flex-col border-r border-b border-ink p-3"
                >
                    <div className="flex justify-between">
                        {numbered ? (
                            <span className="mono grid size-6 place-items-center rounded-full border-[1.5px] border-ink text-[10px] font-semibold">{i + 1}</span>
                        ) : (
                            <span />
                        )}
                        <span className="cond text-[22px] leading-none">{item.count ? `${item.count}×` : ""}</span>
                    </div>
                    <div className="grid flex-1 place-items-center py-2">
                        {item.figure ? <img src={item.figure} alt="" loading="lazy" className="max-h-[86px]" /> : <span className="tag text-grey">no figure</span>}
                    </div>
                    <div className={`tag leading-tight break-words underline-offset-2 group-hover:underline group-focus-visible:underline ${active === item.id ? "underline" : ""}`}>{item.id}</div>
                </Link>
            ))}
        </div>
    );
}
