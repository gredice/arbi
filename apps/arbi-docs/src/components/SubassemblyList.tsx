import Link from "next/link";
import { type System, systemConfigurations } from "@/lib/site";
import { SystemThumbnail } from "./SystemThumbnail";

/** Show child assemblies beside their own configured previews and parts links. */
export function SubassemblyList({ assemblies }: { assemblies: System[] }) {
    if (assemblies.length === 0) return null;

    return (
        <section>
            <h2 className="tag">Included subassemblies</h2>
            {assemblies.map((assembly) => {
                const configurations = systemConfigurations(assembly);
                return (
                    <div key={assembly.id} className="mt-3 grid gap-6 border-t border-ink pt-4 lg:grid-cols-2">
                        <div>
                            <h3 className="cond text-[26px] leading-none">
                                <Link href={`/systems/${assembly.slug}`} className="hover:underline">{assembly.name} →</Link>
                            </h3>
                            <p className="mt-2 max-w-[60ch] text-[13px] text-grey">{assembly.description}</p>
                            <p className="tag mt-3">{assembly.models.length} CAD files · {assembly.usages.length} BOM items / kits</p>
                            <Link href={`/systems/${assembly.slug}${assembly.scene ? "#parts-inventory" : ""}`} className="key-line mt-4">Parts inventory →</Link>
                        </div>
                        <div className={`grid gap-3 ${configurations.length > 1 ? "sm:grid-cols-2" : ""}`}>
                            {configurations.map((configuration) => (
                                <Link key={configuration.slug} href={`/systems/${configuration.slug}`} className="border border-ink p-3 hover:bg-sheet">
                                    {configuration.scene ? (
                                        <SystemThumbnail scene={configuration.scene} />
                                    ) : (
                                        <div className="tag grid h-[128px] place-items-center text-grey">CAD preview pending</div>
                                    )}
                                    <div className="tag mt-2 flex items-center justify-between gap-2">
                                        <span>{configuration.name}</span><span aria-hidden="true">→</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
