# Host update interruption matrix

[#78](https://github.com/gredice/arbi/issues/78) provides the opt-in host runner
from [ADR-0043](../decisions/0043-host-update-interruption-evidence.md).
After building Edge and dependencies, run
node scripts/update-interruption-evidence.mjs --output /private/directory/report.json
from the Edge package. The output parent must be private; the file is created
exclusively with mode 0600. It records the current Git commit, tree status and
compiled source digest. Review the report before committing secret-free evidence.

The runner creates and cleans independent private native fixtures and measures
real elapsed host time. It uses the existing protected identity/update boundary,
actual signed HTTP range responses, SQLite operation/trust/migration/budget/audit
and optional native signed Linux application files. It includes original actors,
sessions and audit correlation checks without publishing credentials.

| Scenario | Required source outcome |
| --- | --- |
| Ordered success | Pico model → native pod files → native edge files; one install each |
| Truncated range/restart | Durable 4096-byte prefix; explicit original-operation resume |
| Rejected retry | 8192 discarded payload bytes plus complete 70000-byte retry charged |
| Corrupt artifact | No installation; baseline remains confirmed |
| Lost target ACK | One durable model installation; readback, no resend |
| Unknown reservation | Recovery required; zero installation and no resend |
| Failed pod canary | Observed rollback; edge baseline untouched |
| Mixed version/security floor | Recovery required; incompatible rollback refused |
| Operation write interruption | Prior transaction intact; explicit recovery of same operation |
| SIGKILL after fsync/rename/trial/confirmation | Fresh native owner recovers signed complete bytes; one trial/install, persistent files retained |

Quiescent HTTP payload totals must equal original application charges and audit
byte observations. Every charge has a durable receipt, sequence streams have no
gaps and each outcome correlates to its original intent/actor/session. Packet,
TLS, carrier and power-loss accounting are not inferred from payload equality.

The canary policy is one ordered operation. Failure halts its later targets;
starting another release remains a separate authorized decision. The runner
does not certify fleet rollout or add a release manager. There is no actuator
connection; it cannot measure real output pulses or mechanical clearance.

Native SIGKILL tests exercise kernel locks, SQLite and fsynced file recovery,
not board reset, storage-controller brownout or a real OS boot. Pico remains
a SQLite slot model. Physical board/bootloader, pod/edge OS/storage, reviewed
retention and power-loss line clearance, secured-frame and installed recovery
remain blocked in the report and [commissioning gates](../operations/prototype-and-commissioning.md).
