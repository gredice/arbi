"""Select the current enclosure or the explicitly requested dry bench alternative."""

ENCLOSURE_ONLY = {
    'payload-integrated-deck', 'payload-integrated-camera-hood',
    'payload-integrated-gimbal-head', 'payload-integrated-gimbal-carrier',
    'payload-integrated-camera-cradle', 'payload-integrated-tilt-pivot-support',
    'payload-rain-hood', 'payload-enclosure-base',
}


def selected_models(registry, enclosure):
    candidates = list(registry['models'])
    if not enclosure:
        candidates += [m for m in registry.get('archivedModels', [])
                       if m.get('alternativeConfiguration') == 'payload-bench']
    return [m for m in candidates
            if m['assembly'] == 'camera-pod' and m['artifactRole'] == 'fabrication'
            and (m['id'] == 'camera-pod-spider' or m['id'].startswith('payload-'))
            and (enclosure or m['id'] not in ENCLOSURE_ONLY)]
