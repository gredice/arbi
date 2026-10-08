# ARBI public site

Next.js and Tailwind CSS site for [arbi.gredice.com](https://arbi.gredice.com). Its content is compiled from this repository at build time; the app holds no copies of documentation, models or BOM data.

Every page is statically generated at build time with the Next.js App Router:

| Route | Content |
| --- | --- |
| `/` | Cover with a scroll-driven teardown of the camera pod, statistics, contents and the BOM total |
| `/systems`, `/systems/[slug]` | Physical assemblies; each has a black exploded-view stage with numbered parts and a hover-linked parts inventory |
| `/systems/winch-powered` | Powered winch configuration with its own booklet pose and installed parts inventory; linked from the passive winch page |
| `/parts`, `/parts/[id]` | Every registered CAD model with a 3D viewer (line art or shaded), registry metadata, BOM link and verified downloads |
| `/bom`, `/bom/[id]` | The generated BOM report and one page per catalog item |
| `/docs`, `/docs/[...slug]` | `docs/**`, `hardware/**` and `bom/README.md` rendered from Markdown with repository links mapped to site routes |
| `/downloads` | CAD release assets, archived committed booklet snapshots and per-model files with SHA-256 |

The design is the selected "Manual + Ink" direction. White manual pages use heavy rules, condensed type and booklet-style line art. Exploded views sit in full-black sections that draw the same line art inverted, with each part's role readable: white shells in pure white, the charcoal core in neutral lighter gray, bought metal in mid gray.

Code layout: `src/lib/site.ts` reads the compiled data on the server; `src/lib/markdown.ts` renders documents; `src/components/three/viewer.ts` is the three.js viewer used by the client components `CoverTeardown`, `SystemExplorer` and `PartViewer`. Links from the earlier single-page site (`#/systems/winch`) are forwarded to their routes.

Line art combines sharp feature edges and open boundaries with camera-dependent silhouettes, so rounded surfaces keep a continuous outline while orbiting, zooming or exploding an assembly. Coplanar triangle edges stay hidden. Mesh adjacency is cached; contour buffers belong to each displayed instance and are released with the viewer.

The shaded part view uses a bounds-fitted Z-up studio with key, fill and rim
lights, filtered self shadows and a transparent floor shadow. A bundled room
environment supplies reflections for satin shells and metal parts; filmic tone
mapping keeps highlights readable. Denoised ambient occlusion adds depth to
recesses and contact points, with its resolution capped independently of the
display. The floor is excluded from CAD envelopes and
camera fitting. Lighting, shadow and environment resources are released when
switching views. Line and ink drawings keep their exact flat colors.

Embedded viewers preserve vertical touch scrolling, browser pinch zoom and
mouse-wheel page scrolling. Mouse dragging still rotates a model. The cover's
explosion follows page scrolling; assembly pages also have an explosion slider.
Contents previews render their CAD scenes once at display resolution, with a
fitted camera and full-pixel outlines instead of downscaled booklet PNGs.
The scenic concept image retains its full aspect ratio, color and frame spacing.
The header and footer use the vector ARBI logo, with a white footer variant and
Gredice attribution and flags from the repository's brand assets.

## Commands

```bash
pnpm --filter @arbi/docs dev
pnpm --filter @arbi/docs build
pnpm --filter @arbi/docs typecheck
pnpm --filter @arbi/docs test
```

`dev` and `build` first run `scripts/compile-data.mjs`. It writes the ignored `public/data` from committed sources and CI-built CAD releases only:

- `hardware/models.json` supplies models, revisions, statuses, sources and release output names.
- `bom/catalog`, `bom/assemblies` and `bom/generated/arbi-v1-hr-zagreb.json` supply systems, items, quantities, offers and the incomplete-cost summary.
- `docs/**/*.md`, `hardware/**/*.md` and `bom/README.md` supply the document index and rendered text. The text is bundled as JSON so the repository's Markdown check does not scan relocated copies.
- The payload-enclosure and winch booklet packs supply the assembly GLB, STL meshes, assembly and figure manifests, and line-art figures. A pack comes from the latest `cad-vMAJOR.MINOR.PATCH` release after its checksums, release input hashes, registered outputs and embedded CAD/booklet sources match the checkout. Production rejects missing or stale releases and packs instead of falling back to old assemblies. Preview builds may use a source-checked committed pack; otherwise the affected scene is omitted until its release is ready.
- Exploded views use the booklet renderer's own exploded figures, read from `figure-manifest.json`. The payload uses `overview-exploded` when the pack has it, else `enclosure-exploded`. Passive and powered winches pair `cover-passive-installed`/`cover-passive-exploded` and `cover-powered-installed`/`cover-powered-exploded`, respectively. Inventories count instances within the selected configuration; BOM costs still describe the full four-winch set. Concealed fasteners that the exploded figure omits stay in place. The site authors no geometry or poses.
- Registered fabrication meshes missing from the packs, such as the dock and corner-station parts, are downloaded from the release and checked against its `SHA256SUMS.txt`. Assemblies without assembly transforms show those meshes side by side and are labelled as a parts layout, not an assembly.
- `ARBI-CAD-previews.zip` supplies a fitted figure for every registered model: fabrication parts use line art, and CSG reference assemblies use shaded CAD previews. The release renderer generates it from canonical CAD. The compiler verifies the pack checksum, model identity, complete transitive source hashes and image checksum; preview builds can fall back to booklet drawings when a preview is missing or stale. Production requires a current figure for every registered model. See [preview generation](../../scripts/cad-previews/README.md). `ARBI_CAD_PREVIEW_PACK` can point to a locally generated pack for offline review.
- Each model's download link is resolved at build time. A release asset is linked with its SHA-256. Preview builds can fall back to a committed pack only after checking its source hashes, pinned to the site source commit. Archived packs are listed separately and never offered as current fabrication downloads.

The build needs no secrets. It reads the public GitHub release; set `ARBI_OFFLINE=1` for an explicit local preview of archival committed snapshots, or `ARBI_CAD_RELEASE=cad-v0.1.0` to pin a source-matched release. Production (`VERCEL_ENV=production`) rejects offline mode and requires a complete release; previews omit stale scenes and links. Turbo caching is disabled for this build because its output depends on the latest release. three.js, Tailwind CSS, marked and the fonts are bundled at build time; the site loads nothing from CDNs.

Compiler tests use `ARBI_DATA_DIR` to write to a temporary output directory
without replacing the running site's `public/data`.

## Deployment

The Vercel project is `arbi` in the Gredice team. It uses root directory `apps/arbi-docs`, Node.js 24, `ENABLE_EXPERIMENTAL_COREPACK=1`, and the custom domain `arbi.gredice.com`. It is connected to `gredice/arbi`: pushes to `main` deploy production and pull requests get previews. When the CAD release workflow publishes Latest, it requests a production rebuild through the project's `cad-release` deploy hook. `ARBI_SITE_DEPLOY_HOOK` is required: a missing hook or failed request fails the workflow, as does failure to observe the current release (or a subsequent one) on the public site within ten minutes. Rerunning the workflow reuses the immutable release and retries the refresh. A Git-triggered production build that runs before its new CAD release is available fails; Vercel retains the last successful deployment until the release-triggered rebuild passes. Documentation/BOM-only merges can reuse a release whose CAD/booklet input hashes still match.

To deploy a specific commit from the CLI, link a clean export of it to the `arbi` project first (`vercel link --scope gredice --project arbi`), then:

```bash
git archive --format=tar HEAD | tar -x -C /path/to/empty-dir
vercel deploy /path/to/empty-dir --prod --scope gredice \
  --build-env ARBI_SOURCE_COMMIT="$(git rev-parse HEAD)" --build-env ARBI_SOURCE_DATE="$(git log -1 --format=%cs)"
```

## Known gaps before the production site

- A failed CAD release or site refresh retains the last successful production site; fix or rerun the failing workflow. New geometry cannot appear until CAD export and booklet checks pass. Historical committed snapshots are explicitly archived.
- Only the payload and winch have assembly transforms. Other assemblies show a parts layout until a booklet or assembly reference exports transforms for them.
- CSG reference assemblies have no browser mesh; their systems are shown from booklet meshes instead.
- Renders and CAD checks are not physical evidence. Every model is still `concept-unvalidated`.
