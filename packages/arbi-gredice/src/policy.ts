export const AUTHORIZATION_VERSION = "arbi-authorization/1.0" as const;
export const capabilities = Object.freeze([
  "state.read", "live.view", "still.read", "history.read", "capture.request",
  "manipulation.request", "diagnostics.read", "configuration.read", "configuration.write",
  "update.request", "artifact.read", "audit.read", "audit.export",
  "recording.create", "recording.read", "recording.export", "recording.delete",
] as const);
export type Capability = typeof capabilities[number];
export const roles = Object.freeze(["viewer", "operator", "engineer", "update-admin"] as const);
export type Role = typeof roles[number];

const viewing: readonly Capability[] = ["state.read", "live.view", "still.read", "history.read"];
// Roles are explicit grants, not an ordering. Engineering and update authority are independent.
export const roleCapabilities: Readonly<Record<Role, readonly Capability[]>> = Object.freeze({
  viewer: Object.freeze([...viewing]),
  operator: Object.freeze([...viewing, "capture.request", "manipulation.request"] as Capability[]),
  engineer: Object.freeze([...viewing, "diagnostics.read", "configuration.read", "configuration.write",
    "audit.read", "audit.export"] as Capability[]),
  "update-admin": Object.freeze([...viewing, "configuration.read", "artifact.read", "update.request",
    "audit.read", "audit.export"] as Capability[]),
});
export const serviceCapabilities: readonly Capability[] = Object.freeze([
  "state.read", "capture.request", "artifact.read",
]);
export const isCapability = (value: unknown): value is Capability =>
  typeof value === "string" && (capabilities as readonly string[]).includes(value);
export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (roles as readonly string[]).includes(value);
export const recordingDisabled = (capability: Capability): boolean => capability.startsWith("recording.");
export const isRead = (capability: Capability): boolean =>
  ["state.read", "still.read", "history.read", "diagnostics.read", "configuration.read",
    "artifact.read", "audit.read"].includes(capability);

export type Surface = "http" | "realtime" | "media" | "audit" | "artifact";
const surfaceCapabilities: Record<Surface, readonly Capability[]> = {
  http: ["state.read", "history.read", "capture.request", "manipulation.request", "diagnostics.read",
    "configuration.read", "configuration.write", "update.request"],
  realtime: ["state.read", "diagnostics.read", "audit.read"],
  media: ["live.view", "still.read", "recording.create", "recording.read", "recording.export", "recording.delete"],
  audit: ["audit.read", "audit.export"],
  artifact: ["artifact.read"],
};
export function permitsSurface(surface: unknown, capability: Capability): boolean {
  return typeof surface === "string" && Object.hasOwn(surfaceCapabilities, surface) &&
    surfaceCapabilities[surface as Surface].includes(capability);
}
