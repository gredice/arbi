# Site installation

## Responsibility and boundary

The site installation defines where ARBI exists: the surveyed coordinate frame, bed and plant target regions, anchor locations, access zones, field routes, environmental assumptions, fiducials, and as-built records. It does not own the internal design of a corner station, winch, pod, dock, or cabinet, but it owns their installed locations and the interfaces between them.

## Repository baseline

- Current site: 25 raised beds.
- Planned capacity: 30 beds arranged as 3 rows × 10 columns.
- Bed: 2.0 × 1.0 m.
- Gap: 0.8 m.
- Calculated 30-bed footprint: 27.2 × 4.6 m.
- Recommended starting anchor rectangle: approximately 29.2 × 6.6 m, giving approximately 1 m margin around the bed footprint.
- Expected maximum plant height: 2.3 m.
- Target top-pulley height: approximately 3.0 m.
- Target normal camera-lens height: approximately 2.55–2.65 m.

All installed dimensions remain **unverified** until surveyed. See [site geometry](../../system/site-geometry.md).

## Installed elements

- four surveyed corner-station anchor points;
- one high dock attached near a selected corner;
- one fixed control cabinet and its protected service area;
- protected field power and signal routes;
- the four-line operating envelope;
- permanent bed and site fiducials;
- exclusion, public-access, and controlled maintenance zones;
- physical labels that map assemblies, axes, branches, and connectors to repository identifiers.

## Mechanical and civil work

Before fixing an anchor design, record soil type, drainage, frost or seasonal movement, prevailing exposure, underground services, paths, and public access. The current concept allows posts to be embedded directly in compacted ground without concrete only when the actual soil and pull-test evidence support it. Separate guy anchors are intended to react most horizontal load.

Installation drawings must show:

- post centers and effective pulley tangent coordinates;
- guy direction and anchor coordinates;
- dock envelope and approach path;
- cabinet base/mounting and service clearance;
- line spans, lowest predicted points, and crossing of any accessible area;
- bed, plant, path, fence, tree, building, and irrigation clearances;
- protected routes for fixed field conductors.

## Electrical and cabling

Mains service terminates at the fixed cabinet. Field installation beyond that boundary uses separately protected low-voltage branches and control cables. The site plan owns routing, burial or mechanical protection, separation, entry/exit seals, drainage loops, labels, and service access. The [control cabinet](../control-cabinet/README.md) owns source protection and terminal definitions; each endpoint assembly owns its connector, local strain relief, and internal wiring.

The installation needs a lightning and surge exposure review. Timber posts, long outdoor conductors, overhead lines, and a powered moving line cannot be considered safe merely because normal operating voltage is low.

## Fiducials and imaging zones

Use permanent, weather-resistant fiducials around the bed area, initially considering AprilTag-, ArUco-, or equivalently robust markers. Their exact family, size, material, placement, replacement interval, and optical calibration remain open.

Fiducials should support estimation of:

- X/Y image offset;
- camera rotation;
- perspective tilt;
- image scale;
- drift relative to known bed coordinates.

The site configuration must also define capture exclusions or masks for neighboring property, paths, and private areas. Public repository data must not expose precise site coordinates or camera credentials unless intentionally approved.

## OpenSCAD and fabricated items

Potential site-owned models include survey markers, fiducial holders, conduit or label supports, and non-structural installation gauges. OpenSCAD sources must use stable part IDs and reference the site coordinate/configuration revision. Printed fiducial holders do not establish marker accuracy without an as-built survey.

## Software and configuration

One versioned site configuration should be consumable by edge software, commissioning tools, visualization, and simulation. It should include units, coordinate-frame revision, anchors, dock, beds, fiducials, permitted workspace, exclusion regions, and uncertainty or margin values. Runtime software must reject an unknown or incompatible configuration revision.

## Installation sequence

1. Record site hazards, underground services, access, soil, drainage, and weather exposure.
2. Establish and monument the coordinate reference.
3. Survey proposed anchors, dock, cabinet, beds, paths, and field routes.
4. Review structural, electrical, privacy, and maintenance plans.
5. Install and inspect corner structures without positioning people below loaded work.
6. Install and test protected fixed wiring before connecting moving equipment.
7. Pull-test and resurvey corner structures using an approved procedure.
8. Install winches, lines, pod, dock, and fiducials in staged exclusion zones.
9. Measure as-built coordinates and line heights, then create a new immutable configuration revision.
10. Commission from reduced force/speed toward the approved envelope.

## Acceptance evidence

- Qualified review of soil, post, guy, anchor, wind, and environmental assumptions.
- Qualified review and test records for fixed electrical installation.
- As-built survey with uncertainty and named coordinate revision.
- Pull-test records and post-test movement/inspection results.
- Measured line clearance across all accessible areas in operating and parked configurations.
- Demonstrated fit of all 30 planned bed targets inside the safe workspace.
- Fiducial visibility and rectification results across representative light and crop conditions.
- Recorded exclusion, maintenance, privacy, and emergency-access zones.

## Open questions

- What are the actual site, soil, wind, lightning, drainage, and public-access conditions?
- Are the proposed anchor margin and approximately 3 m pulley height sufficient?
- Which paths or work areas require greater than the current 2.2 m minimum parked-line target?
- Where can the cabinet be placed while keeping branch lengths, service access, and network coverage acceptable?
- How will seasonal post movement and fiducial drift be detected and corrected?
