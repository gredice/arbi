# ADR-0040: Isolated edge update preflight and admission inhibition

Status: proposed in the issue #76 PR. Scope: explicit test-realm composition.

The existing update operation, inventory, compatibility, trust, transfer budget,
audit and target owners remain authoritative. Add optional local check/drain
hooks to that owner, connecting the actual local job journal, manual-control
session, revision-bound conditions/module epochs and optional capture workflow.
The hooks are never selected by normal runtime or supervisor startup.

An immutable private SQLite journal retains a local admission lock for the whole
operation. Before downloading, acquire the lock, stop local jobs, retire the
current manual lease fence even if unused, stop preview and bound media draining.
This releases discretionary budget concurrency before the update's existing
artifact owner begins work. Recheck current local conditions before reservation
and rollback. The journal does not select a release or manage another update.

Unknown/stale local evidence, motion, manual control, maintenance, ambiguous
docking, unresolved local storage or a missing independent target-specific
restraint procedure produce durable blocked operation/audit results. Parked
alone cannot pass Pico preflight. Every procedure remains declared simulation
evidence; physical flashing stays disabled.

An interrupted/unknown drain retains inhibition and needs a private reviewed
retry. Changed local epochs require fresh human reconciliation. Terminal durable
operation state, healthy current target readbacks and explicit local review are
needed to release the lock. Release restores neither jobs nor manual authority;
their existing owners require deliberate recovery and a higher lease fence.

The [guide](../software/edge-update-preflight.md) describes these hooks and recovery.
The [evidence](../evidence/edge-update-preflight.md) keeps host integration separate
from the outstanding hardware restraint, installed OS and physical failure gates.
