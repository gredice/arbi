"""Build the winch booklet and portable STL/source bundle from this checkout."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def build():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=REPO / 'hardware/generated/booklet')
    parser.add_argument('--publish', action='store_true', help='Copy PDF and ZIP to the repository booklet folder')
    parser.add_argument('--reuse-models', action='store_true', help='Reuse existing models only after checking CAD hashes and STL hashes')
    args = parser.parse_args()
    root = args.output.resolve()
    root.mkdir(parents=True, exist_ok=True)
    snapshot = root / 'source/arbi-hardware'
    source_files = list((REPO / 'hardware/lib').glob('*.scad'))
    source_files += list((REPO / 'hardware/assemblies/winch').glob('*.scad'))
    current_hashes = {str(p.relative_to(REPO / 'hardware')): hashlib.sha256(p.read_bytes()).hexdigest() for p in source_files}
    current_hashes['models.json'] = hashlib.sha256((REPO / 'hardware/models.json').read_bytes()).hexdigest()
    current_hashes['reference-parts.scad'] = hashlib.sha256((HERE / 'reference-parts.scad').read_bytes()).hexdigest()
    if args.reuse_models:
        assert json.loads((root / 'build-input-hashes.json').read_text()) == current_hashes, 'CAD changed; rerun without --reuse-models'
        for name in ['arbi-mesh-manifest.json', 'reference-mesh-manifest.json']:
            for entry in json.loads((root / name).read_text()):
                assert hashlib.sha256((root / entry['file']).read_bytes()).hexdigest() == entry['stl_sha256'], entry['file']
    for name in ['lib', 'assemblies/winch']:
        target = snapshot / name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(REPO / 'hardware' / name, target)
    shutil.copy2(REPO / 'hardware/models.json', snapshot / 'models.json')
    shutil.copy2(REPO / 'LICENSE', root / 'source/LICENSE-ARBI')
    for name in ['export_arbi.py', 'export_reference.py', 'render_figures.py', 'build_booklet.py', 'reference-parts.scad', 'requirements.txt']:
        shutil.copy2(HERE / name, root / 'source' / name)
    shutil.copytree(HERE / 'fonts', root / 'source/fonts', dirs_exist_ok=True)
    shutil.copy2(HERE / 'pack-README.md', root / 'README.md')
    hashes = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(snapshot.rglob('*.scad'))}
    (root / 'source-snapshot-hashes.json').write_text(json.dumps(hashes, indent=2)+'\n')
    provenance = {
        'repository': 'https://github.com/gredice/arbi',
        'base_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
        'note': 'Source hashes identify the exact build inputs; base commit may precede uncommitted revisions.',
        'cover_revision': '0.1.1', 'booklet_revision': 3,
    }
    (root / 'source-provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
    if not args.reuse_models:
        # Remove stale revision outputs before exporting, never mix two revisions.
        if (root / 'models').exists():
            shutil.rmtree(root / 'models')
        for name in ['export_arbi.py', 'export_reference.py']:
            subprocess.run([sys.executable, str(root / 'source' / name)], check=True)
        (root / 'build-input-hashes.json').write_text(json.dumps(current_hashes, indent=2)+'\n')
    for name in ['render_figures.py', 'build_booklet.py']:
        subprocess.run([sys.executable, str(root / 'source' / name)], check=True)
    archive = root / 'ARBI-winch-STL-pack.zip'
    # Explicit bundle members keep temporary renders and prior ZIPs out.
    members = [root / 'ARBI-winch-assembly-STL.pdf', root / 'README.md']
    members += list(root.glob('*.json'))
    for name in ['models', 'source', 'figures']:
        members += [p for p in (root / name).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted(members):
            z.write(path, Path('ARBI-winch-STL-pack') / path.relative_to(root))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert sum(n.endswith('.stl') for n in z.namelist()) == 45
    if args.publish:
        destination = REPO / 'docs/assemblies/winch/booklet'
        destination.mkdir(parents=True, exist_ok=True)
        for name in ['ARBI-winch-assembly-STL.pdf', 'ARBI-winch-STL-pack.zip']:
            shutil.copy2(root / name, destination / name)
    print(f'Booklet and 45-STL bundle: {root}', flush=True)


if __name__ == '__main__':
    build()
