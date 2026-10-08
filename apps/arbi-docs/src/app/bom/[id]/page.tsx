import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Crumb } from "@/components/Crumb";
import { InventoryGrid } from "@/components/InventoryGrid";
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
    const fab = modelsForBomPart(p.id);
    const rows: [string, ReactNode][] = [
        ["Used in", p.usedIn.map((u) => `${u.assemblyId} × ${u.quantity}`).join(", ") || "—"],
        ["Offer", p.offerId ?? "—"],
        ["Supplier", p.supplierId ?? "—"],
        ["Qualification", fmt.status(p.qualification)],
        ["Purchase units", p.purchaseUnits ?? "—"],
        ["Known goods", fmt.eur(p.knownGoods)],
        ...(p.bundle ? [["Cost allocation", p.goodsAllocationBasis === "part-count"
            ? "Bundle share by purchased part count (including surplus); not an individual supplier price."
            : "Bundle share unavailable: price or comparable part counts are unknown."] as [string, ReactNode]] : []),
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
