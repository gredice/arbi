# ARBI public site

Next.js and Tailwind CSS site for [arbi.gredice.com](https://arbi.gredice.com). Its content is compiled from this repository at build time; the app holds no copies of documentation, models or BOM data.

The site is a single static page, `public/site/index.html`, served at `/` with hash routes for the home page, systems, parts, the BOM, documents and downloads. Its shared data and three.js layer is `public/site/shared/arbi.js`. The design is the selected "Manual + Ink" direction. White manual pages use heavy rules, condensed type and booklet-style line art. Exploded views sit in full-black sections that draw the same line art inverted, with each part's role readable: charcoal core in lighter gray, white shells in off-white, bought metal in mid gray. The cover is a scroll-driven teardown.

## Commands

```bash
pnpm --filter @arbi/docs dev
pnpm --filter @arbi/docs build
pnpm --filter @arbi/docs typecheck
```

`dev` and `build` first run `scripts/compile-data.mjs`. It writes the ignored `public/site/data` from committed sources and CI-built CAD releases only:

- `hardware/models.json` supplies models, revisions, statuses, sources and release output names.
- `bom/catalog`, `bom/assemblies` and `bom/generated/arbi-v1-hr-zagreb.json` supply systems, items, quantities, offers and the incomplete-cost summary.
- `docs/**/*.md`, `hardware/**/*.md` and `bom/README.md` supply the document index and rendered text. The text is bundled as JSON so the repository's Markdown check does not scan relocated copies.
- The payload-enclosure and winch booklet packs supply the assembly GLB, STL meshes, assembly and figure manifests, and line-art figures. A pack comes from the latest `cad-<commit>` release when every mesh it ships is a current registered output; otherwise the committed snapshot is used.
- Exploded views use the booklet renderer's own exploded figures, read from `figure-manifest.json`. The payload uses `overview-exploded` when the pack has it, else `enclosure-exploded`. The winch uses `cover-passive-exploded`, paired in order with `cover-passive-installed`. Concealed fasteners that the exploded figure omits stay in place. The site authors no geometry or poses.
- Registered fabrication meshes missing from the packs, such as the dock and corner-station parts, are downloaded from the release and checked against its `SHA256SUMS.txt`. Assemblies without assembly transforms show those meshes side by side and are labelled as a parts layout, not an assembly.
- Each model's download link is resolved at build time. A release asset is linked with its SHA-256. If the release lacks it, the link goes to the committed booklet pack that contains the mesh, pinned to the source commit.

The build needs no secrets. It reads the public GitHub release; set `ARBI_OFFLINE=1` to use committed snapshots only, or `ARBI_CAD_RELEASE=cad-<sha>` to pin a release. Turbo caching is disabled for this build because its output depends on the latest release. The page loads Tailwind, three.js, marked and fonts from CDNs in the browser.

## Deployment

The Vercel project is `arbi` in the Gredice team. It uses root directory `apps/arbi-docs`, Node.js 24, `ENABLE_EXPERIMENTAL_COREPACK=1`, and the custom domain `arbi.gredice.com`. It is connected to `gredice/arbi`: pushes to `main` deploy production and pull requests get previews. A new CAD release appears on the site at the next deployment.

To deploy a specific commit from the CLI, link a clean export of it to the `arbi` project first (`vercel link --scope gredice --project arbi`), then:

```bash
git archive --format=tar HEAD | tar -x -C /path/to/empty-dir
vercel deploy /path/to/empty-dir --prod --scope gredice \
  --build-env ARBI_SOURCE_COMMIT="$(git rev-parse HEAD)" --build-env ARBI_SOURCE_DATE="$(git log -1 --format=%cs)"
```

## Known gaps before the production site

- Releases must keep up with the registry. When a CAD release run fails, registered outputs missing from the latest release fall back to committed packs, and the downloads page lists the gap.
- Only the payload and winch have assembly transforms. Other assemblies show a parts layout until a booklet or assembly reference exports transforms for them.
- CSG reference assemblies have no browser mesh; their systems are shown from booklet meshes instead.
- Renders and CAD checks are not physical evidence. Every model is still `concept-unvalidated`.
