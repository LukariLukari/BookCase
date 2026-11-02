import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/soundEffects.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function buffer(length = 1000, rate = 48000, count = 1) {
  const data = Array.from({ length: count }, () => new Float32Array(length));
  return { length, sampleRate: rate, numberOfChannels: count, getChannelData: index => data[index] };
}

function harness({ suspended = false, rejectResume = false, prefixed = false, failFetch = false } = {}) {
  let now = 0;
  const contexts = [], played = [], fetches = [], resumes = [];
  const events = () => {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, fn) { const list = listeners.get(type) || new Set(); list.add(fn); listeners.set(type, list); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      fire(type, values = {}) { for (const fn of listeners.get(type) || []) fn({ type, isTrusted: true, ...values }); },
    };
  };
  class Element {
    constructor({ sound, disabled = false, parent = null } = {}) { this.dataset = { sound }; this.disabled = disabled; this.parent = parent; }
    closest(selector) {
      if (selector.includes(':disabled') && this.disabled) return this;
      if (selector.includes('[data-sound="none"]') && this.dataset.sound === 'none') return this;
      if (selector === '[data-sound]' && this.dataset.sound) return this;
      if (selector === 'label' && this instanceof Label) return this;
      if (selector.startsWith('button,') && (this instanceof Label || this instanceof Input || this.controlType === 'button' || this.dataset.sound)) return this;
      return this.parent?.closest(selector) || null;
    }
    contains(target) { return target === this || (target?.parent ? this.contains(target.parent) : false); }
  }
  class Input extends Element { constructor(type = 'text', options = {}) { super(options); this.type = type; this.readOnly = false; } }
  class Textarea extends Element { readOnly = false; }
  class Label extends Element { constructor(control) { super(); this.control = control; } }
  class Context {
    constructor(options) { this.options = options; this.state = suspended ? 'suspended' : 'running'; this.sampleRate = 48000; this.destination = {}; contexts.push(this); }
    createBuffer = (count, length, rate) => buffer(length, rate, count);
    decodeAudioData() { const decoded = buffer(); decoded.getChannelData(0).fill(.25); return Promise.resolve(decoded); }
    createBufferSource() {
      return { connect() {}, disconnect() { this.disconnected = true; }, stop() { this.stopped = true; },
        start() { if (this.buffer.length > 1) played.push(this); }, buffer: null };
    }
    resume() { resumes.push(this); if (rejectResume) return Promise.reject(new Error('blocked')); this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const document = { ...events(), visibilityState: 'visible' };
  const window = { ...events(), [prefixed ? 'webkitAudioContext' : 'AudioContext']: Context };
  const navigator = { audioSession: { type: 'auto' } };
  const exports = {};
  vm.runInNewContext(code, {
    exports, document, window, navigator, performance: { now: () => now }, AbortController,
    Element, HTMLElement: Element, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, HTMLLabelElement: Label,
    fetch: async (url, options) => { fetches.push({ url, options }); return { ok: !failFetch, arrayBuffer: async () => new ArrayBuffer(4) }; },
  });
  return { ...exports, document, window, navigator, contexts, played, fetches, resumes, Element, Input, Textarea, Label, advance: ms => { now += ms; } };
}

test('decoded sounds preload once; rapid taps share context and buffers', async () => {
  const h = harness(); const player = h.createSoundPlayer();
  player.preload(); await settle();
  for (let i = 0; i < 12; i++) player.play('click');
  assert.equal(h.fetches.length, 3);
  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].options.latencyHint, 'interactive');
  assert.equal(h.played.length, 12);
  assert.equal(h.played[0].buffer, h.played[11].buffer);
  assert.equal(h.navigator.audioSession.type, 'playback');
  player.dispose();
});

test('suspended/prefixed Safari context resumes synchronously within gesture', async () => {
  const h = harness({ suspended: true, prefixed: true }); const player = h.createSoundPlayer();
  player.preload(); await settle(); player.play('complete');
  assert.equal(h.resumes.length, 1); // No await/timeout before resume.
  assert.equal(h.played.length, 1);
  player.dispose();
});

test('background interruption recreates context and reuses decoded audio on return', async () => {
  const h = harness(); const player = h.createSoundPlayer();
  player.preload(); await settle(); player.play('input');
  h.contexts[0].state = 'interrupted'; player.restore(); player.play('input');
  assert.equal(h.contexts.length, 2);
  assert.equal(h.contexts[0].state, 'closed');
  assert.equal(h.played.length, 2);
  assert.equal(h.fetches.length, 3);
  player.dispose();
});

test('cold loads discard stale taps instead of playing a delayed burst', async () => {
  const h = harness(); const player = h.createSoundPlayer();
  player.play('click'); h.advance(300); await settle();
  assert.equal(h.played.length, 0);
  player.play('input'); assert.equal(h.played.length, 1);
  player.dispose();
});

test('blocked audio/load errors never throw; cleanup aborts requests and closes context', async () => {
  const h = harness({ suspended: true, rejectResume: true, failFetch: true }); const player = h.createSoundPlayer();
  player.play('click'); await settle();
  assert.equal(h.played.length, 0);
  player.dispose(); player.play('click');
  assert.equal(h.contexts[0].state, 'closed');
  assert.equal(h.fetches[0].options.signal.aborted, true);
});

test('leading silence is trimmed across channels, preserving onset and all-silent clips', () => {
  const h = harness(); const player = h.createSoundPlayer(); player.preload();
  const original = buffer(1000, 1000, 2); original.getChannelData(1)[400] = .4;
  const trimmed = h.trimLeadingSilence(h.contexts[0], original);
  assert.equal(trimmed.length, 602); // 2ms before first audible sample.
  assert.ok(trimmed.getChannelData(1)[2] > .39);
  const silent = buffer(); assert.equal(h.trimLeadingSilence(h.contexts[0], silent), silent);
  player.dispose();
});

function eventsHarness() {
  const h = harness(); const calls = [];
  const player = { preload() {}, unlock() {}, play: kind => calls.push(kind), restore: () => calls.push('restore'), dispose: () => calls.push('dispose') };
  const cleanup = h.attachSoundEffects(player);
  const target = new h.Element({ sound: 'complete' });
  const point = { identifier: 1, clientX: 10, clientY: 10 };
  const start = (element = target) => h.document.fire('touchstart', { target: element, changedTouches: [point], touches: [point] });
  const end = (element = target) => h.document.fire('touchend', { target: element, changedTouches: [point], touches: [] });
  return { ...h, calls, cleanup, target, point, start, end };
}

test('touch release plays before compatibility click, exactly once; keyboard still plays', () => {
  const h = eventsHarness(); h.start(); h.end();
  assert.deepEqual(h.calls, ['complete']);
  h.document.fire('click', { target: h.target, detail: 1 });
  h.document.fire('click', { target: h.target, detail: 0 });
  assert.deepEqual(h.calls, ['complete']);
  h.document.fire('keydown', { target: h.target });
  h.document.fire('click', { target: h.target, detail: 0 });
  assert.deepEqual(h.calls, ['complete', 'complete']);
  h.cleanup();
});

test('scrolling, cancelled touches, disabled controls and muted regions make no sound', () => {
  const h = eventsHarness(); h.start();
  h.document.fire('touchmove', { changedTouches: [{ ...h.point, clientY: 60 }] }); h.end();
  h.start(); h.document.fire('touchcancel'); h.end();
  const disabled = new h.Element({ disabled: true }); h.start(disabled); h.end(disabled);
  const muted = new h.Element({ sound: 'none' }); h.start(muted); h.end(muted);
  h.document.fire('click', { target: h.target, isTrusted: false });
  assert.deepEqual(h.calls, []); h.cleanup();
});

test('nested icons and forwarded label clicks do not duplicate touch sounds', () => {
  const h = eventsHarness(); const icon = new h.Element({ parent: h.target });
  h.start(icon); h.end(icon); h.document.fire('click', { target: icon, detail: 1 });
  assert.deepEqual(h.calls, ['complete']);
  const input = new h.Input(); const label = new h.Label(input);
  h.start(label); h.end(label);
  h.document.fire('click', { target: label, detail: 1 });
  h.document.fire('click', { target: input, detail: 0 });
  assert.deepEqual(h.calls, ['complete', 'click']); h.cleanup();
});

test('typing, numeric keypad, desktop clicks and page restore retain their sounds', () => {
  const h = eventsHarness(); const input = new h.Input('number');
  h.document.fire('input', { target: input });
  h.document.fire('click', { target: new h.Element({ sound: 'input' }), detail: 1 });
  h.document.fire('input', { target: new h.Input('checkbox') });
  h.document.fire('click', { target: h.target, detail: 1 });
  h.document.fire('visibilitychange'); h.window.fire('pageshow');
  assert.deepEqual(h.calls, ['input', 'input', 'complete', 'restore', 'restore']);
  h.cleanup();
  assert.equal([...h.document.listeners.values()].every(list => list.size === 0), true);
  assert.equal([...h.window.listeners.values()].every(list => list.size === 0), true);
});
