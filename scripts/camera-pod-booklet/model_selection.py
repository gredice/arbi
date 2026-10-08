"""Select the current enclosure or the explicitly requested dry bench alternative."""

ENCLOSURE_ONLY = {
    'camera-pod-integrated-deck', 'camera-pod-integrated-camera-hood',
    'camera-pod-integrated-gimbal-head', 'camera-pod-integrated-gimbal-carrier',
    'camera-pod-integrated-camera-cradle', 'camera-pod-integrated-tilt-pivot-support',
    'camera-pod-rain-hood', 'camera-pod-enclosure-base',
}


def selected_models(registry, enclosure):
    candidates = list(registry['models'])
    if not enclosure:
        candidates += [m for m in registry.get('archivedModels', [])
                       if m.get('alternativeConfiguration') == 'camera-pod-bench']
    return [m for m in candidates
            if m['assembly'] == 'camera-pod' and m['artifactRole'] == 'fabrication'
            and m['id'].startswith('camera-pod-')
            and (enclosure or m['id'] not in ENCLOSURE_ONLY)]
