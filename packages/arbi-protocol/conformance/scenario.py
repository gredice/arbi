"""Independent bounded offline scenario consumer. Standard library only, no devices/network.
Checks the closed scenario structure and the selected reference command subset.
Not a production protocol/configuration validator or motion/safety controller.
"""
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import sys
from datetime import datetime

MAX_BYTES = 262144
INVARIANTS = ['within-workspace', 'truthful-feedback', 'rejected-no-dispatch', 'local-progress-offline', 'bounded-trace']
PROVENANCE = {
    'model': {'id': 'arbi.affine-reference', 'revision': '1.0', 'buildId': 'affine-reference-1'},
    'controller': {'id': 'arbi.protocol-reference', 'revision': '1.0', 'buildId': 'protocol-reference-1'},
    'runner': {'id': 'arbi.offline-runner', 'revision': '1.0', 'buildId': 'offline-runner-1'},
    'evidence': 'synthetic-host-reference', 'fidelity': 'affine-kinematic-no-dynamics',
}
TRANSITIONS = {'requested': ['accepted', 'rejected', 'cancelled', 'failed'], 'accepted': ['running', 'failed', 'cancelled'], 'running': ['completed', 'failed', 'cancelled'], 'rejected': [], 'completed': [], 'failed': [], 'cancelled': []}


def fail(code):
    raise ValueError(code)


def canonical(v):
    # Normalized trace fields are ASCII and safe integers, matching configuration 1.0.
    return json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=True, allow_nan=False)


def digest(v):
    return hashlib.sha256(canonical(v).encode()).hexdigest()


def equal(a, b, code='RESULT_MISMATCH'):
    if a != b:
        fail(code)


def q6(v):
    n = math.floor(v * 1000000 + 0.5)
    if abs(n) > 9007199254740991:
        fail('NUMERIC_LIMIT')
    return n


def trajectory(start, target, duration, elapsed):
    f = min(elapsed / duration, 1)
    return {k: start[k] + (target[k] - start[k]) * f for k in 'xyz'}


def bounded_read(path):
    if path.stat().st_size > MAX_BYTES:
        fail('SCENARIO_TOO_LARGE')
    try:
        v = json.loads(path.read_text(), parse_constant=lambda _: fail('INVALID_JSON'))
    except (json.JSONDecodeError, RecursionError):
        fail('INVALID_JSON')
    nodes = 0

    def bound(x, depth):
        nonlocal nodes
        nodes += 1
        if depth > 32 or nodes > 20000 or isinstance(x, str) and len(x) > 32768:
            fail('INPUT_LIMIT')
        if isinstance(x, dict):
            for key, child in x.items():
                if len(key) > 128:
                    fail('INPUT_LIMIT')
                bound(child, depth + 1)
        elif isinstance(x, list):
            for child in x:
                bound(child, depth + 1)
    bound(v, 0)
    return v


def structure(node, v, owner, schemas):
    """Only the structural JSON Schema subset used by scenario/selected message records."""
    if '$ref' in node:
        url, pointer = node['$ref'].split('#')
        root = schemas[url] if url else owner
        target = root
        for part in pointer.strip('/').split('/'):
            target = target[int(part)] if isinstance(target, list) else target[part]
        return structure(target, v, root, schemas)
    if 'const' in node and v != node['const'] or 'enum' in node and v not in node['enum']:
        return False
    if 'oneOf' in node:
        return sum(structure(n, v, owner, schemas) for n in node['oneOf']) == 1
    if 'anyOf' in node:
        return any(structure(n, v, owner, schemas) for n in node['anyOf'])
    typ = node.get('type')
    if typ == 'object':
        if not isinstance(v, dict) or not set(node['required']) <= set(v) or not set(v) <= set(node['properties']):
            return False
        return all(structure(node['properties'][key], child, owner, schemas) for key, child in v.items())
    if typ == 'array':
        return isinstance(v, list) and node.get('minItems', 0) <= len(v) <= node.get('maxItems', 20000) and all(structure(node['items'], x, owner, schemas) for x in v)
    if typ in ('number', 'integer'):
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or typ == 'integer' and v != math.floor(v):
            return False
        return node.get('minimum', -math.inf) <= v <= node.get('maximum', math.inf)
    if typ == 'string':
        if not isinstance(v, str) or not node.get('minLength', 0) <= len(v) <= node.get('maxLength', 32768) or 'pattern' in node and not re.search(node['pattern'], v):
            return False
        if node.get('format') == 'date-time':
            try:
                datetime.strptime(v, '%Y-%m-%dT%H:%M:%S.%fZ')
            except ValueError:
                return False
    if typ == 'boolean' and not isinstance(v, bool) or typ == 'null' and v is not None:
        return False
    return True


def inside(p, c):
    return all(c['limits']['workspace']['minMm'][k] + c['calibration']['uncertaintyMm'] <= p[k] <= c['limits']['workspace']['maxMm'][k] - c['calibration']['uncertaintyMm'] for k in 'xyz')


def validate(s, c, reference_digest, root):
    equal(s.get('schemaVersion'), 'arbi.scenario/1.0', 'UNSUPPORTED_SCHEMA')
    equal(s.get('units'), dict(position='mm', angle='deg', speed='mm/s', acceleration='mm/s^2', force='N', time='ms', voltage='V'), 'UNIT_MISMATCH')
    schema = json.loads((root / 'schema/scenario.schema.json').read_text())
    message = json.loads((root / 'schema/message.schema.json').read_text())
    if not structure(schema, s, schema, {schema['$id']: schema, message['$id']: message}):
        fail('INVALID_SCENARIO')
    i = s['identity']
    equal([c['schemaVersion'], c['revision'], digest(c), c['geometry']['revision'], c['calibration']['revision'], reference_digest], [i['configurationSchema'], i['configurationRevision'], i['configurationDigest'], i['geometryRevision'], i['calibrationRevision'], i['referenceDigest']], 'IDENTITY_MISMATCH')
    if c['realm']['environment'] == 'production' or c['executionMode'] != 'simulation' or c['calibration']['scope'] != 'simulation':
        fail('IDENTITY_MISMATCH')
    equal([c['geometry']['siteFrame'], c['geometry']['gimbalFrame']], [i['siteFrame'], i['gimbalFrame']], 'FRAME_MISMATCH')
    equal(s['provenance'], PROVENANCE, 'UNSUPPORTED_MODEL')
    clock = s['clock']
    start, duration, step = clock['startMs'], clock['durationMs'], clock['stepMs']
    on_grid = lambda at: start <= at <= start + duration and (at - start) % step == 0
    if duration % step or duration / step + 1 > 512:
        fail('CLOCK_INVALID')
    initial = s['initial']
    if not inside(initial['positionMm'], c) or not c['limits']['panDeg']['min'] <= initial['panDeg'] <= c['limits']['panDeg']['max'] or not c['limits']['tiltDeg']['min'] <= initial['tiltDeg'] <= c['limits']['tiltDeg']['max'] or (initial['driverFault'] or not initial['powerAvailable']) != (initial['state'] == 'Fault') or initial['powerAvailable'] and initial['voltageV'] <= 0:
        fail('IMPOSSIBLE_INITIAL')
    g = s['gate']
    if int(g['lease']['fence']) > 2**64 - 1 or g['lease']['expiresMonotonicMs'] <= start or g['lease']['holderId'] != g['actor']['id'] or not any(x['id'] == g['receiver']['deviceId'] and x['kind'] == 'module' and x['role'] == 'edge' for x in c['components']):
        fail('IDENTITY_MISMATCH')
    orders = set()
    for e in s['inputs']:
        if not on_grid(e['atMs']):
            fail('CLOCK_INVALID')
        key = (e['atMs'], e['order'])
        if key in orders:
            fail('ORDER_CONFLICT')
        orders.add(key)
        if e['kind'] == 'power' and e['available'] and e['voltageV'] <= 0:
            fail('INVALID_SCENARIO')
        if e['kind'] == 'command':
            m = e['message']
            if int(m['sequence']) > 2**64 - 1 or m['command']['lease'] and int(m['command']['lease']['fence']) > 2**64 - 1 or (m['sourceTime']['utc'] is None) != (m['sourceTime']['uncertaintyMs'] is None) or m['command']['deadline']['bootId'] != m['command']['target']['bootId'] or m['command']['deadline']['sessionId'] != m['command']['target']['sessionId']:
                fail('INVALID_COMMAND')
    if set(x['id'] for x in s['expected']['invariants']) != set(INVARIANTS) or any(not on_grid(x['atMs']) for x in s['expected']['checkpoints']) or len(set(x['atMs'] for x in s['expected']['checkpoints'])) != len(s['expected']['checkpoints']) or len(set(x['commandId'] for x in s['expected']['outcomes'])) != len(s['expected']['outcomes']):
        fail('INVALID_SCENARIO')


def admission(m, s, c, now, fault, receipts, sequences):
    g, cmd, body = s['gate'], m['command'], m['body']
    checks = [(m['realm'] == c['realm'], 'REALM_MISMATCH'), (m['executionMode'] == 'simulation', 'REALM_MISMATCH'), (m['siteId'] == c['siteId'], 'SITE_MISMATCH'), (m['source'] == g['source'], 'SOURCE_MISMATCH'), (cmd['target']['deviceId'] == g['receiver']['deviceId'], 'TARGET_MISMATCH'), (cmd['target']['bootId'] == g['receiver']['bootId'], 'TARGET_RESTARTED'), (cmd['target']['sessionId'] == g['receiver']['sessionId'], 'SESSION_MISMATCH'), (cmd['actor'] == g['actor'] and body['type'] in ['motion.move', 'control.stop', 'camera.gimbal', 'camera.capture'], 'NOT_AUTHORIZED')]
    for valid, code in checks:
        if not valid:
            return code, None
    source_key = '/'.join(m['source'][k] for k in ['deviceId', 'bootId', 'sessionId'])
    key = source_key + '/' + cmd['idempotencyKey']
    fingerprint = canonical({k: m[k] for k in ['protocol', 'realm', 'executionMode', 'siteId', 'source', 'command', 'body']})
    if key in receipts:
        return (None, 'duplicate') if receipts[key][0] == fingerprint else ('IDEMPOTENCY_CONFLICT', None)
    if any(x[1] == cmd['commandId'] for x in receipts.values()):
        return 'IDEMPOTENCY_CONFLICT', None
    sequence = int(m['sequence'])
    if source_key in sequences and sequence <= sequences[source_key]:
        return 'SEQUENCE_REPLAY', None
    deadline = cmd['deadline']['expiresMonotonicMs']
    if deadline <= now:
        return 'DEADLINE_EXPIRED', None
    if deadline - now > g['maxDeadlineAheadMs']:
        return 'DEADLINE_TOO_FAR', None
    if body.get('maxDurationMs', 0) > deadline - now:
        return 'INVALID_RANGE', None
    if body['type'] != 'control.stop':
        if cmd['configRevision'] != c['revision']:
            return 'CONFIG_MISMATCH', None
        lease = cmd['lease']
        if not lease:
            return 'LEASE_REQUIRED', None
        if lease['id'] != g['lease']['id'] or lease['holderId'] != cmd['actor']['id'] or lease['holderId'] != g['lease']['holderId'] or lease['fence'] != g['lease']['fence']:
            return 'LEASE_STALE', None
        if g['lease']['expiresMonotonicMs'] <= now or deadline > g['lease']['expiresMonotonicMs']:
            return 'LEASE_EXPIRED', None
        if fault:
            return 'FAULT_INHIBITED', None
    if len(receipts) >= 256:
        return 'RESOURCE_LIMIT', None
    if body['type'] in ['motion.move', 'camera.gimbal']:
        frame = c['geometry']['siteFrame' if body['type'] == 'motion.move' else 'gimbalFrame']
        if body['frame'] != frame:
            return 'FRAME_MISMATCH', None
        if body['type'] == 'motion.move' and (not inside(body['positionMm'], c) or body['maxSpeedMmPerS'] > c['limits']['maxSpeedMmPerS']):
            return 'OUTSIDE_LIMITS', None
        if body['type'] == 'camera.gimbal' and (not c['limits']['panDeg']['min'] <= body['panDeg'] <= c['limits']['panDeg']['max'] or not c['limits']['tiltDeg']['min'] <= body['tiltDeg'] <= c['limits']['tiltDeg']['max']):
            return 'OUTSIDE_LIMITS', None
    return None, (key, fingerprint, cmd['commandId'], source_key, sequence)


def run(s, c):
    initial, clock = s['initial'], s['clock']
    position = copy.deepcopy(initial['positionMm'])
    state, cloud, fault, power, voltage, pan, tilt = (initial[k] for k in ['state', 'cloudConnected', 'driverFault', 'powerAvailable', 'voltageV', 'panDeg', 'tiltDeg'])
    random_state, movement, active, captures = s['seed'], None, None, 0
    inputs = sorted(s['inputs'], key=lambda e: (e['atMs'], e['order']))
    receipts, sequences, history, trace = {}, {}, {}, []
    cursor, within, progress = 0, True, True
    for now in range(clock['startMs'], clock['startMs'] + clock['durationMs'] + 1, clock['stepMs']):
        outcomes, dispatches = [], []

        def outcome(command_id, next_state, error=None):
            previous = history.setdefault(command_id, [])
            current = previous[-1] if previous else None
            if not (current == next_state or current is None and next_state == 'requested' or current is not None and next_state in TRANSITIONS[current]):
                fail('INVALID_TRANSITION')
            previous.append(next_state)
            outcomes.append(dict(commandId=command_id, outcome=next_state, error=error))
        if active and now >= active['expires']:
            outcome(active['id'], 'failed', 'DEADLINE_EXPIRED')
            movement, active, state = None, None, 'Ready'
        before = copy.deepcopy(position)
        if movement:
            position = trajectory(movement['start'], movement['target'], movement['duration'], now - movement['at'])
            if now - movement['at'] >= movement['duration']:
                outcome(active['id'], 'completed')
                movement, active, state = None, None, 'Ready'
        if not cloud and state == 'Moving' and before == position and now > clock['startMs']:
            progress = False
        while cursor < len(inputs) and inputs[cursor]['atMs'] == now:
            e = inputs[cursor]
            cursor += 1
            if e['kind'] == 'cloud':
                cloud = e['connected']
                continue
            if e['kind'] == 'voltage-noise':
                random_state = (1664525 * random_state + 1013904223) % 2**32
                if power:
                    voltage = max(0, voltage + (2 * random_state / 2**32 - 1) * e['amplitudeV'])
                continue
            if e['kind'] in ['power', 'driver-fault']:
                if e['kind'] == 'power':
                    power, voltage = e['available'], e['voltageV']
                else:
                    fault = e['active']
                if not power or fault:
                    if active:
                        outcome(active['id'], 'failed', 'FAULT_INHIBITED')
                    movement, active, state = None, None, 'Fault'
                continue
            m, cmd, body = e['message'], e['message']['command'], e['message']['body']
            cid = cmd['commandId']
            error, admitted = admission(m, s, c, now, state == 'Fault', receipts, sequences)
            if admitted == 'duplicate':
                continue
            if error is None and not cloud and body['type'] != 'control.stop':
                error = 'EXECUTION_FAILED'
            if error is None and body['type'] != 'control.stop' and state not in ['Ready', 'Parked']:
                error = 'INVALID_TRANSITION'
            duration = 0
            if error is None and body['type'] == 'motion.move':
                distance = math.sqrt(sum((body['positionMm'][k] - position[k])**2 for k in 'xyz'))
                duration = max(clock['stepMs'], math.ceil(distance / body['maxSpeedMmPerS'] * 1000 / clock['stepMs']) * clock['stepMs'])
                if duration > body['maxDurationMs'] or now + duration >= cmd['deadline']['expiresMonotonicMs']:
                    error = 'OUTSIDE_LIMITS'
            if cid in history:
                outcomes.append(dict(commandId=cid, outcome='rejected', error=error or 'IDEMPOTENCY_CONFLICT'))
                continue
            outcome(cid, 'requested')
            if error:
                outcome(cid, 'rejected', error)
                continue
            key, fingerprint, command_id, source_key, sequence = admitted
            receipts[key], sequences[source_key] = (fingerprint, command_id), sequence
            outcome(cid, 'accepted')
            outcome(cid, 'running')
            dispatches.append(cid)
            if body['type'] == 'motion.move':
                movement = dict(start=copy.deepcopy(position), target=body['positionMm'], at=now, duration=duration)
                active, state = dict(id=cid, expires=cmd['deadline']['expiresMonotonicMs']), 'Moving'
            else:
                if body['type'] == 'control.stop':
                    if active:
                        outcome(active['id'], 'cancelled')
                        movement, active = None, None
                    if state != 'Fault':
                        state = 'Ready'
                elif body['type'] == 'camera.gimbal':
                    pan, tilt = body['panDeg'], body['tiltDeg']
                elif body['type'] == 'camera.capture':
                    captures += 1
                outcome(cid, 'completed')
        within = within and inside(position, c)
        lengths = {a['line']: q6(math.sqrt(sum((a['positionMm'][k] - position[k])**2 for k in 'xyz')) + c['calibration']['lineLengthOffsetsMm'][a['line']]) for a in c['geometry']['anchors']}
        trace.append(dict(atMs=now, state=state, positionQ6={k:q6(position[k]) for k in 'xyz'}, lengthQ6=lengths, cloudConnected=cloud, driverFault=fault, powerAvailable=power, voltageQ6=q6(voltage) if power else None, panQ6=q6(pan), tiltQ6=q6(tilt), captures=captures, randomState=random_state, positionQuality='estimated', lengthQuality='estimated', origin='simulated', feedback='unavailable', outcomes=outcomes, dispatches=dispatches))
    invariants = [dict(id=key, passed=value) for key, value in zip(INVARIANTS, [within, True, all(not any(o['outcome'] == 'rejected' and o['commandId'] in row['dispatches'] for o in row['outcomes']) for row in trace), progress, len(trace) <= 512])]
    identity_trace = dict(schemaVersion=s['schemaVersion'], identity=s['identity'], provenance=s['provenance'], clock=s['clock'], seed=s['seed'], trace=trace, invariants=invariants)
    return dict(schemaVersion=s['schemaVersion'], id=s['id'], identity=s['identity'], provenance=s['provenance'], trace=trace, traceDigest=digest(identity_trace), invariants=invariants, outcomes=[dict(commandId=cid, outcomes=states) for cid, states in history.items()])


def check_expected(s, report):
    for v in s['trajectories']:
        actual = trajectory(v['startMm'], v['targetMm'], v['durationMs'], v['elapsedMs'])
        for k in 'xyz':
            if abs(actual[k] - v['expectedPositionMm'][k]) > 1e-7 + 1e-12 * abs(v['expectedPositionMm'][k]):
                fail('RESULT_MISMATCH')
    for v in s['transitions']:
        current, next_state = v['current'], v['next']
        actual = next_state if current == next_state or current is None and next_state == 'requested' or current is not None and next_state in TRANSITIONS[current] else 'INVALID_TRANSITION'
        equal(actual, v['expected'])
    for key in ['traceDigest', 'invariants', 'outcomes']:
        equal(report[key], s['expected'][key])
    for checkpoint in s['expected']['checkpoints']:
        row = next(x for x in report['trace'] if x['atMs'] == checkpoint['atMs'])
        equal(checkpoint, {k: row[k] for k in ['atMs', 'state', 'positionQ6', 'lengthQ6']})


def consume(file, root, include_trace=False):
    s, c = bounded_read(file), bounded_read(root / 'fixtures/configuration.json')['valid']['configuration']
    # Exercise accepted reference cases with this runtime's independent implementation.
    spec = importlib.util.spec_from_file_location('arbi_reference', root / 'conformance/reference.py')
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    reference.check(root, root / 'fixtures/reference/1.0/vectors.json')
    reference_digest = hashlib.sha256((root / 'fixtures/reference/1.0/vectors.json').read_bytes()).hexdigest()
    validate(s, c, reference_digest, root)
    report = run(s, c)
    check_expected(s, report)
    if not include_trace:
        del report['trace']
    return report


if __name__ == '__main__':
    try:
        root = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
        file = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'fixtures/scenarios/1.0/healthy.json'
        print(json.dumps(consume(file, root, '--trace' in sys.argv), separators=(',', ':')))
    except (ValueError, KeyError, TypeError, StopIteration, OSError, RecursionError) as error:
        codes = {'UNSUPPORTED_SCHEMA', 'UNIT_MISMATCH', 'IDENTITY_MISMATCH', 'FRAME_MISMATCH', 'UNSUPPORTED_MODEL', 'CLOCK_INVALID', 'ORDER_CONFLICT', 'IMPOSSIBLE_INITIAL', 'INVALID_COMMAND', 'INVALID_SCENARIO', 'RESULT_MISMATCH', 'INPUT_LIMIT', 'SCENARIO_TOO_LARGE', 'INVALID_JSON'}
        print(str(error) if str(error) in codes else 'INVALID_SCENARIO', file=sys.stderr)
        sys.exit(2)
