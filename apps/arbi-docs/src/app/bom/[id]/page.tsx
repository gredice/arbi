import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Crumb } from "@/components/Crumb";
import { InventoryGrid } from "@/components/InventoryGrid";
import { GeometryNotice } from "@/components/GeometryNotice";
import { fmt } from "@/lib/format";
import { data, inventory, modelsForBomPart } from "@/lib/site";

export const dynamicParams = false;
export const generateStaticParams = () => data().site.bom.parts.map((p) => ({ id: p.id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const p = data().bomById.get((await params).id);
    return { title: p?.name };
}

export default async function BomItem({ params }: { params: Promise<{ id: string }> }) {
    const p = data().bomById.get((await params).id);
    if (!p) notFound();
    const models = modelsForBomPart(p.id);
    const fab = models.filter((model) => model.artifactRole === "fabrication");
    const print = p.printEstimate ?? p.printReference;
    const rows: [string, ReactNode][] = [
        ["Part / 3D model", <Link className="underline" href={`/parts/${p.id}`}>{p.name}</Link>],
        ["Used in", p.usedIn.map((u) => `${u.assemblyId} × ${u.quantity}`).join(", ") || "—"],
        ["Offer", p.offerId ?? "—"],
        ["Supplier", p.supplierId ?? "—"],
        ["Qualification", fmt.status(p.qualification)],
        ["Purchase units", p.purchaseUnits ?? "—"],
        ...(p.actualDelivered ? [["Actual delivered total", `${p.actualDelivered.currency} ${p.actualDelivered.amount} for ${p.actualDelivered.quantity} pieces — all charges included`]] as [string, ReactNode][] : []),
        ...(p.actualDelivered?.importCharges ? [["Actual import charges", `${p.actualDelivered.currency} ${p.actualDelivered.importCharges} for the batch — included in delivered total`]] as [string, ReactNode][] : []),
        ["Unit price", p.quotedPrice ? `${p.quotedPrice.currency} ${p.quotedPrice.amount} / ${p.quotedPrice.basis === "base-unit" ? p.unit : "purchase unit"}` : "—"],
        ["Price observed", p.observedAt?.slice(0, 10) ?? "—"],
        ["Delivery", p.delivery ? (p.delivery.amount === "0" ? "Free" : `${p.delivery.currency} ${p.delivery.amount}`) : "Unknown"],
        ["Customs", p.customsPolicy ? `${p.customsPolicy.currency} ${p.customsPolicy.amount} per item type per order (not per piece), order goods under ${p.customsPolicy.currency} ${p.customsPolicy.orderValueBelow}` : "—"],
        ["Customs dates", p.customsPolicy ? `${p.customsPolicy.startsOn} → ${p.customsPolicy.endsOn ?? "no end date set"}` : "—"],
        ["Known goods", fmt.eur(p.knownGoods)],
        ...(p.bundle ? [["Cost allocation", p.goodsAllocationBasis === "part-count"
            ? "Bundle share by purchased part count (including surplus); not an individual supplier price."
            : "Bundle share unavailable: price or comparable part counts are unknown."] as [string, ReactNode]] : []),
        ...(print ? [
            ["Print material", print.materialName],
            ["Estimated weight", `${print.weightGrams} g for ${print.required} BOM unit(s)${p.printEstimate ? " required" : " · reference, excluded from build"}`],
            ["Estimated material cost", fmt.eur(print.materialCost)],
        ] as [string, ReactNode][] : []),
        [
            "Listing",
            p.offerUrl ? (
                <a className="underline" target="_blank" rel="noreferrer" href={p.offerUrl}>
                    Supplier page ↗
                </a>
            ) : (
                "—"
            ),
        ],
    ];
    return (
        <>
            <Crumb left={`Bill of materials / ${p.id}`} right={p.lifecycle} />
            <div className="px-4 pb-20 sm:px-6">
                <section className="grid gap-8 border-b-2 border-ink py-8 lg:grid-cols-12">
                    <div className="lg:col-span-7">
                        <div className="tag">{[p.kind, ...p.disciplines, ...p.traits].join(" · ")}</div>
                        <h1 className="cond mt-3 text-[60px] leading-[0.88]">{p.name}</h1>
                        <ol className="mt-8 border-t-2 border-ink">
                            {p.requirements.map((r, i) => (
                                <li key={i} className="grid grid-cols-[40px_1fr] border-b border-ink py-3">
                                    <span className="mono">{fmt.pad(i + 1)}</span>
                                    <span>{r}</span>
                                </li>
                            ))}
                        </ol>
                        {models.filter((model) => model.geometry).map((model) => <GeometryNotice key={model.id} model={model} />)}
                    </div>
                    <div className="lg:col-span-5">
                        <div className="flex items-end gap-3 border-b-2 border-ink pb-3">
                            <span className="cond text-[110px] leading-[0.8]">{p.required ?? "—"}</span>
                            <span className="tag pb-2">{p.unit} required</span>
                        </div>
                        <table className="w-full text-[13px]">
                            <tbody>
                                {rows.map(([k, v]) => (
                                    <tr key={k} className="border-b border-ink">
                                        <td className="tag w-[120px] py-2 pr-4 align-top">{k}</td>
                                        <td className="py-2 break-words">{v}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {p.warnings.length > 0 && (
                            <div className="mt-6 border-2 border-ink p-4">
                                <div className="cond text-[18px]">Evidence gaps</div>
                                <ul className="mt-2 grid list-[square] gap-1 pl-5 text-[12.5px]">
                                    {p.warnings.map((w) => (
                                        <li key={w}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>
                {print && (
                    <section className="mt-10">
                        <h2 className="cond text-[30px]">Print material estimate</h2>
                        <p className="mt-3 max-w-4xl text-[13px]">{print.note}</p>
                        <h3 className="tag mt-6">Selected recipe by material and colour</h3>
                        <table className="mt-3 w-full border-t-2 border-ink text-[13px]">
                            <thead><tr className="tag border-b border-ink text-left">
                                <th className="py-2">Material / colour</th><th className="text-right">Roll price</th><th className="text-right">Estimated weight</th><th className="text-right">Material cost</th>
                            </tr></thead>
                            <tbody>{print.materialUsages.map((usage) => (
                                <tr key={`${usage.materialId}/${usage.color}`} className="border-b border-hair">
                                    <td className="py-3"><a className="underline" href={usage.priceSourceUrl} target="_blank" rel="noreferrer">{usage.name}</a> · {usage.color ?? "unspecified"}</td>
                                    <td className="mono text-right">{fmt.eur(usage.spoolPrice)} / {usage.spoolWeightGrams} g<div className="tag mt-1">{usage.minimumBulkRolls ? `${usage.minimumBulkRolls}+ eligible mixed rolls` : "single spool"}</div></td>
                                    <td className="mono text-right">{usage.weightGrams} g</td>
                                    <td className="mono text-right">{fmt.eur(usage.materialCost)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                        <h3 className="tag mt-6">Whole-kit material comparisons</h3>
                        <p className="mt-2 text-[13px]">Each comparison assumes every component uses one material. The selected recipe above preserves its separate shell and functional materials.</p>
                        <table className="mt-4 w-full border-t-2 border-ink text-[13px]">
                            <thead><tr className="tag border-b border-ink text-left">
                                <th className="py-2">Material</th><th className="text-right">Roll price</th><th className="text-right">Estimated total weight</th><th className="text-right">Material cost</th>
                            </tr></thead>
                            <tbody>{print.alternatives.map((a) => (
                                <tr key={a.materialId} className="border-b border-hair">
                                    <td className="py-3"><a className="underline" href={a.priceSourceUrl} target="_blank" rel="noreferrer">{a.name}</a><div className="tag mt-1">Observed {a.observedAt.slice(0, 10)}</div></td>
                                    <td className="mono text-right">{fmt.eur(a.spoolPrice)} / {a.spoolWeightGrams} g<div className="tag mt-1">{a.minimumBulkRolls ? `${a.minimumBulkRolls}+ eligible mixed rolls` : "single spool"}</div></td>
                                    <td className="mono text-right">{a.weightGrams} g</td>
                                    <td className="mono text-right">{fmt.eur(a.materialCost)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                        <p className="mt-3 text-[13px]">Material comparisons are costing options; they do not establish suitability for this part. Weights are estimates of fully dense CAD plastic, before supports and waste.</p>
                    </section>
                )}
                {fab.length > 0 && (
                    <section className="mt-10">
                        <h2 className="cond text-[30px]">Fabrication sources</h2>
                        <div className="mt-3">
                            <InventoryGrid items={inventory(fab.map((m) => m.id), false)} />
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}
