"""Independent plant/1.0 host consumer. No TypeScript output, provider or device IO."""
import copy
import hashlib
import importlib.util
import json
import math
import pathlib
import sys

LINES = 'abcd'
ASSUMPTIONS = ['synthetic-unsurveyed-geometry', 'constant-single-layer-drum-radius', 'affine-synchronized-reference', 'unmeasured-delay-noise-and-settling-parameters', 'virtual-inputs-are-not-physical-confirmation', 'no-elasticity-sag-wind-mass-damping-thermal-structural-or-tension-physics', 'no-acceleration-braking-slip-pid-autofocus-image-bytes-or-update-authority']


def fail(code='INVALID_PLANT'):
    raise ValueError(code)


def shape(v, names):
    if not isinstance(v, dict) or set(v) != set(names.split()):
        fail()


def number(v, low, high, integer=False):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not low <= v <= high or integer and int(v) != v:
        fail()


def validate(p, c, reference, root, s):
    shape(p, 'schemaVersion context parameters inputs returnCommandIds expected')
    if p['schemaVersion'] != 'arbi.plant/1.0':
        fail('UNSUPPORTED_PLANT')
    ctx = p['context']
    shape(ctx, 'id executionMode identity units clock seed gate initial')
    if not isinstance(p['inputs'], list) or len(p['inputs']) > 256:
        fail()
    envelope = dict(ctx, schemaVersion='arbi.scenario/1.0', provenance=s.PROVENANCE,
                    inputs=[e for e in p['inputs'] if e.get('kind') not in ['sensor', 'driver-enabled', 'motor-stall', 'camera-fault']],
                    trajectories=[dict(id='plant-envelope', startMm=ctx['initial']['positionMm'], targetMm=ctx['initial']['positionMm'], durationMs=ctx['clock']['stepMs'], elapsedMs=0, expectedPositionMm=ctx['initial']['positionMm'])],
                    transitions=[dict(current=None, next='requested', expected='requested')],
                    expected=dict(traceDigest='0'*64, invariants=[dict(id=i, passed=True) for i in s.INVARIANTS], checkpoints=[dict(atMs=ctx['clock']['startMs'], state=ctx['initial']['state'], positionQ6=dict(x=0, y=0, z=0), lengthQ6=dict(a=0, b=0, c=0, d=0))], outcomes=[]))
    s.validate(envelope, c, reference, root)
    clock, orders = ctx['clock'], set()
    for e in p['inputs']:
        number(e['atMs'], clock['startMs'], clock['startMs'] + clock['durationMs'], True)
        number(e['order'], 0, 255, True)
        key = (e['atMs'], e['order'])
        if (e['atMs'] - clock['startMs']) % clock['stepMs'] or key in orders:
            fail('ORDER_CONFLICT')
        orders.add(key)
        if e['kind'] == 'sensor':
            shape(e, 'atMs order kind sensor value')
            if e['sensor'] not in ['home', 'limit', 'dock'] or not isinstance(e['value'], bool):
                fail()
        elif e['kind'] in ['driver-enabled', 'motor-stall', 'camera-fault']:
            shape(e, 'atMs order kind active')
            if not isinstance(e['active'], bool):
                fail()
    a = p['parameters']
    shape(a, 'drums motor sensors dock power gimbal camera noise')
    shape(a['drums'], 'a b c d')
    for d in a['drums'].values():
        shape(d, 'radiusMm stepsPerRevolution direction zeroPayoutMm minPayoutMm maxPayoutMm maxStepRatePerS')
        number(d['radiusMm'], 1, 1000)
        number(d['stepsPerRevolution'], 1, 1000000, True)
        number(d['direction'], -1, 1, True)
        if d['direction'] not in [1, -1]:
            fail()
        number(d['zeroPayoutMm'], 0, 1000000)
        number(d['minPayoutMm'], 0, 1000000)
        number(d['maxPayoutMm'], d['minPayoutMm'] + 1, 1000000)
        number(d['maxStepRatePerS'], 1, 1000000)
    shape(a['motor'], 'enabled delayMs jitterMs')
    if not isinstance(a['motor']['enabled'], bool):
        fail()
    shape(a['gimbal'], 'rateDegPerS delayMs jitterMs settleMs')
    number(a['gimbal']['rateDegPerS'], 0.1, 10000)
    shape(a['camera'], 'delayMs jitterMs')
    shape(a['power'], 'minVoltageV maxVoltageV bootMs')
    number(a['power']['minVoltageV'], 1, 60)
    number(a['power']['maxVoltageV'], a['power']['minVoltageV'] + 0.01, 60)
    shape(a['dock'], 'positionMm toleranceMm debounceMs timeoutMs')
    shape(a['dock']['positionMm'], 'x y z')
    for v in a['dock']['positionMm'].values():
        number(v, -1000000, 1000000)
    number(a['dock']['toleranceMm'], 0, 100)
    if not s.inside(a['dock']['positionMm'], c):
        fail()
    for owner, names in [('motor', ['delayMs', 'jitterMs']), ('gimbal', ['delayMs', 'jitterMs', 'settleMs']), ('camera', ['delayMs', 'jitterMs']), ('power', ['bootMs']), ('dock', ['debounceMs', 'timeoutMs'])]:
        for name in names:
            number(a[owner][name], 0, 30000, True)
    if a['dock']['timeoutMs'] < clock['stepMs']:
        fail()
    shape(a['noise'], 'positionAmplitudeMm')
    number(a['noise']['positionAmplitudeMm'], 0, 100)
    shape(a['sensors'], 'home limit dock')
    if any(x not in ['unavailable', 'virtual-input'] for x in a['sensors'].values()):
        fail()
    ids = p['returnCommandIds']
    if not isinstance(ids, list) or len(ids) > 256 or len(set(ids)) != len(ids) or any(not isinstance(i, str) or not any(e['kind'] == 'command' and e['message']['command']['commandId'] == i and e['message']['body']['type'] == 'motion.move' for e in p['inputs']) for i in ids):
        fail()
    shape(p['expected'], 'states traceDigest')
    if not isinstance(p['expected']['traceDigest'], str) or len(p['expected']['traceDigest']) != 64 or any(x not in '0123456789abcdef' for x in p['expected']['traceDigest']) or not isinstance(p['expected']['states'], list) or len(p['expected']['states']) > 512:
        fail()
    for row in p['expected']['states']:
        shape(row, 'atMs state captures')
        number(row['atMs'], clock['startMs'], clock['startMs'] + clock['durationMs'], True)
        number(row['captures'], 0, 256, True)
        if (row['atMs'] - clock['startMs']) % clock['stepMs'] or row['state'] not in ['Ready', 'Moving', 'Settling', 'Capturing', 'Returning', 'Docking', 'Parked', 'Fault']:
            fail()


def lengths(pos, c):
    return {a['line']: math.sqrt((a['positionMm']['x']-pos['x'])**2 + (a['positionMm']['y']-pos['y'])**2 + (a['positionMm']['z']-pos['z'])**2) + c['calibration']['lineLengthOffsetsMm'][a['line']] for a in c['geometry']['anchors']}


def drum(value, d):
    if not d['minPayoutMm'] <= value <= d['maxPayoutMm']:
        fail('OUTSIDE_LIMITS')
    unit = 2 * math.pi * d['radiusMm'] / d['stepsPerRevolution']
    n = math.floor((value-d['zeroPayoutMm']) / unit * d['direction'] + 0.5)
    return n, d['zeroPayoutMm'] + n * d['direction'] * unit


def check_move(start, target, speed, p, c, s):
    if not s.inside(start, c) or not s.inside(target, c) or not 0 < speed <= c['limits']['maxSpeedMmPerS']:
        fail('OUTSIDE_LIMITS')
    delta = {k: target[k]-start[k] for k in 'xyz'}
    squared = sum(delta[k]**2 for k in 'xyz')
    for a in c['geometry']['anchors']:
        d = p['parameters']['drums'][a['line']]
        f = 0 if squared == 0 else max(0, min(1, sum((a['positionMm'][k]-start[k])*delta[k] for k in 'xyz')/squared))
        closest = {k: start[k]+delta[k]*f for k in 'xyz'}
        for v in [start, target, closest]:
            drum(lengths(v, c)[a['line']], d)
        if speed * d['stepsPerRevolution'] / (2*math.pi*d['radiusMm']) > d['maxStepRatePerS']:
            fail('OUTSIDE_LIMITS')


def run(p, c, s):
    ctx, a = p['context'], p['parameters']
    clock, init = ctx['clock'], ctx['initial']
    step = clock['stepMs']
    grid = lambda ms, minimum=False: max(step if minimum else 0, math.ceil(ms/step)*step)
    pos, pan, tilt = copy.deepcopy(init['positionMm']), init['panDeg'], init['tiltDeg']
    state = 'Ready' if init['state'] == 'Parked' else init['state']
    cloud, enabled, fault, stall, camera_fault = init['cloudConnected'], a['motor']['enabled'], init['driverFault'], False, False
    available, voltage, boot_at = init['powerAvailable'], init['voltageV'], clock['startMs'] + grid(a['power']['bootMs'])
    random_state = ctx['seed']
    def draw():
        nonlocal random_state
        random_state = (1664525*random_state + 1013904223) % 4294967296
        return random_state/4294967296
    delay = lambda base, jitter: grid(base + math.floor(draw()*(jitter+1)))
    healthy = lambda: available and a['power']['minVoltageV'] <= voltage <= a['power']['maxVoltageV']
    ready = lambda at: healthy() and at >= boot_at
    near = lambda v: math.sqrt(sum((v[k]-a['dock']['positionMm'][k])**2 for k in 'xyz')) <= a['dock']['toleranceMm']
    inputs = {k: dict(value=None, at=None) for k in ['home', 'limit', 'dock']}
    def sensors():
        return {k: dict(quality='estimated', origin='virtual-input', value=v['value'], sampleMonotonicMs=v['at']) if a['sensors'][k] == 'virtual-input' and v['value'] is not None else dict(quality='unavailable', origin='unavailable', value=None, sampleMonotonicMs=None) for k, v in inputs.items()}
    for line in LINES:
        drum(lengths(pos, c)[line], a['drums'][line])
    captures, active, movement, operation = 0, None, None, None
    settle_until = clock['startMs']
    history, receipts, sequences = {}, {}, {}
    events, cursor, trace = sorted(p['inputs'], key=lambda e: (e['atMs'], e['order'])), 0, []
    invariants = dict(withinWorkspace=True, truthfulFeedback=True, independentDock=True, captureStationary=True, boundedTrace=True)
    for now in range(clock['startMs'], clock['startMs']+clock['durationMs']+1, step):
        outcomes, dispatches = [], []
        def outcome(i, nxt, error=None):
            h = history.setdefault(i, [])
            if not ((not h and nxt == 'requested') or (h and nxt in s.TRANSITIONS[h[-1]])):
                fail('INVALID_TRANSITION')
            h.append(nxt)
            outcomes.append(dict(commandId=i, outcome=nxt, error=error))
        def stop(error, latched):
            nonlocal active, movement, operation, state
            movement = operation = None
            if active:
                outcome(active['id'], 'failed', error)
            active = None
            state = 'Fault' if latched else 'Ready'
        if active and (now >= active['deadline'] or now > active['maxUntil']):
            stop('DEADLINE_EXPIRED', True)
        while cursor < len(events) and events[cursor]['atMs'] == now:
            e = events[cursor]
            cursor += 1
            kind = e['kind']
            if kind == 'cloud':
                cloud = e['connected']
                continue
            if kind != 'command':
                if kind == 'sensor':
                    inputs[e['sensor']] = dict(value=e['value'], at=e['atMs'])
                elif kind == 'driver-fault':
                    fault = e['active']
                elif kind == 'driver-enabled':
                    enabled = e['active']
                elif kind == 'motor-stall':
                    stall = e['active']
                elif kind == 'camera-fault':
                    camera_fault = e['active']
                elif kind == 'power':
                    was = healthy()
                    available, voltage = e['available'], e['voltageV']
                    if not was and healthy():
                        boot_at = now + grid(a['power']['bootMs'])
                elif kind == 'voltage-noise':
                    was = healthy()
                    noise = (2*draw()-1)*e['amplitudeV']
                    if available:
                        voltage = max(0, voltage+noise)
                    if not was and healthy():
                        boot_at = now + grid(a['power']['bootMs'])
                if fault or not enabled or not healthy() or sensors()['limit']['value'] is True:
                    stop('FAULT_INHIBITED', True)
                continue
            m, cmd, body = e['message'], e['message']['command'], e['message']['body']
            ident, typ = cmd['commandId'], body['type']
            error, admitted = s.admission(m, ctx, c, now, state == 'Fault', receipts, sequences)
            if admitted == 'duplicate':
                continue
            if error is None and typ != 'control.stop':
                error = 'EXECUTION_FAILED' if not cloud else 'INVALID_TRANSITION' if active or state != 'Ready' else 'FAULT_INHIBITED' if not ready(now) or fault or not enabled or typ in ['camera.gimbal', 'camera.capture'] and camera_fault else 'INVALID_TRANSITION' if typ == 'camera.capture' and now < settle_until else None
            if error is None and typ == 'motion.move':
                try:
                    check_move(pos, body['positionMm'], body['maxSpeedMmPerS'], p, c, s)
                    if ident in p['returnCommandIds'] and not near(body['positionMm']):
                        error = 'OUTSIDE_LIMITS'
                except ValueError:
                    error = 'OUTSIDE_LIMITS'
            if ident in history:
                outcomes.append(dict(commandId=ident, outcome='rejected', error=error or 'IDEMPOTENCY_CONFLICT'))
                continue
            outcome(ident, 'requested')
            if error:
                outcome(ident, 'rejected', error)
                continue
            worst = 0
            if typ == 'motion.move':
                dist = math.sqrt(sum((body['positionMm'][k]-pos[k])**2 for k in 'xyz'))
                worst = grid(dist/body['maxSpeedMmPerS']*1000, True) + grid(a['motor']['delayMs']+a['motor']['jitterMs'])
                if ident in p['returnCommandIds']:
                    worst += a['dock']['timeoutMs']
            elif typ == 'camera.gimbal':
                worst = grid(max(abs(body['panDeg']-pan), abs(body['tiltDeg']-tilt))/a['gimbal']['rateDegPerS']*1000) + grid(a['gimbal']['delayMs']+a['gimbal']['jitterMs']) + grid(a['gimbal']['settleMs'])
            elif typ == 'camera.capture':
                worst = grid(a['camera']['delayMs']+a['camera']['jitterMs'], True)
            if typ != 'control.stop' and (worst > body['maxDurationMs'] or now+worst >= cmd['deadline']['expiresMonotonicMs']):
                outcome(ident, 'rejected', 'OUTSIDE_LIMITS')
                continue
            key, fp, command_id, source_key, sequence = admitted
            receipts[key] = (fp, command_id)
            sequences[source_key] = sequence
            outcome(ident, 'accepted')
            outcome(ident, 'running')
            dispatches.append(ident)
            if typ == 'control.stop':
                movement = operation = None
                if active:
                    outcome(active['id'], 'cancelled')
                active = None
                if state != 'Fault':
                    state = 'Ready'
                outcome(ident, 'completed')
            else:
                returning = ident in p['returnCommandIds']
                if typ == 'motion.move':
                    latency = delay(a['motor']['delayMs'], a['motor']['jitterMs'])
                    duration = grid(dist/body['maxSpeedMmPerS']*1000, True)
                    movement = dict(start=copy.deepcopy(pos), target=body['positionMm'], at=now+latency, duration=duration)
                    duration += latency
                else:
                    if camera_fault:
                        fail('FAULT_INHIBITED')
                    if typ == 'camera.gimbal':
                        duration = delay(a['gimbal']['delayMs'], a['gimbal']['jitterMs']) + grid(max(abs(body['panDeg']-pan), abs(body['tiltDeg']-tilt))/a['gimbal']['rateDegPerS']*1000) + grid(a['gimbal']['settleMs'])
                        pan, tilt = body['panDeg'], body['tiltDeg']
                        settle_until = now + duration
                    else:
                        duration = max(step, delay(a['camera']['delayMs'], a['camera']['jitterMs']))
                    operation = dict(kind=typ, end=now+duration)
                active = dict(id=ident, kind=typ, deadline=cmd['deadline']['expiresMonotonicMs'], maxUntil=now+body['maxDurationMs'], capturePose=copy.deepcopy(pos) if typ == 'camera.capture' else None, returning=returning, dockUntil=now+duration+a['dock']['timeoutMs'] if returning else None, sawDockFalse=False, dockTrueAt=None)
                state = ('Returning' if returning else 'Moving') if typ == 'motion.move' else 'Settling' if typ == 'camera.gimbal' else 'Capturing'
        local = sensors()
        if fault or not enabled or not healthy() or local['limit']['value'] is True:
            stop('FAULT_INHIBITED', True)
        if active:
            if active['returning']:
                if local['dock']['value'] is False:
                    active['sawDockFalse'], active['dockTrueAt'] = True, None
                if state == 'Docking' and local['dock']['value'] is True and active['sawDockFalse'] and active['dockTrueAt'] is None and local['dock']['sampleMonotonicMs'] >= now:
                    active['dockTrueAt'] = now
            complete, error = False, None
            if active['kind'] == 'motion.move' and movement:
                if fault or not enabled or not ready(now):
                    movement, error = None, 'FAULT_INHIBITED'
                elif not stall and now >= movement['at']:
                    pos = s.trajectory(movement['start'], movement['target'], movement['duration'], now-movement['at'])
                    if now-movement['at'] >= movement['duration']:
                        movement, complete = None, True
            elif operation:
                if not ready(now) or camera_fault:
                    operation, error = None, 'EXECUTION_FAILED'
                elif now >= operation['end']:
                    if operation['kind'] == 'camera.capture':
                        captures += 1
                    operation, complete = None, True
            if error:
                stop(error, True)
            elif complete:
                if active['returning']:
                    state = 'Docking'
                else:
                    if active['kind'] == 'camera.capture':
                        invariants['captureStationary'] &= active['capturePose'] == pos and state == 'Capturing'
                    outcome(active['id'], 'completed')
                    active, state = None, 'Ready'
            if active and active['returning'] and state == 'Docking':
                if local['dock']['value'] is True and active['dockTrueAt'] is not None and now-active['dockTrueAt'] >= a['dock']['debounceMs'] and near(pos):
                    outcome(active['id'], 'completed')
                    active, state = None, 'Parked'
                elif now >= active['dockUntil']:
                    stop('DOCK_TIMEOUT', True)
        if state == 'Parked' and local['dock']['value'] is not True:
            stop('DOCK_CONFIRMATION_LOST', True)
        virtual = {k: pos[k]+(2*draw()-1)*a['noise']['positionAmplitudeMm'] for k in 'xyz'}
        cable = lengths(pos, c)
        feedback = []
        for signal in c['signals']:
            metric = signal['metric']
            if not metric:
                continue
            unit = 'mm' if metric.startswith('position.') or metric.startswith('line.length.') else 'N' if metric.startswith('line.tension.') else 'V' if metric == 'power.voltage' else 'deg'
            reading, quality, value = signal['reading'], 'commanded' if metric.startswith('gimbal.') else 'estimated', None
            unavailable = reading['kind'] == 'unavailable' or metric.startswith('line.tension.') or quality not in reading.get('qualities', [])
            if not unavailable:
                value = pos[metric[-1]] if metric.startswith('position.') else cable[metric[-1]] if metric.startswith('line.length.') else voltage if metric == 'power.voltage' and available else pan if metric == 'gimbal.pan' else tilt if metric == 'gimbal.tilt' else None
            feedback.append(dict(metric=metric, quality=quality if value is not None else 'unavailable', valueQ6=s.q6(value) if value is not None else None, unit=unit, frame=signal['frame'], sampleMonotonicMs=now if value is not None else None, ageMs=0 if value is not None else None, uncertainty=None, reason=None if value is not None else reading.get('reason', 'not-reported'), originQuality=None))
        invariants['withinWorkspace'] &= s.inside(pos, c)
        invariants['truthfulFeedback'] &= all(x['quality'] != 'measured' and (x['quality'] != 'unavailable' or x['valueQ6'] is None) for x in feedback) and all(x['quality'] != 'measured' for x in local.values())
        invariants['independentDock'] &= state != 'Parked' or local['dock']['origin'] == 'virtual-input' and local['dock']['value'] is True
        invariants['captureStationary'] &= state != 'Capturing' or active and active['kind'] == 'camera.capture'
        maps = {line: drum(cable[line], a['drums'][line]) for line in LINES}
        trace.append(dict(atMs=now, state=state, positionQ6={k:s.q6(pos[k]) for k in 'xyz'}, virtualPositionQ6={k:s.q6(virtual[k]) for k in 'xyz'}, lines={line:dict(lengthQ6=s.q6(cable[line]), steps=maps[line][0], reconstructedPayoutQ6=s.q6(maps[line][1])) for line in LINES}, positionQuality='estimated', lengthQuality='estimated', drumQuality='estimated', gimbalQuality='commanded', voltageQuality='estimated' if available else 'unavailable', virtualPositionOrigin='simulated', origin='simulated', encoderFeedback='unavailable', feedback=feedback, localInputs=local, powerReady=ready(now), voltageQ6=s.q6(voltage) if available else None, gimbalCommandQ6=dict(pan=s.q6(pan), tilt=s.q6(tilt)), captures=captures, randomState=random_state, outcomes=outcomes, dispatches=dispatches))
    invariants['boundedTrace'] = len(trace) <= 512
    report = dict(schemaVersion='arbi.plant/1.0', fidelity='bounded-affine-modules-no-dynamics', evidence='synthetic-host-reference', identity=ctx['identity'], parameters=a, assumptions=ASSUMPTIONS, trace=trace, invariants=invariants)
    def numeric_tree(v):
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return s.q6(v)
        if isinstance(v, dict):
            return {k:numeric_tree(child) for k, child in v.items()}
        if isinstance(v, list):
            return [numeric_tree(child) for child in v]
        return v
    report['traceDigest'] = s.digest(dict(report, parameters=numeric_tree(a), seed=ctx['seed'], clock=clock, returnCommandIds=p['returnCommandIds']))
    return report


def consume(file, root, check=True):
    spec = importlib.util.spec_from_file_location('scenario_reference', root / 'conformance/scenario.py')
    s = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(s)
    p = s.bounded_read(file)
    c = json.loads((root / 'fixtures/configuration.json').read_text())['valid']['configuration']
    reference = hashlib.sha256((root / 'fixtures/reference/1.0/vectors.json').read_bytes()).hexdigest()
    validate(p, c, reference, root, s)
    report = run(p, c, s)
    if check:
        if report['traceDigest'] != p['expected']['traceDigest'] or not all(report['invariants'].values()):
            fail('RESULT_MISMATCH')
        for e in p['expected']['states']:
            row = next((r for r in report['trace'] if r['atMs'] == e['atMs']), None)
            if not row or row['state'] != e['state'] or row['captures'] != e['captures']:
                fail('RESULT_MISMATCH')
    return report


if __name__ == '__main__':
    try:
        report = consume(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
        if '--trace' not in sys.argv:
            del report['trace']
        print(json.dumps(report, separators=(',', ':'), allow_nan=False))
    except (ValueError, KeyError, TypeError, OSError, OverflowError) as e:
        code = str(e)
        allowed = {'INVALID_PLANT', 'UNSUPPORTED_PLANT', 'RESULT_MISMATCH', 'OUTSIDE_LIMITS', 'NUMERIC_LIMIT', 'INVALID_GEOMETRY', 'INVALID_SCENARIO', 'UNSUPPORTED_SCHEMA', 'UNKNOWN_FIELD', 'UNIT_MISMATCH', 'FRAME_MISMATCH', 'IDENTITY_MISMATCH', 'INVALID_CONFIGURATION', 'IMPOSSIBLE_INITIAL', 'CLOCK_INVALID', 'ORDER_CONFLICT', 'INVALID_COMMAND', 'UNSUPPORTED_MODEL'}
        print(code if code in allowed else 'INVALID_PLANT', file=sys.stderr)
        sys.exit(2)
