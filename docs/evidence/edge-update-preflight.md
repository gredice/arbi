# Edge update preflight evidence

[#76](https://github.com/gredice/arbi/issues/76),
[guide](../software/edge-update-preflight.md),
[ADR-0040](../decisions/0040-isolated-edge-update-preflight.md).

The test composition runs the existing protected synthetic identity/update
HTTP boundary, actual private SQLite jobs/manual lease fencing, signed range
artifacts, budget and audit, native Linux application A/B files and optional
native capture receiver/stage/worker/upload/preview owners. Configuration and
module conditions are revision-bound declared simulation evidence. Native local
health and passive restraint procedures remain declared fixtures.

| Injected condition | Host expectation | Physical acceptance |
| --- | --- | --- |
| Motion, active manual control, maintenance | Specific durable rejection before transfer or installation | Unverified |
| Unknown docking/conditions, stale time/configuration, lost pod/MCU epoch | Specific durable rejection | Unverified |
| Parked, absent retention/line clearance/target procedure | Pico remains blocked | Blocked pending reviewed restraint/isolation |
| Active job | Durable rejection, zero new dispatches | Unverified |
| Active preview with a real encoded fixture frame | Stop/release camera owner before artifact download; original pending capture retained | Physical camera/contention unverified |
| Slow native uploader/drain | 50 ms test limit; lock retained, zero installation; late completion cannot auto-activate | Real network timing unverified |
| In-process owner/journal replacement and lost native confirmation ACK | Same lock/operation and one installation; no resend | Physical reboot/power loss unverified |
| Closed native job/lock database | No installation; admission unavailable/inhibited | Physical storage failure unverified |
| Private artifact HTTP source unavailable | Existing transfer pauses with local inhibition; authorized retry uses same operation | Cellular outage unverified |
| Changed module epochs | Fresh human local reconciliation required; lock stays held | Physical module loss unverified |
| Terminal operation with healthy target readbacks | Explicit review releases only update lock; job latch and old lease fence remain | Field activation still blocked |

The preview source supplies a valid bounded PNG fixture; this does not exercise
a physical camera. Native capture files/metadata remain pending and separate from
installation status. Media payload charges use the existing budget ledger, not
new WAN/carrier accounting. The group keeps the coordinator last and emits the
existing update audit hooks. No new actuator dispatch or automatic continuation
of a pre-update job is allowed.

Clean source ec62311c85cceb61099410bce30db1b91123567c on merged issue #44
main passed 13 forced edge/dependency build, lint and typecheck tasks and all
208 affected update, job and capture tests, including 22 new preflight scenarios.
The serial regression run took 246.003 seconds on the isolated Linux development
host with Node 24.19.0. The stalled-drain scenario uses a configured 50 ms
deadline and measured the complete failed advance below its 1500 ms test bound;
this is host integration timing, not actuator-stop or brownout timing. Software
configuration, module identities and local health are the committed synthetic
references; no hardware or bootloader revision was exercised. Clean source 6451ae44bbbd343a985507c0dd0dd8334f9e812c additionally passed all
57 update tests, including 23 preflight scenarios, in 60.040 seconds after
requiring a ready lock for reconciliation. A canceled, unreserved update with an
unconfirmed native uploader drain remains inhibited until reviewed draining
finishes; late completion alone cannot release it. Its 13 forced build/lint/
typecheck tasks passed. The evidence-only follow-up changes no tested code. This report records host integration only; no approved
physical bench, hardware revisions, real OS boot or passive restraint evidence
is available. All corresponding field gates remain blocked/unverified.
