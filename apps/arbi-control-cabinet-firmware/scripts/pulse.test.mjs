import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { app } from './toolchain.mjs';

const binary = process.env.ARBI_PULSE_HOST_BIN ?? join(app, 'dist/host/pulse');
function run(counts, rate = 1000, acceleration = 100000, previous = 0) {
  const result = spawnSync(binary, [...counts.map(String), String(rate), String(acceleration), String(previous)], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const value = JSON.parse(result.stdout); assert.equal(value.physicalAcceptance, false);
  return value;
}
// Independent equation for which axes step at each common slot: the change of
// floor(slot * axisCount / largestCount), rather than the C accumulator loop.
function golden(counts, rate, acceleration, previous) {
  const maximum = Math.max(...counts.map(Math.abs));
  let directions = previous;
  counts.forEach((n, i) => { if (n) directions = n < 0 ? directions | (1 << (2*i+1)) : directions & ~(1 << (2*i+1)); });
  const record = (high, interval) => (((interval - 9) * 65536) + directions * 256 + high) >>> 0;
  const words = [record(directions, 10)];
  for (let slot = 1; slot <= maximum; slot++) {
    let high = directions;
    counts.forEach((n, axis) => { if (Math.floor(slot * Math.abs(n) / maximum) !== Math.floor((slot - 1) * Math.abs(n) / maximum)) high |= 1 << (2*axis); });
    const frequency = Math.min(rate, Math.sqrt(2 * acceleration * slot), Math.sqrt(2 * acceleration * (maximum - slot + 1)));
    words.push(record(high, Math.ceil(1000000 / frequency)));
  }
  words.push(record(directions, 10)); return { words, directions };
}
test('four-axis golden schedules have exact steps, common final step and guarded reversals', () => {
  for (const counts of [[0, 0, 0, 0], [5, 3, 1, 2], [-5, 3, -1, 2], [0, 512, 0, -255], [512, 512, 512, 512], [1, 0, -1, 0]]) {
    const rate = 20000, acceleration = 100000;
    const value = run(counts, rate, acceleration, 0xaa);
    assert.equal(value.result, 0); assert.equal(value.valid, true);
    assert.deepEqual(value.counts, counts.map(Math.abs));
    const expected = golden(counts, rate, acceleration, 0xaa);
    assert.deepEqual(value.words, expected.words); assert.equal(value.directions, expected.directions);
    assert.equal(value.durationTicks, value.words.reduce((sum, word) => sum + (word >>> 16) + 9, 0));
    const maximum = Math.max(...counts.map(Math.abs));
    if (maximum) counts.forEach((n, axis) => { if (n) assert.ok(value.words.at(-2) & (1 << (2*axis))); });
    assert.equal(value.words[0] & 0x55, 0); assert.equal(value.words.at(-1) & 0x55, 0);
  }
  const forward = run([10, 0, -5, 0]);
  const reverse = run([-10, 0, 5, 0], 1000, 100000, forward.directions);
  assert.equal(reverse.result, 0); assert.equal(reverse.words[0] & 255, reverse.directions);
});
test('numeric, duration, rate, acceleration and finite-buffer violations have no partial plan', () => {
  for (const [counts, rate, acceleration, previous] of [
    [[513, 0, 0, 0], 1000, 100000, 0], [[-2147483648, 0, 0, 0], 1000, 100000, 0],
    [[512, 0, 0, 0], 1000, 100000, 0], [[1, 0, 0, 0], 0, 100000, 0],
    [[1, 0, 0, 0], 20001, 100000, 0], [[1, 0, 0, 0], NaN, 100000, 0],
    [[1, 0, 0, 0], Infinity, 100000, 0], [[1, 0, 0, 0], 1000, NaN, 0],
    [[1, 0, 0, 0], 1000, 2000001, 0], [[1, 0, 0, 0], 1000, 1, 0],
    [[1, 0, 0, 0], 1000, 100000, 1], [[1, 0, 0, 0], 1, 100000, 0],
  ]) {
    const value = run(counts, rate, acceleration, previous);
    assert.notEqual(value.result, 0); assert.deepEqual(value.words, []); assert.equal(value.valid, false);
  }
});
test('maximum supported synthetic rate and randomized golden vectors preserve counts and bounds', () => {
  const max = run([512, 256, 128, 64], 20000, 2000000);
  assert.equal(max.result, 0); assert.ok(max.words.some(w => (w >>> 16) + 9 === 50));
  let seed = 41;
  for (let i = 0; i < 100; i++) {
    const counts = Array.from({ length: 4 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed % 257) - 128; });
    const value = run(counts, 5000, 100000);
    assert.equal(value.result, 0); assert.deepEqual(value.words, golden(counts, 5000, 100000, 0).words);
    assert.deepEqual(value.counts, counts.map(Math.abs)); assert.ok(value.durationTicks <= 250000);
  }
});
test('finite queue starvation, overflow, pause, rollover and concurrent ownership', () => {
  const result = spawnSync(binary, ['queue'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { queue: 'passed', concurrentTransfers: 10000, physicalAcceptance: false });
});
test('actual assembled PIO instructions lower STEP before FIFO starvation', () => {
  const header = readFileSync(join(app, 'dist/pico/pulse.pio.h'), 'utf8');
  const body = header.match(/arbi_pulse_program_instructions\[\] = \{([\s\S]*?)\};/u)?.[1];
  assert.ok(body, 'SDK pioasm must have assembled the target program');
  const instructions = [...body.matchAll(/0x([a-f0-9]{4})/gu)].map(m => Number.parseInt(m[1], 16));
  assert.equal(instructions.length, 6);
  // Decode the generated words. This emulator covers exactly the emitted PIO
  // instruction subset; timings here are source-derived cycles, not scope data.
  const value = run([7, -3, 2, 0], 1000, 100000);
  const records = [], pending = [...value.words];
  let osr = 0, x = 0, pc = 0, tick = 0, pins = 0, previousHigh = null;
  for (let operations = 0; operations < 2000000; operations++) {
    const instruction = instructions[pc], major = instruction >>> 13, delay = (instruction >>> 8) & 31;
    let next = (pc + 1) % 6;
    if (major === 4) { // pull block: an empty FIFO stalls before any more output.
      if (!pending.length) { assert.equal(pins & 0x55, 0); break; }
      osr = pending.shift();
    } else if (major === 3) {
      const destination = (instruction >>> 5) & 7, bits = (instruction & 31) || 32;
      const part = osr & ((2 ** bits) - 1); osr >>>= bits;
      if (destination === 0) {
        pins = part;
        if (pc === 1) { records.push({ tick, pins }); previousHigh = tick; }
        else { assert.equal(pc, 3); assert.equal(pins & 0x55, 0); assert.equal(tick - previousHigh, 5); }
      } else { assert.equal(destination, 1); x = part; }
    } else if (major === 0) {
      assert.equal((instruction >>> 5) & 7, 2, 'jmp x--');
      if (x !== 0) next = instruction & 31;
      x = (x - 1) >>> 0;
    } else { assert.equal(major, 5); assert.equal(pc, 2); } // nop is mov y,y
    tick += 1 + delay; pc = next;
  }
  assert.equal(pending.length, 0); assert.equal(records.length, value.words.length);
  for (let i = 1; i < records.length; i++) assert.equal(records[i].tick - records[i - 1].tick, (value.words[i - 1] >>> 16) + 9);
  for (let axis = 0; axis < 4; axis++) assert.equal(records.filter(record => record.pins & (1 << (2*axis))).length, value.counts[axis]);
});
