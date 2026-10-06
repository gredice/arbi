import { readFileSync, writeFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/message.schema.json", import.meta.url), "utf8"));
const literal = (value) => JSON.stringify(value);

// This intentionally supports only the structural subset used by this schema.
// Range, format and conditional constraints remain runtime checks, never casts.
function type(node) {
  if (node.$ref) return node.$ref.split("/").at(-1);
  if (Object.hasOwn(node, "const")) return literal(node.const);
  if (node.enum) return node.enum.map(literal).join(" | ");
  if (node.oneOf || node.anyOf) return (node.oneOf ?? node.anyOf).map(type).map((t) => `(${t})`).join(" | ");
  switch (node.type) {
    case "object": return `{ ${Object.entries(node.properties).map(([key, child]) => `${literal(key)}${node.required.includes(key) ? "" : "?"}: ${type(child)};`).join(" ")} }`;
    case "array": return `Array<${type(node.items)}>`;
    case "integer": case "number": return "number";
    case "string": case "boolean": case "null": return node.type;
    default: throw new Error("Unsupported schema shape in type generator");
  }
}

const result = "// Generated from schema/message.schema.json. Run pnpm --filter @arbi/protocol generate.\n"
  + "// Refinements (ranges, formats, conditionals) require validateMessage at runtime.\n\n"
  + Object.entries(schema.$defs).map(([name, node]) => `export type ${name} = ${type(node)};`).join("\n\n")
  + "\n\nexport type Message = Command | Event | Telemetry;\n";
const output = new URL("../src/messages.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== result) throw new Error("Protocol types are stale: run pnpm --filter @arbi/protocol generate");
} else writeFileSync(output, result);
