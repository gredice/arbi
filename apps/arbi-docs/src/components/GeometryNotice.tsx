import type { Model } from "@/lib/types";
import { fmt } from "@/lib/format";

export function GeometryNotice({ model }: { model: Model }) {
    if (!model.geometry) return null;
    const documented = ["measured-envelope", "drawing-derived"].includes(model.geometry.status);
    return (
        <div className={`mt-6 border-2 p-4 ${documented ? "border-amber-700 bg-amber-50 text-amber-900" : "border-red-800 bg-red-50 text-red-900"}`}>
            <h2 className="cond text-[22px]">{!documented && "Critical · "}{fmt.geometry(model.geometry.status)}</h2>
            <p className="mt-2 text-sm">{model.geometry.basis}</p>
            <p className="mt-2 text-sm">{model.geometry.rework}</p>
            {!documented && <p className="mt-2 text-sm">Resolve dimensions and interfaces before dependent assembly design.</p>}
            <p className="mt-2 text-sm">Illustrative model only. This is not a manufacturing source or evidence of engineering approval.</p>
        </div>
    );
}
