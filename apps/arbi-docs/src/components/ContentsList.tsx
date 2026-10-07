import Link from "next/link";
import type { System } from "@/lib/site";

export function ContentsList({ systems }: { systems: System[] }) {
    return (
        <div className="rule">
            {systems.map((s) => (
                <Link
                    key={s.slug}
                    href={`/systems/${s.slug}`}
                    className="grid grid-cols-[64px_1fr_auto] items-center gap-4 border-b border-ink py-4 hover:bg-sheet md:grid-cols-[96px_1fr_160px_220px]"
                >
                    <span className="cond text-[48px] leading-none">{s.number}</span>
                    <div>
                        <div className="cond text-[26px] leading-none">{s.name}</div>
                        <div className="mt-1 max-w-[60ch] text-[13px] text-grey">{s.description}</div>
                    </div>
                    <div className="tag hidden md:block">
                        {s.models.length} models
                        <br />
                        {s.usages.length} BOM lines
                    </div>
                    <div className="hidden h-[96px] place-items-center md:grid">
                        {s.scene?.hero ? <img src={`/data/${s.scene.hero}`} alt="" loading="lazy" className="max-h-[96px]" /> : <span className="tag text-grey">{s.scene ? "3D parts layout" : "no registered CAD"}</span>}
                    </div>
                </Link>
            ))}
        </div>
    );
}
