import { readFileSync, writeFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/accounting.schema.json", import.meta.url), "utf8"));
// Same deliberately bounded structural subset as the message generator. Runtime
// refinements and JSON Schema conditionals cannot be enforced by TypeScript.
function type(node) {
  if (node.$ref) return node.$ref.split("/").at(-1);
  if (Object.hasOwn(node, "const")) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map(JSON.stringify).join(" | ");
  if (node.oneOf || node.anyOf) return (node.oneOf ?? node.anyOf).map(type).map((t) => `(${t})`).join(" | ");
  switch (node.type) {
    case "object": return `{ ${Object.entries(node.properties).map(([key, child]) => `${JSON.stringify(key)}${node.required.includes(key) ? "" : "?"}: ${type(child)};`).join(" ")} }`;
    case "array": return `Array<${type(node.items)}>`;
    case "integer": case "number": return "number";
    case "string": case "boolean": case "null": return node.type;
    default: throw new Error("Unsupported accounting schema shape");
  }
}
const result = "// Generated from schema/accounting.schema.json. Run pnpm --filter @arbi/protocol generate.\n"
  + "// Refinements require validateAccounting at runtime.\n\n"
  + 'import type { Id, Counter, Realm, Identity } from "./messages.js";\n\n'
  + Object.entries(schema.$defs).map(([name, node]) => `export type ${name} = ${type(node)};`).join("\n\n")
  + "\n\nexport type AccountingRecord = UsageObservation | MobilePlan;\n";
const output = new URL("../src/accounting-types.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== result) throw new Error("Accounting types are stale: run pnpm --filter @arbi/protocol generate");
} else writeFileSync(output, result);
