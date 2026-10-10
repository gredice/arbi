// Add targets only with an implemented executable, build and owning CI suite.
// Pico SDK/compiler pins belong here when real Pico source is introduced.
export const targets = [{
    id: 'edge', workspace: '@arbi/edge-controller', path: 'apps/arbi-edge-controller',
    runtime: 'linux-x64-node24', node: '24.15.0', runner: 'ubuntu-24.04',
    entrypoint: 'dist/cli.js',
    target: { moduleId: 'edge', targetClass: 'linux-edge', boardId: 'synthetic-linux-edge',
        hardwareId: 'edge-model', hardwareRevision: '1.0.0', assemblyId: 'control-cabinet', assemblyRevision: '1.0.0' },
}];
