# Image calibration, quality and resource evidence

Work record: [#58](https://github.com/gredice/arbi/issues/58), [decision](../decisions/0034-bounded-synthetic-image-rectification.md), [guide](../software/image-processing.md).

Nine groups cover exact golden crop pixels/transform/digests; independently calculated projective corner equations; analytic radial correction and distorted markers; missing/ambiguous markers, degenerate geometry, blur/exposure; missing/incompatible/invalid calibration; actual #53 receipt/PNG and missing-marker fallback; retry identity/revision changes/byte selection; work/time/abort/concurrency/close bounds; and corruption/truncation/independent Python PNG filters 0–4. Capture and upload remain independent; physical calibration acceptance stays false.

The actual pod implementation produced the committed integration fixture at clean source `5835fa2d4959f8cdd87bcc3ee2c7d47dc1f3af1a`, with applied configuration, unavailable UTC/pose, synthetic camera/gimbal provenance and raw checksum. Coloured marker fixtures exercise geometry separately. Neither is a real photograph or survey.

Clean edge checks and generic Linux host resource measurements are recorded after source commit. The selected edge hardware is unavailable.

| Named bench acceptance | Status |
| --- | --- |
| Released camera/lens/focus intrinsic/distortion calibration | Unavailable; source model only |
| Approved fiducial family, survey/reference target and accuracy uncertainty | Unavailable; fictional colour components |
| Real bed/plant spatial accuracy and repeatability across views | Unmeasured; analytical pixel fixtures only |
| Outdoor focus/blur/exposure thresholds, shadow/occlusion/aging | Unmeasured; synthetic thresholds only |
| Selected edge resolution/CPU/RSS/storage/runtime budgets | Unmeasured; generic Linux reference only |
| Full capture/storage/processing/upload orchestration | Actual capture fixture/adapter verified; #66 owns composition |

#58 remains open for physical accuracy/repeatability and selected-host acceptance. No private site data, real capture, image upload, retention deletion or motion is performed.
