import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import type { ErrorCode, Identity, Message } from "./messages.js";

export type Result<T> = { ok: true; value: T } | { ok: false; error: { code: ErrorCode; path: string } };
export const fail = (code: ErrorCode, path = "/"): Result<never> => ({ ok: false, error: { code, path } });
export const MAX_MESSAGE_BYTES = 16_384;
export const MAX_COUNTER = 18_446_744_073_709_551_615n;
export const PROTOCOL_VERSION = "arbi/1.0";

const schema = JSON.parse(readFileSync(new URL("../schema/message.schema.json", import.meta.url), "utf8")) as { $defs: Record<string, object> };
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
});
ajv.addSchema(schema);
const validators = Object.fromEntries(["command", "event", "telemetry"].map((kind) => [kind,
  ajv.compile({ $ref: `https://arbi.gredice.com/schemas/protocol/1.0/message.schema.json#/$defs/${kind[0].toUpperCase()}${kind.slice(1)}` }),
]));
type BodySchema = { oneOf?: BodySchema[]; properties?: { type: { const: string } } };
const bodyTypes = (name: string): string[] => {
  const body = schema.$defs[name] as BodySchema;
  return (body.oneOf ?? [body]).map((b) => b.properties!.type.const);
};
const knownTypes = { command: bodyTypes("CommandBody"), event: bodyTypes("EventBody"), telemetry: bodyTypes("TelemetryBody") };
const bodyValidators = Object.fromEntries(Object.entries(knownTypes).map(([kind, types]) => [kind,
  Object.fromEntries(types.map((type, index) => [type, ajv.compile({
    $ref: `https://arbi.gredice.com/schemas/protocol/1.0/message.schema.json#/$defs/${kind[0].toUpperCase()}${kind.slice(1)}Body${kind === "telemetry" ? "" : `/oneOf/${index}`}`,
  })])),
]));
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const sameIdentity = (a: Identity, b: Identity): boolean => a.deviceId === b.deviceId && a.bootId === b.bootId && a.sessionId === b.sessionId;

function schemaFailure(errors: ErrorObject[]): Result<never> {
  const unknown = errors.find((e) => e.keyword === "additionalProperties");
  if (unknown) return fail("UNKNOWN_FIELD", `${unknown.instancePath}/${String(unknown.params.additionalProperty)}`);
  const range = errors.find((e) => ["minimum", "maximum"].includes(e.keyword));
  if (range) return fail("INVALID_RANGE", range.instancePath);
  return fail("INVALID_MESSAGE", errors[0]?.instancePath || "/");
}

export function validateMessage(input: unknown): Result<Message> {
  if (!record(input)) return fail("INVALID_MESSAGE");
  if (input.protocol !== PROTOCOL_VERSION) return fail("UNSUPPORTED_VERSION", "/protocol");
  const kind = input.kind;
  if (kind !== "command" && kind !== "event" && kind !== "telemetry") return fail("UNKNOWN_KIND", "/kind");
  const bodyData = input.body;
  if (record(bodyData) && !knownTypes[kind].includes(String(bodyData.type))) return fail("UNKNOWN_TYPE", "/body/type");
  if (!validators[kind](input)) {
    const body = record(bodyData) ? bodyValidators[kind][String(bodyData.type)] : undefined;
    // Validate only the selected discriminated body to avoid errors from unrelated branches.
    if (body && !body(bodyData)) return schemaFailure((body.errors ?? []).map((e) => ({ ...e, instancePath: `/body${e.instancePath}` })));
    return schemaFailure((validators[kind].errors ?? []).filter((e) => !e.instancePath.startsWith("/body")));
  }
  const message = input as Message;
  const counters: Array<[string, string]> = [[message.sequence, "/sequence"]];
  if (message.kind === "command") {
    if (message.command.lease) counters.push([message.command.lease.fence, "/command/lease/fence"]);
    if (message.body.type === "state.resync" && message.body.cursor) counters.push([message.body.cursor.sequence, "/body/cursor/sequence"]);
    if (message.command.deadline.bootId !== message.command.target.bootId || message.command.deadline.sessionId !== message.command.target.sessionId) return fail("INVALID_MESSAGE", "/command/deadline");
  }
  if (message.kind === "event" && message.body.type === "state.snapshot") {
    counters.push([message.body.eventCursor.sequence, "/body/eventCursor/sequence"]);
    if (message.body.telemetryCursor) counters.push([message.body.telemetryCursor.sequence, "/body/telemetryCursor/sequence"]);
    const metrics = message.body.capabilities.map((c) => c.metric);
    if (new Set(metrics).size !== metrics.length) return fail("INVALID_MESSAGE", "/body/capabilities");
    const cursor = message.body.eventCursor;
    if (cursor.stream !== "event" || cursor.sequence !== message.sequence || !sameIdentity(cursor.source, message.source)) return fail("INVALID_MESSAGE", "/body/eventCursor");
    const telemetry = message.body.telemetryCursor;
    if (telemetry && (telemetry.stream !== "telemetry" || !sameIdentity(telemetry.source, message.source))) return fail("INVALID_MESSAGE", "/body/telemetryCursor");
  }
  for (const [value, path] of counters) if (BigInt(value) > MAX_COUNTER) return fail("INVALID_RANGE", path);
  const time = message.sourceTime;
  if ((time.utc === null) !== (time.uncertaintyMs === null)) return fail("CLOCK_INVALID", "/sourceTime");
  if (message.kind === "telemetry") {
    const samples = message.body.samples;
    if (new Set(samples.map((s) => s.metric)).size !== samples.length) return fail("INVALID_MESSAGE", "/body/samples");
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      if (sample.sampleMonotonicMs !== null && (sample.sampleMonotonicMs > time.monotonicMs || sample.ageMs !== time.monotonicMs - sample.sampleMonotonicMs)) return fail("CLOCK_INVALID", `/body/samples/${index}/ageMs`);
    }
  }
  return { ok: true, value: message };
}

export function parseMessage(json: string): Result<Message> {
  if (Buffer.byteLength(json, "utf8") > MAX_MESSAGE_BYTES) return fail("MESSAGE_TOO_LARGE");
  try { return validateMessage(JSON.parse(json)); } catch { return fail("INVALID_JSON"); }
}
