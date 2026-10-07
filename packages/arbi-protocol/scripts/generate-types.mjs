import { readFileSync, writeFileSync } from "node:fs";

const literal = (value) => JSON.stringify(value);

// This intentionally supports only the structural subset used by this schema.
// Range, format and conditional constraints remain runtime checks, never casts.
function type(node) {
  if (node.$ref) {
    const path = node.$ref.split("#/$defs/")[1].split("/properties/");
    return path[0] + path.slice(1).map((key) => `[${literal(key)}]`).join("");
  }
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

const bindings = [
  { schema: "message", output: "messages", refinement: "validateMessage", imports: "", suffix: "\n\nexport type Message = Command | Event | Telemetry;\n" },
  { schema: "configuration", output: "configuration-types", refinement: "validateConfigurationRecord", imports: 'import type { Id, Realm, Identity, Actor, VectorMm, SiteFrame, GimbalFrame, Capability, Sample } from "./messages.js";\n\n', suffix: "\n" },
];
for (const binding of bindings) {
  const schema = JSON.parse(readFileSync(new URL(`../schema/${binding.schema}.schema.json`, import.meta.url), "utf8"));
  const result = `// Generated from schema/${binding.schema}.schema.json. Run pnpm --filter @arbi/protocol generate.\n`
    + `// Refinements (ranges, formats, conditionals) require ${binding.refinement} at runtime.\n\n`
    + binding.imports
    + Object.entries(schema.$defs).map(([name, node]) => `export type ${name} = ${type(node)};`).join("\n\n")
    + binding.suffix;
  const output = new URL(`../src/${binding.output}.ts`, import.meta.url);
  if (process.argv.includes("--check")) {
    if (readFileSync(output, "utf8") !== result) throw new Error("Protocol types are stale: run pnpm --filter @arbi/protocol generate");
  } else writeFileSync(output, result);
}
