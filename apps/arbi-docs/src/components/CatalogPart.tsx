import Link from "next/link";
import { Crumb } from "./Crumb";
import { GeometryNotice } from "./GeometryNotice";
import { InventoryGrid } from "./InventoryGrid";
import { PartViewer } from "./PartViewer";
import { fmt, links } from "@/lib/format";
import { docHref, download, inventory, meshFor, modelsForBomPart, partColor } from "@/lib/site";
import type { BomPart, Vec3 } from "@/lib/types";

export function CatalogPart({ part }: { part: BomPart }) {
    const models = modelsForBomPart(part.id);
    const model = models.find((item) => meshFor(item.id)) ?? models[0];
    if (!model) throw new Error(`No model registered for BOM item ${part.id}`);
    const file = download(model.id);
    const doc = docHref(model.documentation);
    return (
        <>
            <Crumb left={`Parts / ${part.id}`} right={part.lifecycle} />
            <section className="grid border-b-2 border-ink lg:grid-cols-12">
                <div className="lg:col-span-7">
                    <PartViewer mesh={meshFor(model.id)} model={model.id} color={partColor(model.id) as Vec3}
                        output={model.output} approximate={Boolean(model.geometry)} missing="Model source is registered; its mesh is awaiting a current CAD release" />
                </div>
                <div className="px-4 py-6 sm:px-6 lg:col-span-5">
                    <div className="tag">{[part.kind, ...part.traits].join(" · ")}</div>
                    <h1 className="cond mt-3 text-[44px] leading-none">{part.name}</h1>
                    <p className="mt-4">{part.required !== null ? `${part.required} ${part.unit} required in the current BOM build.` : "Not included in the current BOM build."}</p>
                    <Link href={`/bom/${part.id}`} className="key-line mt-5">BOM, procurement and usage details</Link>
                    <GeometryNotice model={model} />
                    {models.length > 1 && <p className="mt-4 text-sm">This item contains {models.length} CAD components. The viewer shows {model.id}; browse the component models below.</p>}
                    <dl className="mt-6 grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 border-t-2 border-ink pt-3 text-sm">
                        <dt className="tag">Model</dt><dd className="break-words">{model.id}</dd>
                        <dt className="tag">Role</dt><dd>{model.artifactRole === "visualization" ? "Illustrative visualization" : model.artifactRole}</dd>
                        <dt className="tag">Status</dt><dd>{fmt.status(model.status)}</dd>
                        <dt className="tag">Revision</dt><dd>{model.revision}</dd>
                        <dt className="tag">Document</dt><dd>{doc ? <Link className="underline" href={doc}>Geometry and assumptions</Link> : model.documentation}</dd>
                    </dl>
                    <div className="mt-6 flex flex-wrap gap-3">
                        {file.verified && <a className="key-line" href={file.url}>{model.artifactRole === "visualization" ? "Illustrative STL" : "STL"} download</a>}
                        <a className="key-line" href={links.raw(model.entrypoint)} target="_blank" rel="noreferrer">SCAD source</a>
                    </div>
                    <p className="mt-2 text-xs text-grey">{file.label}</p>
                </div>
            </section>
            <section className="px-4 py-8 sm:px-6">
                <h2 className="cond text-[30px]">Requirements</h2>
                <ul className="mt-4 list-[square] space-y-2 pl-5">{part.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
                {part.notes && <p className="mt-4 max-w-4xl">{part.notes}</p>}
                {models.length > 1 && <div className="mt-8"><h2 className="cond mb-4 text-[30px]">Component models</h2><InventoryGrid items={inventory(models.filter((item) => item.id !== part.id).map((item) => item.id), false)} /></div>}
            </section>
        </>
    );
}
