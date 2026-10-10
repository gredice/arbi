import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isPulleyHeadPart, overviewCounts, pulleyHeadModels } from "../src/lib/corner-overview.ts";

const registry = JSON.parse(readFileSync(new URL("../../../hardware/models.json", import.meta.url))).models;
const owners = JSON.parse(readFileSync(new URL("../../../bom/assemblies/assemblies.json", import.meta.url))).assemblies;

test("pulley head presentation includes current carriers and historical alternatives without site or stand hardware", () => {
    const models = pulleyHeadModels(registry);
    const ids = new Set(models.map((model) => model.id));
    for (const id of ["corner-head-printed-left", "corner-head-printed-right", "corner-head-printed-rear-pad", "corner-head-printed-front-cover", "corner-head-printed-rear-cover", "top-positioning-line-pulley", "pole-pulley-mount-assembly", "corner-head-assembly"])
        assert.ok(ids.has(id), `${id} belongs in the head inventory`);
    for (const id of ["corner-post-treated-timber", "guy-wire-3mm", "corner-guy-post-connection", "corner-stand-head-front", "corner-stand-winch-front", "winch-cover-passive-left"])
        assert.ok(!ids.has(id), `${id} belongs outside the head inventory`);
    const support = owners.find((assembly) => assembly.id === "corner-support-set");
    assert.ok(support.usages.filter((usage) => isPulleyHeadPart(usage.partId)).some((usage) => usage.partId === "corner-head-printed-kit"));
    assert.equal(support.parentAssemblyId, null, "presentation must not migrate the direct BOM owner");
});

test("overview counts include descendants once when their presentation shares parent parts", () => {
    const root = { id: "support", parentAssemblyId: null, models: [{ id: "head" }, { id: "post" }], usages: [{ partId: "head-kit" }, { partId: "post" }] };
    const head = { id: "head", parentAssemblyId: "support", models: [{ id: "head" }], usages: [{ partId: "head-kit" }] };
    const winch = { id: "winch", parentAssemblyId: "support", models: [{ id: "drum" }], usages: [{ partId: "motor" }] };
    const nested = { id: "line", parentAssemblyId: "winch", models: [], usages: [{ partId: "rope" }] };
    const unrelated = { id: "pod", parentAssemblyId: null, models: [{ id: "pod" }], usages: [{ partId: "camera" }] };
    assert.deepEqual(overviewCounts(root, [nested, head, root, winch, unrelated]), { models: 3, bomLines: 4 });
});
