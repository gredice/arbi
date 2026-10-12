import type { Metadata } from "next";
import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { WarningBadges, WarningList } from "@/components/Warnings";
import { fmt } from "@/lib/format";
import { data } from "@/lib/site";
import { uniqueWarnings, warningLabels, warningPriorities } from "@/lib/warnings";

export const metadata: Metadata = { title: "Bill of materials" };

export default function Bom() {
    const { site } = data();
    const sum = site.bom.summary;
    const lines = site.bom.parts.flatMap((p) => p.usedIn.length
        ? p.usedIn.map((u) => ({ ...p, group: u.assemblyId, required: u.quantity, knownGoods: u.knownGoodsAmount }))
        : [{ ...p, group: "not in v1 build" }]);
    const groups = Map.groupBy(lines, (p) => p.group);
    const buildWarnings = sum.warningDetails.filter((warning) => warning.partIds.length === 0 && warning.assemblyIds.length === 0);
    const head: [string, string][] = [
        [fmt.eur(sum.estimatedPartialSubtotal), "Estimated partial subtotal"],
        ["Unavailable", "Complete landed total"],
        [fmt.eur(sum.estimatedMaterialSubtotal), "Estimated print materials"],
        [warningPriorities.map((severity) => sum.warningCounts[severity]).join(" / "), warningPriorities.map((severity) => warningLabels[severity]).join(" / ")],
    ];
    return (
        <>
            <Crumb left="Bill of materials" right={sum.scenarioId} />
            <div className="px-4 pb-20 sm:px-6">
                <section className="grid gap-6 border-b-2 border-ink py-8 lg:grid-cols-12">
                    <h1 className="cond text-[60px] leading-[0.85] sm:text-[88px] lg:col-span-6">
                        Bill of
                        <br />
                        materials
                    </h1>
                    <div className="grid grid-cols-2 self-end border-t-2 border-ink lg:col-span-6">
                        {head.map(([n, l], i) => (
                            <div key={l} className={`border-b border-ink py-3 ${i % 2 ? "border-l pl-4" : ""}`}>
                                <div className="cond text-[clamp(22px,6.2vw,34px)] leading-none sm:text-[34px]">{n}</div>
                                <div className="tag mt-1">{l}</div>
                            </div>
                        ))}
                    </div>
                </section>
                <p className="tag border-b border-ink py-3">
                    Status: {sum.complete ? "complete" : "incomplete"} · {sum.destinationName} · quote {sum.quoteSnapshotId} · null values are never treated as zero
                </p>
                <p className="border-b border-hair py-3 text-[13px]">
                    Includes {fmt.eur(sum.knownGoodsSubtotal)} known goods, {fmt.eur(sum.knownShippingSubtotal)} known shipping, {fmt.eur(sum.knownCustomsSubtotal)} known customs and {fmt.eur(sum.estimatedMaterialSubtotal)} estimated print materials.
                    Printed weights use solid CAD volume and each component's material density. Eligible PLA/PETG prices assume a Bambu Lab bulk order of 10+ mixed eligible rolls with spools; ASA uses its evidenced single-spool price.
                    Supports, purge, failed prints, energy, machine time, labour, filament shipping and destination VAT adjustments remain unresolved.
                    Bundle goods are allocated by purchased part count, including surplus. Allocated shares are not individual supplier prices; shipping stays separate.
                </p>
                <p className="mt-4 max-w-4xl text-sm">
                    <strong>Critical:</strong> unknown dimensions, approximate geometry, missing manufacturing specifications and temporary workarounds. Resolve these before dependent assembly design; cable ties must be replaced for the final assembly.
                    {" "}<strong>Warning:</strong> unconfirmed designs, concepts and selections awaiting review.
                    {" "}<strong>Issues:</strong> price, tax/VAT, shipping, availability and observation dates; resolve procurement details when the design and parts are confirmed. Expand the priorities below each table to review that system.
                </p>
                {[...groups].map(([group, list]) => {
                    const name = site.bom.assemblies.find((a) => a.id === group)?.name ?? group;
                    const partIds = new Set(list.map((part) => part.id));
                    const warnings = uniqueWarnings([
                        ...list.flatMap((part) => part.warningDetails),
                        ...sum.warningDetails.filter((warning) => warning.partIds.length === 0 && warning.assemblyIds.includes(group)),
                    ]).map((warning) => ({ ...warning, partIds: warning.partIds.filter((id) => partIds.has(id)) }));
                    return <section key={group} className="mt-10" aria-label={name}>
                        <div className="flex items-end justify-between">
                            <h2 className="cond text-[30px] leading-none">{name}</h2>
                            <span className="tag">
                                {list.length} items · {fmt.eur(sum.assemblyPartialGoods.find((x) => x.assemblyId === group)?.amount)}
                                {sum.assemblyEstimatedMaterials.some((x) => x.assemblyId === group) ? " incl. estimates" : ""}
                            </span>
                        </div>
                        <table className="mt-3 w-full table-fixed border-t-2 border-ink text-[13px]">
                            <thead>
                                <tr className="tag border-b border-ink text-left">
                                    <th className="w-10 py-2">#</th>
                                    <th>Item</th>
                                    <th className="hidden lg:table-cell lg:w-56 xl:w-80">Priorities</th>
                                    <th className="w-14 text-right">Qty</th>
                                    <th className="hidden pl-6 md:table-cell md:w-[16%]">Supplier</th>
                                    <th className="hidden md:table-cell md:w-[17%]">Qualification</th>
                                    <th className="w-24 text-right">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((p, i) => (
                                    <tr key={p.id} className="border-b border-hair hover:bg-sheet">
                                        <td className="mono py-2">{fmt.pad(i + 1)}</td>
                                        <td className="py-3 pr-4 [overflow-wrap:anywhere]">
                                            <Link href={`/bom/${p.id}`} className="hover:underline">
                                                {p.name}
                                            </Link>
                                            <span className="lg:hidden"><WarningBadges warnings={p.warningDetails} /></span>
                                        </td>
                                        <td className="hidden pr-4 [&>span]:mt-0 lg:table-cell">
                                            {p.warningDetails.length > 0 ? <WarningBadges warnings={p.warningDetails} /> : <span aria-label="No issues">—</span>}
                                        </td>
                                        <td className="mono text-right">
                                            {p.required ?? "—"}
                                            {p.unit === "each" ? "" : ` ${p.unit}`}
                                        </td>
                                        <td className="tag hidden pl-6 pr-4 [overflow-wrap:anywhere] md:table-cell">{p.supplierId ?? "—"}</td>
                                        <td className="tag hidden pr-4 [overflow-wrap:anywhere] md:table-cell">{fmt.status(p.qualification ?? "no offer")}</td>
                                        <td className="mono text-right">
                                            {p.printEstimate ? <><span>{fmt.eur(p.printEstimate.materialCost)}</span><div className="tag text-[10px]">est. material</div></>
                                                : p.knownGoods !== null ? fmt.eur(p.knownGoods) : "—"}
                                            {p.goodsAllocationBasis === "part-count" && <span className="tag block text-[9px]">Bundle share</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div aria-label={`${name} issues`}>
                            <WarningList warnings={warnings} linkTo="bom" />
                        </div>
                    </section>;
                })}
                {buildWarnings.length > 0 && <section className="mt-10" aria-label="Build-wide issues">
                    <h2 className="cond text-[30px] leading-none">Build-wide issues</h2>
                    <WarningList warnings={buildWarnings} linkTo="bom" />
                </section>}
            </div>
        </>
    );
}
