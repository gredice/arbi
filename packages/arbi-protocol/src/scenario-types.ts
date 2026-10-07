// Generated from schema/scenario.schema.json. Run pnpm --filter @arbi/protocol generate.
// Refinements (ranges, formats, conditionals) require validateScenario at runtime.

import type { Id, Identity, Actor, Counter, SiteFrame, GimbalFrame, VectorMm, Command, EventBody } from "./messages.js";

export type ScenarioUnits = { "position": "mm"; "angle": "deg"; "speed": "mm/s"; "acceleration": "mm/s^2"; "force": "N"; "time": "ms"; "voltage": "V"; };

export type ScenarioIdentity = { "protocol": "arbi/1.0"; "configurationSchema": "arbi.configuration/1.0"; "configurationRevision": Id; "configurationDigest": string; "geometryRevision": Id; "calibrationRevision": Id; "siteFrame": SiteFrame; "gimbalFrame": GimbalFrame; "referenceDigest": string; };

export type ScenarioComponentRevision = { "id": Id; "revision": Id; "buildId": Id; };

export type ScenarioProvenance = { "model": ScenarioComponentRevision; "controller": ScenarioComponentRevision; "runner": ScenarioComponentRevision; "evidence": "synthetic-host-reference"; "fidelity": "affine-kinematic-no-dynamics"; };

export type ScenarioClock = { "startMs": number; "durationMs": number; "stepMs": number; "ordering": "time-then-explicit-order"; "sampling": "advance-events-sample"; "normalization": "q6-floor-half-up"; };

export type ScenarioInitial = { "state": "Ready" | "Parked" | "Fault"; "positionMm": VectorMm; "panDeg": number; "tiltDeg": number; "cloudConnected": boolean; "driverFault": boolean; "powerAvailable": boolean; "voltageV": number; };

export type ScenarioGate = { "source": Identity; "receiver": Identity; "actor": Actor; "lease": { "id": Id; "holderId": Id; "fence": Counter; "expiresMonotonicMs": number; }; "maxDeadlineAheadMs": number; };

export type ScenarioInput = ({ "atMs": number; "order": number; "kind": "command"; "message": Command; }) | ({ "atMs": number; "order": number; "kind": "cloud"; "connected": boolean; }) | ({ "atMs": number; "order": number; "kind": "driver-fault"; "active": boolean; }) | ({ "atMs": number; "order": number; "kind": "power"; "available": boolean; "voltageV": number; }) | ({ "atMs": number; "order": number; "kind": "voltage-noise"; "amplitudeV": number; });

export type ScenarioLines = { "a": number; "b": number; "c": number; "d": number; };

export type ScenarioPositionQ6 = { "x": number; "y": number; "z": number; };

export type ScenarioCheckpoint = { "atMs": number; "state": Extract<EventBody, { type: "state.snapshot" }>["state"]; "positionQ6": ScenarioPositionQ6; "lengthQ6": ScenarioLines; };

export type ScenarioInvariantId = "within-workspace" | "truthful-feedback" | "rejected-no-dispatch" | "local-progress-offline" | "bounded-trace";

export type ScenarioInvariant = { "id": ScenarioInvariantId; "passed": boolean; };

export type ScenarioExpected = { "traceDigest": string; "invariants": Array<ScenarioInvariant>; "checkpoints": Array<ScenarioCheckpoint>; "outcomes": Array<{ "commandId": Id; "outcomes": Array<Extract<EventBody, { type: "command.outcome" }>["outcome"]>; }>; };

export type ScenarioTrajectoryVector = { "id": Id; "startMm": VectorMm; "targetMm": VectorMm; "durationMs": number; "elapsedMs": number; "expectedPositionMm": VectorMm; };

export type ScenarioTransitionVector = { "current": (Extract<EventBody, { type: "command.outcome" }>["outcome"]) | (null); "next": Extract<EventBody, { type: "command.outcome" }>["outcome"]; "expected": (Extract<EventBody, { type: "command.outcome" }>["outcome"]) | ("INVALID_TRANSITION"); };

export type Scenario = { "schemaVersion": "arbi.scenario/1.0"; "id": Id; "executionMode": "simulation"; "identity": ScenarioIdentity; "units": ScenarioUnits; "provenance": ScenarioProvenance; "clock": ScenarioClock; "seed": number; "gate": ScenarioGate; "initial": ScenarioInitial; "inputs": Array<ScenarioInput>; "trajectories": Array<ScenarioTrajectoryVector>; "transitions": Array<ScenarioTransitionVector>; "expected": ScenarioExpected; };
