# ARBI industrial design conventions

The owner selected the integrated payload concept on 7 October 2026. This establishes the appearance baseline when merged; the artwork is a shape and finish reference, not dimensional CAD or physical evidence. [ADR-0007](../decisions/0007-integrated-product-design.md) records its boundaries.

![Owner-selected integrated payload concept](../assets/payload-concept.png)

## Product language

| Role | Convention | Preview color |
| --- | --- | --- |
| Protective shell | Warm white, broad rounded crown, continuous perimeter, removable for service | `#f0f0eb` |
| Structural core | Charcoal spider, body, brackets, yoke and cradle; visually one central assembly | `#1f2426` |
| Optical surround | Small white rounded bezel; unobstructed dark lens opening | Shell white |
| Bought metal | Neutral silver, visible where required for assembly and inspection | `#a8b3ba` |
| Electronics | Actual board/component colors in service views | Green PCB / dark components |

These are presentation colors, not a filament, coating, UV rating or material approval. Shared OpenSCAD colors live in [arbi.scad](../../hardware/lib/arbi.scad); mesh renderers use the same roles. Booklets use white backgrounds, dark typography, thin gray dividers, numbered steps and restrained dark arrows. Identify components by IDs and callouts rather than alternate blue/orange product colors.

Use rounded rectangles, capsule-ended arms and broad shoulders. Avoid a stack of unrelated visible electronics boxes. A compact shell covers the fixed electronics; a continuous dark perimeter links the shell visually to the spider. Preserve removable panels, fastener access, drainage, ventilation and harness exits. Keep an open underside around the complete gimbal sweep. Do not close an aperture just to improve the silhouette.

## Engineering application

The payload rain enclosure is coordinated with the owning payload design work. Its canonical model registry, assembly definition, harness passages, fastener list and geometry evidence determine the actual dimensions and print quantities. The accepted art supplies appearance only. Preserve Pi, camera, stock servo-horn, spider and pivot interfaces where the checked design permits; identify each required replacement print by model revision. The original flying mass budget remains a separate requirement.

The integrated rain kit is the preferred public pod preview. Keep open, exploded and historical dry-bench views explicitly labelled by configuration. Retain historical fabrication sources for traceability; they are alternatives rather than a combined print list. Do not silently add the old electronics cover under the rain hood.

Apply the role palette to winch drum/mount previews and both published booklets. The existing coupling guard is white, while drum, bearing supports and motor stand are dark. Its dimensions are unchanged. Dock protection, corner-station housings and the control-cabinet outer enclosure should use white rounded protective surfaces over dark fixtures when their housing geometry is designed. Existing dock/funnel load and capture surfaces retain their committed dimensions. The full winch cover is subsequent work after this convention is merged; this change does not invent its clearances or obscure rotating hardware in assembly instructions.

## Preview and publication rules

- Show the covered integrated pod in hero and final assembly views; include open and exploded views for assembly/service.
- Render engineering illustrations from registered CAD/STLs and retain filenames, transforms and source hashes. Mark scenic art as concept imagery.
- Regenerate both PDF and source/mesh pack after CAD or renderer changes. Include the current revisions and no stale replacement files.
- Keep concept artwork separate from CAD acceptance records. No image, render, simulation or source check demonstrates strength, weather resistance, fit, mass, thermal performance or safe suspension.
- Ordinary rain and splash, +/-90 degree pan and 0..70 degree tilt are targets. Rigid sampled clearance checks must name the tested revision and nominal hardware; actual flexible cables, sealed entries, heat and received-unit fit need physical evidence.
