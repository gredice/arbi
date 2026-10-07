# ARBI public site

Next.js and Tailwind CSS site for [arbi.gredice.com](https://arbi.gredice.com). Its content is compiled from this repository at build time; the app holds no copies of documentation, models or BOM data.

The first slice hosts three design-direction mockups for choosing the visual direction. Each one covers the home page, system exploded views, part pages with a 3D viewer, the BOM, documents and downloads.

| Path | Direction |
| --- | --- |
| `/` | Direction chooser (`src/app/page.tsx`) |
| `/a` → `public/mockups/a-index.html` | Warm off-white catalogue with rounded tiles, mono labels, numbered callouts and shaded renders |
| `/b` → `public/mockups/b-studio.html` | Near-black full-bleed pages, a scroll-driven teardown on the home page and a hover HUD |
| `/c` → `public/mockups/c-manual.html` | White pages with heavy rules, live line-art 3D in the booklet style and IKEA-style bubbles |

## Commands

```bash
pnpm --filter @arbi/docs dev
pnpm --filter @arbi/docs build
pnpm --filter @arbi/docs typecheck
```

`dev` and `build` first run `scripts/compile-data.mjs`, which writes the ignored `public/mockups/data` from committed sources only:

- `hardware/models.json` supplies models, revisions, statuses, sources and release output names.
- `bom/catalog`, `bom/assemblies` and `bom/generated/arbi-v1-hr-zagreb.json` supply systems, items, quantities, offers and the incomplete-cost summary.
- `docs/**/*.md`, `hardware/**/*.md` and `bom/README.md` supply the document index and rendered text. The text is bundled as JSON so the repository's Markdown check does not scan relocated copies.
- The committed winch and payload-enclosure booklet packs supply the payload GLB, STL meshes, assembly and figure manifests, and line-art figures.

The build needs no secrets or network access beyond package installation. The mockup pages load Tailwind, three.js, marked and fonts from CDNs in the browser.

## Deployment

The Vercel project is `arbi` in the Gredice team. It uses root directory `apps/arbi-docs`, Node.js 24, `ENABLE_EXPERIMENTAL_COREPACK=1`, and the custom domain `arbi.gredice.com`. Git-triggered production and preview builds start once the Vercel GitHub app can access `gredice/arbi` and the project is connected. Until then, deploy a clean export of a commit from the CLI:

```bash
git archive --format=tar HEAD | tar -x -C /path/to/empty-dir
vercel deploy /path/to/empty-dir --prod --scope gredice \
  --build-env ARBI_SOURCE_COMMIT="$(git rev-parse HEAD)" --build-env ARBI_SOURCE_DATE="$(git log -1 --format=%cs)"
```

The export must be linked to the `arbi` project first (`vercel link --scope gredice --project arbi`).

## Known gaps before the production site

- The exploded poses are the only mockup-authored geometry data. The payload pose combines booklet figure offsets with layer rules in `public/mockups/shared/arbi.js`, and the winch pose uses simple rules per part. The production site should read an exploded pose exported by the booklet renderer.
- The corner station and dock have registered models but no compiled meshes or figures. CI would need to export them first.
- Meshes come from the committed booklet snapshots, and download links point to the latest `cad-<commit>` GitHub release. A production build should consume CI release outputs from the same commit.
- Renders and CAD checks are not physical evidence. Every model is still `concept-unvalidated`.
