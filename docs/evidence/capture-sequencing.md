# Capture sequencing source and camera bench evidence

Work record: [#53](https://github.com/gredice/arbi/issues/53). [Decision](../decisions/0033-traceable-synthetic-capture-sequencing.md), [guide](../software/capture-sequencing.md).

Ten groups exercise the actual command/configuration/gimbal composition with a synthetic camera and native SQLite/files: one valid PNG/raw receipt and reproducible metadata; semantic retries/conflicts/concurrency/old epochs; preview ownership; unavailable camera/focus/camera/timeouts and late abort; renewed motion/authority, quota and broken-clock refusal; cuts across reservation/image intent/write/rename/final acknowledgement; corruption/capacity/scope refusal; an actual SIGKILL child releasing the native lock and leaving an interrupted reservation; corrupt/truncated/dimension-incompatible PNG and profile refusal; declared UTC uncertainty and aged estimated pose. Clean revision and full pod checks are recorded after implementation.

The reference is a 32 × 24 RGB PNG checkerboard at values 40/220 with a declared synthetic focus result, exposure/gain profile and 30 ms synthetic gimbal settling window. It is not a real camera photograph, daylight measurement, lens focus score or accepted physical resolution. Actual PNG CRC/inflate checks, hashes, SQLite locking and filesystem writes are native host evidence; cuts/killed processes are not removal of board power.

| Camera bench acceptance item | Status |
| --- | --- |
| Actual pod/camera/lens/software/calibration revisions and named equipment | Unavailable; no target camera attached |
| Approved real still resolution, exposure/focus behavior and resource budgets | Unverified; synthetic bounded profile only |
| Representative daylight/lighting focus/framing thresholds and results | Unavailable; modeled focus score has no physical acceptance |
| Measured stop/settle/autofocus/capture latency and live preview contention | Unavailable; source sequencing and busy policy only |
| Actual power loss, storage durability and camera/servo restart behavior | Unavailable; native process/filesystem checks only |
| Raw capture versus processing/upload outcomes | Source contract keeps independent states; physical/cloud delivery remains separate |

#53 remains open for the named physical camera/lighting/settling bench. No real camera, source publication of private images or upload is performed.
