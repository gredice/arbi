# Dock assembly PDF and STL/source pack

The DOCK-IF-01 ten-page illustrated assembly guide and matching print/source ZIP
are generated from the current canonical dock and compact-pod meshes.
They describe a concept-unvalidated, supported-dummy bench kit.
The current source configuration includes roof quadrants and the assembled
reference at revision `0.3.0`, guide quadrants at `0.2.0` and four new lower
panels at `0.1.0`. See the [rounded-shelter record](../rounded-shelter.md) and
[lower-enclosure record](../lower-enclosure.md) for dimensions, reprint scope,
dedicated fastening and nominal service checks.

The versioned [CAD releases](https://github.com/gredice/arbi/releases) publish:

- `ARBI-dock-assembly-STL.pdf`: actual-mesh assembly steps, inventory, inspection
  and remaining acceptance gates.
- `ARBI-dock-STL-pack.zip`: that exact PDF, thirteen fabrication models in installed
  and print poses, contextual current pod/post/lines, canonical sources, figures,
  geometry report and complete file hashes.

Use the website's current verified release links above when available. A PR CI
artifact is a review snapshot; a merged source tree does not prove that the new
CAD-release assets have finished publishing. No stale committed PDF or ZIP is
presented as the current guide.

See the [assembly guide](../assembly-guide.md), [design package](../design-package.md)
and [builder](../../../../scripts/dock-booklet/README.md). Print only
`models/print`, one part per bed; context meshes are not dock fabrication sources.
Actual printer/slice, post, pod mass, structural joints, release hardware,
observations, line sweep and weather acceptance remain pending.
