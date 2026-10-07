// Generated from schema/accounting.schema.json. Run pnpm --filter @arbi/protocol generate.
// Refinements require validateAccounting at runtime.

import type { Id, Counter, Realm, Identity } from "./messages.js";

export type TrafficCategory = "control" | "heartbeat" | "reconnect" | "auth" | "dns" | "tls" | "telemetry" | "logs-audit" | "thumbnail" | "still" | "live-video" | "turn" | "recording" | "ota" | "os-update" | "retry" | "transport-overhead" | "unknown";

export type UsageBoundary = "lan" | "garden-sim" | "cloud-relay" | "cloud-viewer";

export type UsageLayer = "application-payload" | "interface-wan" | "provider";

export type UsageDirection = "upload" | "download";

export type UsageInterval = { "start": string; "end": string; };

export type UsageEvidence = { "quality": "measured" | "estimated" | "unavailable"; "coverage": "complete" | "partial" | "unknown"; "includes": Array<"payload" | "retries" | "transport-overhead" | "non-arbi">; "observedAt": (string) | (null); "maxAgeMs": number; "reason": ("unsupported-counter" | "not-configured" | "counter-reset" | "collection-gap" | "unattributed" | "estimated-overhead" | "disabled" | "not-reported") | (null); };

export type UsageMedia = { "topology": "direct" | "relayed" | "shared"; "sessionId": Id; "viewerId": (Id) | (null); "viewerCount": number; };

export type UsageObservation = { "version": "arbi-accounting/1.0"; "kind": "usage"; "observationId": Id; "realm": Realm; "executionMode": "live" | "simulation"; "siteId": Id; "source": Identity; "counterEpoch": Id; "boundary": UsageBoundary; "layer": UsageLayer; "direction": UsageDirection; "linkId": Id; "scope": "boundary-total" | "attributed"; "attributionRevision": (Id) | (null); "deviceId": (Id) | (null); "category": (TrafficCategory) | (null); "interval": UsageInterval; "bytes": (Counter) | (null); "evidence": UsageEvidence; "media": (UsageMedia) | (null); };

export type DataQuantity = { "value": string; "unit": "bytes" | "GB" | "GiB"; };

export type BillingCycle = { "frequency": "monthly"; "timezone": string; "anchorDay": number; "anchorHour": number; "anchorMinute": number; "shortMonth": "clamp-last-day"; "dstFold": "earlier" | "later" | "reject"; "dstGap": "reject"; };

export type PlanRollover = { "policy": "none" | "capped-one-cycle"; "cap": (DataQuantity) | (null); };

export type UserTariff = { "source": "user-supplied"; "currency": string; "overageUnit": "GB" | "GiB"; "overagePricePerUnit": string; "rounding": "proportional" | "ceil-unit"; "observedAt": string; };

export type MobilePlan = { "version": "arbi-accounting/1.0"; "kind": "mobile-plan"; "planId": Id; "realm": Realm; "siteId": Id; "linkId": Id; "allowance": DataQuantity; "cycle": BillingCycle; "chargedDirections": "both" | "upload" | "download"; "reset": "each-cycle"; "rollover": PlanRollover; "tariff": (UserTariff) | (null); };

export type AccountingRecord = UsageObservation | MobilePlan;
