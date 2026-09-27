---
name: create-assembly-booklets
description: Create or update illustrated mechanical assembly booklets from actual CAD and STL meshes, including exploded views, hardware references, fastener inventories, print-ready PDFs and reproducible model packs. Use for IKEA-like instructions, 3D-printed assemblies, updated assembly manuals after geometry changes, or requests to replace inaccurate drawings with real parts.
---

# Create assembly booklets

Build the instructions and illustrations from the same source geometry. Preserve the user's assembly intent while resolving part orientation, fastening order and access from evidence.

## Establish the assembly

1. Inspect repository instructions, CAD registry, BOM and existing booklet before editing. Find nested instructions. Treat canonical CAD as authoritative geometry; treat a reported physical interference as new evidence to investigate.
2. Identify the exact variant, units, revisions and quantities. Separate printable fabrication models from bought hardware and contextual plates. Record assumptions for unavailable supplier geometry.
3. Read the PDF skill when producing a PDF. For ARBI, read `references/arbi-workflow.md`; use the repository's generator rather than duplicating it.
4. Proceed with reversible work using available evidence. Ask for measurements only when unresolved dimensions prevent a useful design; otherwise label the chosen envelope and its limits.

## Model and check

- Export fabrication STLs directly from registered CAD. Do not approximate custom printed parts with invented solids or generated imagery.
- Model bought hardware from supplier drawings or stated nominal dimensions. Include screws, washer diameters, nuts, protruding ends, mounting slots and adjustment ranges around affected interfaces. Label simplified references; do not present them as supplier-certified manufacturing models.
- For an interference fix, reproduce the old collision and check the revised geometry against the hardware envelope. Check assembly/removal paths and fastener access as well as the final pose. Keep nominal hardware clearance distinct from physical validation.
- Bump affected model revisions and update registry/BOM references together. Preserve unrelated geometry and user changes.
- Export through temporary files, read the written STL back, and validate non-empty triangles, watertightness, consistent winding, positive volume, connected bodies and dimensions. Keep hashes and source provenance. Never equate a successful export with a printable or load-qualified assembly.

## Illustrate and assemble the booklet

1. Render the actual STL files with a CAD renderer, VTK or Blender. Save each part's filename and assembly transform in a figure manifest. Resolve output filenames from the registry, not a hard-coded revision suffix.
2. Check handed parts, section order, shared coordinate axes and one pin per actual joint. Render disassembly/exploded views by transforming the same meshes.
3. Use restrained labels, arrows, part IDs and quantities. Show important hidden hardware in a dedicated view. Use a consistent camera convention and embedded fonts. Avoid hiding fit-critical fasteners to make a picture appear correct.
4. Include inventory, ordered assembly steps, fastening order, orientation cues, a fastener table, variant scope and final unpowered inspection. Put fit envelopes and hardware-dependent screw lengths beside the relevant step.
5. Show revised parts and describe what must be reprinted. Do not silently re-use old renders after modifying geometry.

## Deliver and preserve

- Rebuild from the final source. Render every PDF page and inspect legibility, clipping, page numbering and part visibility. Verify the output archive contains the current STL revisions and no stale replacements.
- Run narrow repository CAD/BOM/docs checks and the affected interference regression. Report checks separately from unperformed physical testing.
- Preserve editable sources, build dependencies, model/figure manifests and source hashes. Use the project's normal generated-artifact policy; when the user explicitly requests checked-in exports, document that release snapshot without changing canonical-source policy.
- Commit only requested project changes. Push or publish according to the user's authorization. Save non-repository artifacts through the applicable file workflow. Deliver the PDF and model pack with concise limits and the revised-part download when useful.
