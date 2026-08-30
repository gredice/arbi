# ADR-0001: Organize engineering information by physical assembly

- Status: Accepted
- Date: 2026-08-30

## Context

An assembly definition organized around component types such as structure, power, cabling, fasteners, printed parts, weather, and safety would mix those categories with physical assemblies such as the camera pod and dock. That makes ownership unclear: a winch cannot be assembled or validated from a “motion” list that omits its local wiring, fasteners, guard, printed drum, and maintenance evidence.

The project must support external contributors, hardware revisions, a calculated BOM, software, simulation, and a later merge into the Gredice monorepo.

## Decision

Primary engineering ownership follows real physical assemblies:

1. site installation;
2. corner station;
3. winch;
4. positioning lines;
5. camera pod;
6. dock;
7. control cabinet.

Each assembly documents its mechanical parts, electronics, cabling, connectors, fasteners, printed parts, software/firmware, environmental protection, safety controls, assembly, calibration, tests, and maintenance.

Cross-cutting concepts remain available as:

- catalog/BOM tags;
- shared conventions or standards;
- system-level interfaces and safety claims;
- queries and generated views.

They do not become owners of physical parts or quantities.

## Consequences

- A contributor can understand and build one assembly from one bounded documentation area plus shared interfaces.
- Quantities and acceptance evidence have an unambiguous owner.
- Shared parts may appear in several assembly manifests while retaining one catalog identity.
- Cables spanning assemblies require named endpoints and interface ownership rather than an orphan “cabling subsystem.”
- System-level documents are thinner and link to assembly detail.
- Cross-cutting concerns are intentionally split across the physical assemblies that own them.

## Alternatives considered

### Preserve component-type headings as primary sections

Rejected because those headings mix architecture levels and component types, and would retain the ownership problem.

### Organize solely by engineering discipline

Rejected because mechanical, electrical, software, and safety work must converge on the same physical revision and acceptance evidence.

### One monolithic design document

Rejected because it creates frequent conflicts, weak ownership, and poor navigation, while making it hard to version assembly interfaces independently.

## References

- [Documentation index](../README.md)
- [System architecture](../system/architecture.md)
- [Repository source-of-truth policy](../project/repository-source-of-truth.md)
