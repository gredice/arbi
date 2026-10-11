# ADR-0046: Dashboard native fixture compilation dependencies

Status: proposed in the issue #33 PR. Scope: workspace build ordering.

Dashboard integration tests consume compiled Edge modules for native capture,
commissioning, update and producer references. Its typecheck includes those test
files. The hosted dashboard command filters Turbo to the Dashboard; the previous
package graph omitted Edge compilation and failed on missing native declarations.
CI's separate Edge prebuild masked the omission.

Declare the Edge build as a dependency of Dashboard build, lint, typecheck and
test tasks. Preserve ordinary upstream build/typecheck dependencies and task
outputs/caching. This describes compilation ordering without adding an Edge
runtime dependency to the web app or a production listener.

The existing app-specific settings already pass the production identity fields,
disable web-build caching and run the current protected-ref CI gate. They remain
the promotion owner. Real protected signing/publication acceptance still needs
its separately configured release environment and readback.
