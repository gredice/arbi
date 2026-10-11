# Image calibration, quality and resource evidence

Work record: [#58](https://github.com/gredice/arbi/issues/58), [decision](../decisions/0034-bounded-synthetic-image-rectification.md), [guide](../software/image-processing.md).

Nine groups cover exact golden crop pixels/transform/digests; independently calculated projective corner equations; analytic radial correction and distorted markers; missing/ambiguous markers, degenerate geometry, blur/exposure; missing/incompatible/invalid calibration; actual #53 receipt/PNG and missing-marker fallback; retry identity/revision changes/byte selection; work/time/abort/concurrency/close bounds; and corruption/truncation/independent Python PNG filters 0–4. Capture and upload remain independent; physical calibration acceptance stays false.

The actual pod implementation produced the committed integration fixture at clean source `5835fa2d4959f8cdd87bcc3ee2c7d47dc1f3af1a`, with applied configuration, unavailable UTC/pose, synthetic camera/gimbal provenance and raw checksum. Coloured marker fixtures exercise geometry separately. Neither is a real photograph or survey.

Clean source `11aee90a8a63145d087c5b020ef6a4598a0fa5da` reports `dirty=false`. All nine processing groups pass; the broader scoped edge suite passes 210 tests, including its native SQLite/transport, sixty-second diagnostics soak and process-interruption matrix. TypeScript lint/typecheck/build, 322-document link validation, producer syntax and whitespace pass. The unmodified Linux systemd check is excluded locally because `/usr/bin/node` is absent; CI stages that path.

The named source reference ran on Linux x64 kernel 6.18.44, Node 24.19.0, AMD EPYC 9V74, five exposed logical CPUs and 18,882,699,264 host memory bytes. It processed a 512×512 RGB checkerboard with four 5×5 colour markers to a 512×512 output five times using the 5,000 ms ceiling. Each run consumed 5,770,552 counted work units from the 8,000,000 ceiling, input 3,280 bytes and derivative 23,099 bytes. All five runs returned identical logical IDs and derivative SHA `c121deab7bedae950c40c97f24c3d0ead5dc6daa4a686cfb92e294d0567501a9`.

| Run | Elapsed ms, including worker termination | Process CPU user ms | Process CPU system ms |
| --- | --- | --- | --- |
| 1 | 1,026.5 | 1,632.0 | 54.4 |
| 2 | 931.4 | 1,478.2 | 48.1 |
| 3 | 989.6 | 1,486.6 | 59.8 |
| 4 | 977.8 | 1,416.0 | 39.8 |
| 5 | 957.1 | 1,385.7 | 48.2 |

Whole-process RSS was 141,053,952 bytes before the worker runs and reached a sampled peak of 205,504,512 bytes at a 5 ms sampling interval. CPU includes all process threads; sampling can miss shorter memory peaks and does not measure disk growth because this processor writes no files. Other test processes shared the host. This generic development-host run does not establish selected-device latency, cgroup-constrained performance, full camera resolution or physical accuracy.

| Named bench acceptance | Status |
| --- | --- |
| Released camera/lens/focus intrinsic/distortion calibration | Unavailable; source model only |
| Approved fiducial family, survey/reference target and accuracy uncertainty | Unavailable; fictional colour components |
| Real bed/plant spatial accuracy and repeatability across views | Unmeasured; analytical pixel fixtures only |
| Outdoor focus/blur/exposure thresholds, shadow/occlusion/aging | Unmeasured; synthetic thresholds only |
| Selected edge resolution/CPU/RSS/storage/runtime budgets | Unmeasured; generic Linux reference only |
| Full capture/storage/processing/upload orchestration | Actual capture fixture/adapter verified; #66 owns composition |

#58 remains open for physical accuracy/repeatability and selected-host acceptance. No private site data, real capture, image upload, retention deletion or motion is performed.
