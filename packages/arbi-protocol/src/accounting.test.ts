import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { BillingCycle, MobilePlan, UsageObservation } from "./accounting-types.js";
import { billingPeriod, cycleAllowance, directionIsCharged, MAX_ACCOUNTING_BYTES, parseAccounting,
  quantityToBytes, reconcileUsage, usageFreshness, validateAccounting, type AccountingResult, type UsageReconciliation } from "./accounting.js";

interface Fixtures {
  baseObservation: UsageObservation;
  plan: MobilePlan;
  scenarios: Array<{ name: string; nowUtc: string; total: UsageObservation; attributions: UsageObservation[]; expected: UsageReconciliation }>;
  cycles: Array<{ name: string; cycle: BillingCycle; atUtc: string; expected?: { start: string; end: string }; error?: string }>;
}
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/accounting.json", import.meta.url), "utf8")) as Fixtures;
const observation = (): UsageObservation => structuredClone(fixtures.baseObservation);
const plan = (): MobilePlan => structuredClone(fixtures.plan);
function value<T>(result: AccountingResult<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result));
  return result.value;
}
function error(result: AccountingResult<unknown>, code: string): void {
  assert.equal(result.ok, false, JSON.stringify(result));
  if (!result.ok) assert.equal(result.error.code, code);
}
for (const scenario of fixtures.scenarios) test(`worked accounting fixture: ${scenario.name}`, () => {
  for (const row of [scenario.total, ...scenario.attributions]) assert.deepEqual(value(parseAccounting(JSON.stringify(row))), row);
  assert.deepEqual(value(reconcileUsage(scenario.total, scenario.attributions, scenario.nowUtc)), scenario.expected);
});
for (const fixture of fixtures.cycles) test(`billing fixture: ${fixture.name}`, () => {
  const result = billingPeriod(fixture.cycle, fixture.atUtc);
  if (fixture.error) error(result, fixture.error);
  else assert.deepEqual(value(result), fixture.expected);
});

test("shared fanout counts garden upstream once; relay and viewer scopes cannot enter garden total", () => {
  const shared = fixtures.scenarios.find((s) => s.name === "shared-five-viewers")!;
  const downstream = fixtures.scenarios.find((s) => s.name === "cloud-five-viewers")!;
  const relay = fixtures.scenarios.find((s) => s.name === "cloud-relay-ingress")!;
  assert.equal(value(reconcileUsage(shared.total, shared.attributions, shared.nowUtc)).totalBytes, "11200000");
  assert.equal(value(reconcileUsage(downstream.total, downstream.attributions, downstream.nowUtc)).totalBytes, "50000000");
  error(reconcileUsage(shared.total, downstream.attributions, shared.nowUtc), "SCOPE_MISMATCH");
  error(reconcileUsage(shared.total, relay.attributions, shared.nowUtc), "SCOPE_MISMATCH");
});
test("LAN-only transfer has an independently observed zero garden counter", () => {
  const lan = fixtures.scenarios.find((s) => s.name === "lan-only-capture")!;
  const garden = fixtures.scenarios.find((s) => s.name === "lan-only-sim-zero")!;
  assert.equal(value(reconcileUsage(garden.total, [], garden.nowUtc)).totalBytes, "0");
  error(reconcileUsage(garden.total, lan.attributions, garden.nowUtc), "SCOPE_MISMATCH");
});
test("mixed layers, totals as parts, duplicate attribution and epoch mismatch are rejected", () => {
  const fixture = fixtures.scenarios[0];
  for (const layer of ["application-payload", "provider"] as const) {
    const part = structuredClone(fixture.attributions[0]); part.layer = layer;
    error(reconcileUsage(fixture.total, [part], fixture.nowUtc), "LAYER_MISMATCH");
  }
  error(reconcileUsage(fixture.total, [fixture.total], fixture.nowUtc), "SCOPE_MISMATCH");
  const duplicate = structuredClone(fixture.attributions[0]); duplicate.observationId = "different-observation-id";
  error(reconcileUsage(fixture.total, [fixture.attributions[0], duplicate], fixture.nowUtc), "OVERLAPPING_ATTRIBUTION");
  const wrongEpoch = structuredClone(fixture.attributions[0]); wrongEpoch.counterEpoch = "after-reset";
  error(reconcileUsage(fixture.total, [wrongEpoch], fixture.nowUtc), "SCOPE_MISMATCH");
  const otherRealm = structuredClone(fixture.attributions[0]); otherRealm.realm.namespaceId = "another-test";
  error(reconcileUsage(fixture.total, [otherRealm], fixture.nowUtc), "SCOPE_MISMATCH");
  const simulated = structuredClone(fixture.attributions[0]); simulated.executionMode = "live";
  error(reconcileUsage(fixture.total, [simulated], fixture.nowUtc), "SCOPE_MISMATCH");
  const narrower = structuredClone(fixture.attributions[0]); narrower.evidence.includes = ["payload"];
  error(reconcileUsage(fixture.total, [narrower], fixture.nowUtc), "SCOPE_MISMATCH");
  error(reconcileUsage(fixture.total, Array(129).fill(fixture.attributions[0]), fixture.nowUtc), "RESOURCE_LIMIT");
  error(reconcileUsage(fixture.total, null, fixture.nowUtc), "INVALID_ACCOUNTING");
});
test("missing, partial, estimated and stale breakdowns keep coverage and quality visible", () => {
  const fixture = fixtures.scenarios[0];
  const partial = structuredClone(fixture.attributions[0]);
  partial.evidence.coverage = "partial"; partial.evidence.reason = "collection-gap";
  assert.equal(value(reconcileUsage(fixture.total, [partial, fixture.attributions[1]], fixture.nowUtc)).status, "partial");
  partial.evidence.quality = "estimated";
  assert.equal(value(reconcileUsage(fixture.total, [partial], fixture.nowUtc)).quality, "estimated");
  partial.bytes = null; partial.evidence = {quality:"unavailable",coverage:"unknown",includes:[],observedAt:null,maxAgeMs:10000,reason:"not-reported"};
  const missing = value(reconcileUsage(fixture.total, [partial], fixture.nowUtc));
  assert.equal(missing.status, "partial"); assert.equal(missing.unattributedBytes, "11000000");
  partial.evidence = {...fixture.total.evidence, maxAgeMs: 10000}; partial.bytes = "10000000";
  const stale = value(reconcileUsage(fixture.total, [partial], fixture.nowUtc));
  assert.equal(stale.status, "stale"); assert.equal(stale.freshness, "stale"); assert.equal(stale.unattributedBytes, null);
});

test("schema and semantic boundary reject adversarial external observations", () => {
  const mutations: Array<[string, (row: UsageObservation) => void, string]> = [
    ["version", (row) => { (row as unknown as {version:string}).version = "arbi-accounting/2.0"; }, "UNSUPPORTED_VERSION"],
    ["unknown field", (row) => { Object.assign(row, {carrierInvoice:true}); }, "INVALID_ACCOUNTING"],
    ["overflow", (row) => { row.bytes = "18446744073709551616"; }, "INVALID_RANGE"],
    ["negative bytes", (row) => { row.bytes = "-1"; }, "INVALID_ACCOUNTING"],
    ["floating bytes", (row) => { row.bytes = "1.1"; }, "INVALID_ACCOUNTING"],
    ["numeric bytes", (row) => { (row as unknown as {bytes:number}).bytes = 9007199254740992; }, "INVALID_ACCOUNTING"],
    ["bad timestamp", (row) => { row.interval.start = "2026-02-30T10:00:00.000Z"; }, "INVALID_ACCOUNTING"],
    ["no interval", (row) => { row.interval.end = row.interval.start; }, "INVALID_TIME"],
    ["premature observation", (row) => { row.evidence.observedAt = row.interval.start; }, "INVALID_TIME"],
    ["unavailable zero", (row) => { row.evidence = {quality:"unavailable",coverage:"unknown",includes:[],observedAt:null,maxAgeMs:0,reason:"unsupported-counter"}; }, "INVALID_ACCOUNTING"],
    ["missing counter zero", (row) => { row.bytes = null; }, "INVALID_ACCOUNTING"],
    ["partial without reason", (row) => { row.evidence.coverage = "partial"; }, "INVALID_ACCOUNTING"],
    ["unknown layer", (row) => { (row as unknown as {layer:string}).layer = "carrier-billing-truth"; }, "INVALID_ACCOUNTING"],
    ["provider on LAN", (row) => { row.layer = "provider"; row.boundary = "lan"; }, "SCOPE_MISMATCH"],
  ];
  for (const [name, mutate, code] of mutations) {
    const row = observation(); mutate(row);
    assert.equal(validateAccounting(row).ok, false, name); error(validateAccounting(row), code);
  }
  error(parseAccounting("{"), "INVALID_JSON");
  error(parseAccounting(null as unknown as string), "INVALID_JSON");
  error(parseAccounting(" ".repeat(MAX_ACCOUNTING_BYTES + 1)), "RECORD_TOO_LARGE");
  error(validateAccounting(null), "INVALID_ACCOUNTING");
  const exact = observation(); exact.bytes = "9007199254740993";
  assert.equal((value(parseAccounting(JSON.stringify(exact))) as UsageObservation).bytes, "9007199254740993");
});
test("recording is reserved and disabled; upstream has no per-viewer multiplier", () => {
  const row = structuredClone(fixtures.scenarios[2].attributions[0]);
  row.media!.viewerId = "viewer-1";
  error(validateAccounting(row), "SCOPE_MISMATCH");
  row.media!.viewerId = null; row.media!.viewerCount = 0;
  error(validateAccounting(row), "INVALID_ACCOUNTING");
  row.media = null; row.category = "recording";
  error(validateAccounting(row), "INVALID_ACCOUNTING");
  row.bytes = null;
  row.evidence = {quality:"unavailable",coverage:"unknown",includes:[],observedAt:null,maxAgeMs:0,reason:"disabled"};
  assert.equal(validateAccounting(row).ok, true);
});
test("freshness boundary and clock reversal are explicit", () => {
  const row = observation();
  assert.equal(value(usageFreshness(row, "2026-10-07T10:02:00.000Z")), "fresh");
  assert.equal(value(usageFreshness(row, "2026-10-07T10:02:00.001Z")), "stale");
  error(usageFreshness(row, "2026-10-07T10:00:59.999Z"), "INVALID_TIME");
  error(usageFreshness(row, "not-a-time"), "INVALID_TIME");
});
test("decimal GB and binary GiB convert exactly without floating-point rounding", () => {
  assert.equal(value(quantityToBytes({value:"1",unit:"GB"})), "1000000000");
  assert.equal(value(quantityToBytes({value:"1",unit:"GiB"})), "1073741824");
  assert.equal(value(quantityToBytes({value:"1.5",unit:"GiB"})), "1610612736");
  assert.equal(value(quantityToBytes({value:"0.000001",unit:"GB"})), "1000");
  error(quantityToBytes({value:"0.000001",unit:"GiB"}), "INVALID_QUANTITY");
  error(quantityToBytes({value:"1.1",unit:"bytes"}), "INVALID_QUANTITY");
  error(quantityToBytes({value:"18446744073709551616",unit:"bytes"}), "INVALID_RANGE");
  error(quantityToBytes({value:"01",unit:"GB"}), "INVALID_QUANTITY");
});
test("cycle reset, unknown rollover and configured direction charging have no carrier defaults", () => {
  const p = plan();
  assert.deepEqual(value(parseAccounting(JSON.stringify(p))), p);
  assert.equal(value(cycleAllowance(p, null)), "20000000000");
  p.rollover = {policy:"capped-one-cycle",cap:{value:"5",unit:"GB"}};
  assert.equal(value(cycleAllowance(p, null)), null);
  assert.equal(value(cycleAllowance(p, "6000000000")), "25000000000");
  assert.equal(value(cycleAllowance(p, "1000000000")), "21000000000");
  error(cycleAllowance(p, "20000000001"), "INVALID_RANGE");
  error(cycleAllowance(p, 100 as unknown as string), "INVALID_RANGE");
  assert.equal(value(directionIsCharged(p, "upload")), true);
  assert.equal(value(directionIsCharged(p, "download")), true);
  p.chargedDirections = "download";
  assert.equal(value(directionIsCharged(p, "upload")), false);
  assert.equal(value(directionIsCharged(p, "download")), true);
  p.chargedDirections = "upload";
  assert.equal(value(directionIsCharged(p, "download")), false);
  assert.equal(value(directionIsCharged(p, "upload")), true);
  error(directionIsCharged(p, "inbound"), "SCOPE_MISMATCH");
  assert.equal(p.tariff, null);
  p.tariff = {source:"user-supplied",currency:"EUR",overageUnit:"GB",overagePricePerUnit:"0.25",rounding:"ceil-unit",observedAt:"2026-10-07T00:00:00.000Z"};
  assert.equal(validateAccounting(p).ok, true);
  p.tariff.currency = "eur"; error(validateAccounting(p), "INVALID_ACCOUNTING");
});
test("invalid plan settings, units and timezones fail before calculation", () => {
  const p = plan(); p.cycle.timezone = "unknown/carrier"; error(validateAccounting(p), "INVALID_TIME");
  p.cycle.timezone = "+02:00"; error(validateAccounting(p), "INVALID_TIME");
  error(billingPeriod(p.cycle, "2026-10-07T00:00:00.000Z"), "INVALID_TIME");
  p.cycle.timezone = "UTC"; p.cycle.anchorDay = 0; error(validateAccounting(p), "INVALID_ACCOUNTING");
  p.cycle.anchorDay = 7; p.allowance = {value:"1.5",unit:"bytes"}; error(validateAccounting(p), "INVALID_QUANTITY");
  p.allowance = {value:"20",unit:"GB"}; p.rollover = {policy:"none",cap:{value:"1",unit:"GB"}};
  error(validateAccounting(p), "INVALID_ACCOUNTING");
  error(billingPeriod({...plan().cycle, timezone:"UTC", anchorDay:1}, "9999-12-07T00:00:00.000Z"), "INVALID_TIME");
});
