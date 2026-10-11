# ADR-0035: Native capture custody and pod recovery

Status: Proposed for source review; physical power/Wi-Fi/pod acceptance unavailable.

Work record: [#61](https://github.com/gredice/arbi/issues/61). Prerequisites: [capture](0033-traceable-synthetic-capture-sequencing.md), [processing](0034-bounded-synthetic-image-rectification.md), [transfer policy](../software/transfer-budgets.md).

## Context

The pod has no battery. Interrupted writes/transfers must preserve a recoverable artifact or explicit incomplete result, retain unacknowledged raw bytes and never replay camera actions. LAN payload attempts, mobile WAN budget, edge custody and canonical cloud delivery are distinct facts.

## Decision

Add `@arbi/protocol/capture-transfer`, a private Node adapter contract consumed by both actual apps without a production app dependency or actuator/wire-schema change. A closed simulation manifest binds raw identity/digest/size, command/correlation/target/fingerprint and bounded curated original metadata in the existing test realm. It is not a public media grant.

The edge reserves storage before chunks, persists fsynced offsets, deduplicates matching payloads and verifies full PNG dimensions/digest before rename/directory-fsync/ownership commit. Native SQLite exclusive ownership, FULL synchronization, hashed rows and fixed limits protect its private temporary model root. Current peer authorization is checked on every call. A committed verified artifact earns an actual Ed25519 custody receipt binding manifest/image/scope, current edge epoch and stable storage ID. Normal startup exposes no transfer endpoint; physical authenticated transport remains gated.

The pod persists finite attempts, offsets, backoff and epoch in its capture store. Steps send one rate-bounded chunk, yield to higher priority work, renew current authority and quarantine uncertain timed-out transports. `ApplicationMeter` counts every submitted LAN payload attempt, including duplicates; retries preserve one capture identity/ownership and do not return another logical-byte debit. LAN transfer does not invoke the WAN allowance owner.

Only a verified trusted-current-edge receipt permits explicit acknowledged retention: persist receipt, persist release intent, unlink/directory-fsync, then commit released state. Restart finishes acknowledged intents, keeps immutable receipt/command tombstones and never retakes removed data. Capacity exhaustion refuses work rather than evicting unacknowledged data. Separate signed cursor custody receipts permit bounded historical audit/usage/informational diagnostic prefix handoff, preserving original source/actor/epoch/gaps. Edge custody does not advance cloud committed cursors.

Trusted runtime attachment binds identity/scope. Stop inhibits and disconnects first, then drains bounded owners before closing runtime spools. No automatic capture/media replay or camera/actuator command activation is added.

## Consequences

Native hashes/signatures/SQLite/fsync/SIGKILL are host source evidence, not removal of board power, selected Pi capacity, real Wi-Fi throughput or eventual cloud delivery. The isolated in-process adapter measures submitted application payload, excluding wireless/TLS/router/provider overhead. [#66](https://github.com/gredice/arbi/issues/66) owns full orchestration/forwarding. Physical sustained/power/wireless/WAN-reconnection benches remain open. See the [guide](../software/capture-transfer.md) and [evidence](../evidence/capture-transfer.md).
