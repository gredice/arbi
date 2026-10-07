# ADR-0007: Integrated white-shell / black-core product design

- Status: Accepted appearance baseline on merge
- Date: 2026-10-07

## Context

The owner selected new payload concept art and requested consistent hardware designs, previews and assembly booklets. Previous previews presented exposed electronics and used unrelated blue, orange and gold surfaces. The artwork does not establish fabrication dimensions or validate outdoor operation.

## Decision

Adopt the [industrial design conventions](../project/industrial-design.md): a rounded white protective shell over a charcoal structural core, an open gimbal aperture and a small white optical surround. Keep purchased metal neutral and show electronics in service views. Canonical geometry remains OpenSCAD and booklet figures remain actual mesh renders.

Adapt the existing nominal payload bench configuration with a rounded removable shell and continuous lower perimeter. Preserve component/fastener patterns, stock servo horns, travel stops, architecture and the flying mass requirements. Record each affected part revision and compatibility change, update registry/BOM together, and regenerate evidence and all booklet packs. Consolidate default pod previews on the integrated kit while retaining the historical kit through an explicit legacy view.

Use the same roles for existing winch previews and the coupling guard. Design a full winch cover in separate follow-up work after merge, against the actual assembly, line path, motor heat, mounting hardware and service envelope.

## Consequences and evidence

The [enclosure configuration](../../hardware/assemblies/camera-pod/payload-enclosure.md) identifies the revised deck/yoke and five additional shields; it replaces the dry cover. The existing spider and remaining mounts can be reused as listed. No suspended use, weather rating or mass compliance is established by the appearance decision. All affected geometry remains `concept-unvalidated`. The [enclosure geometry record](../../hardware/assemblies/camera-pod/payload-enclosure-check.md) distinguishes sampled nominal CAD checks from physical validation. Broader housing geometry must retain its assembly's mechanical and safety requirements, with registered parts, explicit compatibility revisions and owning evidence.
