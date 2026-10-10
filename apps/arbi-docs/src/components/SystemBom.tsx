import Link from "next/link";
import { data, modelsForBomPart, type System } from "@/lib/site";
import { fmt } from "@/lib/format";
import { descendantIds } from "@/lib/corner-overview";

/** Direct owners and descendants share one deduplicated BOM, including kit contents. */
export function SystemBom({ system }: { system: System }) {
    const { assemblies, bomById } = data();
    const included = descendantIds(system.id, assemblies);
    const partIds = [...new Set(assemblies.filter((owner) => included.has(owner.id)).flatMap((owner) => owner.usages.map((usage) => usage.partId)))];
    const parts = partIds.map((id) => bomById.get(id)!);
    const pending = parts.filter((part) => part.knownGoods === null && (part.printEstimate ?? part.printReference)?.materialCost == null).length;
    return (
        <section id="system-bom" className="scroll-mt-24 border-b-2 border-ink px-4 py-8 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="cond text-[30px]">Bill of materials</h2>
                <span className="tag">{parts.length} items / kits · {pending} prices unresolved</span>
            </div>
            <p className="mt-2 max-w-4xl text-[13px] text-grey">CAD files include kit components, alternatives, test pieces and assembly references. BOM items can contain several parts. Expand a kit to see its print quantities and material costs. Quantities and quoted goods below cover the current V1 build; optional and deferred items remain excluded.</p>
            <p className="mt-2 max-w-4xl text-[13px] text-grey">Print costs estimate plastic consumption. Labour, machine time, supports, failed prints and delivery remain unresolved. Shared fastener and cable-gland assortments are purchasing stock; reconcile them with installed kits before ordering.</p>
            <div className="mt-5 border-t-2 border-ink">
                {parts.map((part) => {
                    const print = part.printEstimate ?? part.printReference;
                    const models = modelsForBomPart(part.id);
                    const components = print?.components ?? [];
                    const optional = part.required === null;
                    const price = part.knownGoods !== null ? `${fmt.eur(part.knownGoods)} quoted goods${part.bundle ? " · bundle share" : ""}`
                        : print?.materialCost != null ? `${fmt.eur(print.materialCost)} material estimate${optional ? " · reference" : ""}` : "Price unresolved";
                    return (
                        <details key={part.id} className="group border-b border-ink">
                            <summary className="grid cursor-pointer gap-2 py-4 sm:grid-cols-[1fr_120px_220px]">
                                <span><span className="cond text-[21px]">{part.name}</span><span className="tag ml-2" aria-hidden="true"><span className="group-open:hidden">+</span><span className="hidden group-open:inline">−</span></span></span>
                                <span className="tag">{optional ? "Excluded from V1" : `${part.required} ${part.unit} in V1`}</span>
                                <span className="mono text-[12px] sm:text-right">{price}</span>
                            </summary>
                            <div className="pb-5 text-[13px]">
                                <Link href={`/bom/${part.id}`} className="underline">Requirements, sourcing and price evidence →</Link>
                                {part.notes && <p className="mt-3 max-w-4xl text-grey">{part.notes}</p>}
                                {components.length > 0 ? (
                                    <div className="mt-4">
                                        <p className="tag">Print components · {print!.required} BOM unit(s){optional ? " · excluded reference" : ""}</p>
                                        {components.map((component) => (
                                            <div key={component.modelId} className="mt-2 grid gap-1 border-t border-hair py-2 sm:grid-cols-[1fr_70px_180px_100px]">
                                                <Link href={`/parts/${component.modelId}`} className="min-w-0 break-words underline">{component.modelId}</Link>
                                                <span className="mono">× {component.quantity}</span>
                                                <a href={component.priceSourceUrl} className="underline" target="_blank" rel="noreferrer">{component.name.replace("Bambu Lab ", "")} · {component.color ?? "unspecified"}</a>
                                                <span className="mono sm:text-right">{component.materialCost === null ? "Unresolved" : `€${component.materialCost}`} est.</span>
                                            </div>
                                        ))}
                                        <p className="mt-2 text-grey">Component amounts retain four decimal places; the kit estimate rounds material groups to cents. Price conditions and observation dates are on the BOM item page.</p>
                                    </div>
                                ) : models.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                                        {models.map((model) => <Link key={model.id} href={`/parts/${model.id}`} className="underline">{model.id} →</Link>)}
                                    </div>
                                )}
                                {models.some((model) => model.artifactRole === "fabrication" && !components.some((component) => component.modelId === model.id)) && (
                                    <p className="mt-3 text-grey">Additional source models include optional test pieces or alternative configurations outside this recipe. <Link className="underline" href={`/parts/${part.id}`}>All linked models →</Link></p>
                                )}
                            </div>
                        </details>
                    );
                })}
            </div>
            <Link href="/bom" className="key-line mt-5">Complete build BOM and shared procurement stock →</Link>
        </section>
    );
}
