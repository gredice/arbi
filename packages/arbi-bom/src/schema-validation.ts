import { readFile } from "node:fs/promises";

import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

const validators = new Map<string, ValidateFunction>();

function formatError(error: ErrorObject): string {
  const location = error.instancePath === "" ? "/" : error.instancePath;
  return location + " " + error.message;
}

export async function assertJsonSchema(
  documentPath: string,
  value: unknown,
  schemaPath: string,
): Promise<void> {
  const cached = validators.get(schemaPath);
  let validate: ValidateFunction;
  if (cached === undefined) {
    const schema = JSON.parse(await readFile(schemaPath, "utf8")) as object;
    const ajv = new Ajv2020({
      allErrors: true,
      allowUnionTypes: true,
      strict: true,
    });
    ajv.addFormat("date-time", {
      type: "string",
      validate: (value: string) => {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
          return false;
        }
        return !Number.isNaN(Date.parse(value));
      },
    });
    ajv.addFormat("uri", {
      type: "string",
      validate: (value: string) => {
        try {
          const protocol = new URL(value).protocol;
          return protocol === "https:" || protocol === "http:";
        } catch {
          return false;
        }
      },
    });
    validate = ajv.compile(schema);
    validators.set(schemaPath, validate);
  } else {
    validate = cached;
  }

  if (!validate(value)) {
    const errors = (validate.errors ?? [])
      .map(formatError)
      .sort()
      .join("\n");
    throw new Error(
      "JSON Schema validation failed for " + documentPath + ":\n" + errors,
    );
  }
}
