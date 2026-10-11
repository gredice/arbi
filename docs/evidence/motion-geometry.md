# Motion geometry source evidence

Work record: [#52](https://github.com/gredice/arbi/issues/52). Decision: [ADR-0025](../decisions/0025-revision-bound-motion-model.md). Implementation: [guide](../software/motion-geometry.md).

Codex-executed source checks compare the actual C core with the simulator's TypeScript implementation, the existing independent analytical reference positions/cable lengths and 200 seeded interior positions, plus 50 seeded finite pulse traces. Count equality is exact; cable/pose comparisons use `1e-7 + 1e-12 × |expected|` millimetres. Different drum radii, full steps, microsteps, home cable/count references and alternating polarities are explicit in the synthetic fixture. The fixture is derived from the existing validated test configuration and never linked into the diagnostic target.

Lifecycle fixtures exercise a real finite pulse plan, every commanded word, one-shot start/completion, malformed numeric/unit/frame/rate/duration/travel rejection, all seven identity changes before start and during progress, latched inhibition, invalid model replacement and deliberate readiness restoration. The target link-check references the actual model functions; both ordinary and isolated-adapter branches must compile/link. Normal and AddressSanitizer/UndefinedBehaviorSanitizer host checks are recorded after the clean implementation commit.

| Evidence | Boundary |
| --- | --- |
| Shared/golden conversion agreement | Numerical source/host agreement; no installed position claim |
| Quantized segment travel/workspace checking | Constant-radius rectangular-anchor estimate only |
| Stale revision and incompatible replacement | Local inhibition/discard; no physical stopping response |
| Position/tension feedback | Measured channels unavailable; estimates never count as protection evidence |
| Physical driver, waveform, mechanics and safety | Unverified; ordinary firmware remains inhibited and unprovisioned |

No physical calibration, board execution, live position/tension, driver-interface acceptance or qualified review sign-off is supplied. Source agreement cannot enable loaded motion.
