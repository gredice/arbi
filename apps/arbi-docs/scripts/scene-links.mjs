// Bought meshes keep their identity in the scene; navigation uses the BOM owner.
// Fallbacks support archived booklet packs from before bomPartId was recorded.
const references = {
  'motor-23HS40-reference': 'nema23-closed-loop-motor',
  'bearing-608': 'bearing-608-2rs',
  'shaft-collar-8': 'shaft-collar-8mm',
  'inner-ring-spacer': 'winch-mount-hardware',
  'coupling-hub': 'flexible-jaw-coupling-8mm',
  'coupling-spider': 'flexible-jaw-coupling-8mm',
  // These reference sizes have a unique owner in the archived winch scenes.
  'bolt-M4x16': 'winch-full-cover-hardware',
  'nut-M4': 'winch-full-cover-hardware',
  'bolt-M4x20': 'winch-mount-hardware',
  'bolt-M5x35': 'winch-mount-hardware',
  'bolt-M6x30': 'winch-mount-hardware',
  'washer-M6': 'winch-mount-hardware',
  'nyloc-M6': 'winch-mount-hardware',
  'nut-M5': 'winch-mount-hardware',
  'bolt-M4x45': 'winch-drum-joining-hardware',
};

export function sceneHref(model, registered, bomPartId, catalogIds) {
  if (registered) return `/parts/${model}`;
  const id = bomPartId ?? references[model] ?? (
    /^base-plate-/.test(model) ? 'winch-mount-hardware' :
    /^tie-rod-/.test(model) ? 'winch-drum-joining-hardware' :
    /^shaft-8x/.test(model) ? 'winch-drum-shaft-8mm' :
    /^loom-(passive|powered)-bottom-/.test(model) ? 'matched-motor-cable' : null
  );
  if (!id) return undefined;
  if (!catalogIds.has(id)) throw new Error(`Scene ${model} links to missing BOM part ${id}`);
  return `/bom/${id}`;
}
