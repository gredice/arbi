import Link from "next/link";
import { type System } from "@/lib/site";
import { overviewCounts } from "@/lib/corner-overview";
import { SystemThumbnail } from "./SystemThumbnail";
import { SubassemblyList } from "./SubassemblyList";

export function ContentsList({ systems, assemblies }: { systems: System[]; assemblies: System[] }) {
    return (
        <div className="rule">
            {systems.map((s) => {
                const children = assemblies.filter((assembly) => assembly.parentAssemblyId === s.id);
                const counts = overviewCounts(s, assemblies);
                return (
                    <div key={s.slug} className="border-b border-ink">
                        <Link
                            href={`/systems/${s.slug}`}
                            className="grid grid-cols-[64px_1fr] items-center gap-4 py-4 hover:bg-sheet lg:grid-cols-[96px_1fr_160px_260px]"
                        >
                            <span className="cond text-[48px] leading-none">{s.number}</span>
                            <div>
                                <div className="cond text-[26px] leading-none">{s.name}</div>
                                <div className="mt-1 max-w-[60ch] text-[13px] text-grey">{s.description}</div>
                            </div>
                            <div className="tag hidden lg:block">
                                {counts.models} CAD files{children.length > 0 ? " across system" : ""}
                                <br />
                                {counts.bomLines} BOM items / kits
                            </div>
                            <div className={`${children.length > 0 ? "col-span-2 lg:col-span-1" : "hidden lg:grid"} text-center`}>
                                {s.scene?.hero ? <SystemThumbnail scene={s.scene} tall={s.slug === "corner-station"} /> : <span className="tag text-grey">{s.scene ? "3D parts layout" : s.models.length ? "CAD preview pending" : "no registered CAD"}</span>}
                                {s.slug === "corner-station" && <span className="tag text-grey">Winch + pulley head · post shortened</span>}
                            </div>
                        </Link>
                        {children.length > 0 && (
                            <div className="pb-6 pl-0 pt-2 sm:pl-20 md:pl-28">
                                <SubassemblyList assemblies={children} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
