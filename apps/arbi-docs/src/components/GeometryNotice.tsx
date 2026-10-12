import type { Model } from "@/lib/types";

export function GeometryNotice({ model }: { model: Model }) {
    if (!model.geometry) return null;
    return (
        <div className="mt-6 border-2 border-red-800 bg-red-50 p-4 text-red-900">
            <h2 className="cond text-[22px]">Critical · Approximate geometry · needs rework</h2>
            <p className="mt-2 text-sm">{model.geometry.basis}</p>
            <p className="mt-2 text-sm">{model.geometry.rework}</p>
            <p className="mt-2 text-sm">Resolve dimensions and interfaces before dependent assembly design.</p>
            <p className="mt-2 text-sm">Illustrative model only. This is not a manufacturing source or evidence of engineering approval.</p>
        </div>
    );
}
