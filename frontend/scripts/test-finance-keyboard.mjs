import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

const code = ts.transpileModule(fs.readFileSync(new URL('../src/app/business/expenses/TransactionEntry.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function fixture(saving = false, options = {}) {
  const effects = [], keys = [], sounds = [], saves = [], listeners = new Map();
  const changes = [], types = [], scrolls = [];
  const dialog = {};
  class Element {
    constructor({ owner = dialog, editable = false, input = false } = {}) {
      this.owner = owner;
      this.isContentEditable = editable;
      this.input = input;
    }
    closest(selector) { return selector === 'dialog' ? this.owner : this.input && selector.includes('input') ? this : null; }
  }
  const form = new Element();
  const scroller = { clientLeft: 2, clientWidth: 300, getBoundingClientRect: () => ({ left: 100 }), scrollBy: value => scrolls.push(value.left) };
  form.querySelectorAll = () => Array.from({ length: 5 }, () => ({ closest: () => scroller, getBoundingClientRect: () => options.bounds || { left: 120, right: 200 } }));
  let refIndex = 0;
  const imports = {
    'react/jsx-runtime': jsx,
    react: { useRef: () => ({ current: refIndex++ === 0 ? form : null }), useEffect: effect => effects.push(effect) },
    'lucide-react': {}, 'next/link': {}, './FinancePicker': {}, './FinanceCategoryIcon': {},
    '@/lib/soundEffects': { playSound: kind => sounds.push(kind) },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, HTMLElement: Element, require: name => imports[name], document: {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
  } });
  exports.default({ form: { amount: '', type: options.type || 'expense', category: options.category }, accounts: [], categories: options.categories || [], transfer: options.transfer, saving, press: key => keys.push(key), save: close => saves.push(close), change: patch => changes.push(patch.category), changeType: type => types.push(type) });
  const cleanups = effects.map(effect => effect());
  return {
    keys, sounds, saves, changes, types, scrolls, Element, listeners,
    dispatch(key, overrides = {}) {
      const event = { key, target: new Element(), preventDefault() { this.defaultPrevented = true; }, ...overrides };
      listeners.get('keydown')?.(event);
      return event;
    },
    cleanup: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}

test('Physical digits, numpad decimal and Backspace use the amount keypad handler', () => {
  const f = fixture();
  for (const key of ['1', '0', '9', '.', ',', 'Backspace']) assert.equal(f.dispatch(key).defaultPrevented, true);
  assert.deepEqual(f.keys, ['1', '0', '9', '.', '.', 'backspace']);
  assert.deepEqual(f.sounds, Array(6).fill('input'));
  f.cleanup();
  assert.equal(f.listeners.size, 0);
});

test('Typing in notes, pickers, other dialogs or with shortcuts never changes the amount', () => {
  const f = fixture();
  for (const overrides of [
    { target: new f.Element({ input: true }) },
    { target: new f.Element({ editable: true }) },
    { target: new f.Element({ owner: {} }) },
    { target: new f.Element({ owner: null }) },
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { defaultPrevented: true },
  ]) f.dispatch('1', overrides);
  for (const key of ['Escape', 'a']) assert.equal(f.dispatch(key).defaultPrevented, undefined);
  assert.deepEqual(f.keys, []);
  assert.deepEqual(f.sounds, []);
  assert.equal(fixture(true).dispatch('1').defaultPrevented, undefined);
});

test('Tab toggles income/expense while editing, Shift+Tab and transfers retain normal navigation', () => {
  for (const type of ['income', 'expense']) {
    const f = fixture(false, { type });
    assert.equal(f.dispatch('Tab').defaultPrevented, true);
    f.dispatch('Tab', { repeat: true });
    assert.deepEqual(f.types, [type === 'income' ? 'expense' : 'income']);
    assert.equal(f.dispatch('Tab', { shiftKey: true }).defaultPrevented, undefined);
    assert.equal(f.dispatch('Tab', { target: new f.Element({ input: true }) }).defaultPrevented, undefined);
    assert.equal(f.dispatch('Tab', { target: new f.Element({ owner: {} }) }).defaultPrevented, undefined);
  }
  assert.equal(fixture(false, { transfer: {} }).dispatch('Tab').defaultPrevented, undefined);
  assert.equal(fixture(true).dispatch('Tab').defaultPrevented, undefined);
});

test('Arrows follow the two-row category grid and stop at its edges', () => {
  const categories = Array.from({ length: 5 }, (_, id) => ({ id: String(id) }));
  for (const [category, key, expected] of [
    ['0', 'ArrowRight', '2'], ['2', 'ArrowLeft', '0'], ['0', 'ArrowDown', '1'], ['1', 'ArrowUp', '0'],
    ['3', 'ArrowLeft', '1'], ['2', 'ArrowRight', '4'], ['4', 'ArrowDown', null], ['3', 'ArrowRight', null],
    ['0', 'ArrowLeft', null], ['0', 'ArrowUp', null], [undefined, 'ArrowRight', '0'],
  ]) {
    const f = fixture(false, { category, categories });
    assert.equal(f.dispatch(key).defaultPrevented, true);
    assert.deepEqual(f.changes, expected === null ? [] : [expected]);
    assert.deepEqual(f.scrolls, []);
  }
  const hidden = fixture(false, { category: '0', categories, bounds: { left: 420, right: 500 } });
  hidden.dispatch('ArrowRight');
  assert.deepEqual(hidden.scrolls, [98]);
  for (const f of [fixture(), fixture(true, { categories }), fixture(false, { categories, transfer: {} })]) {
    assert.equal(f.dispatch('ArrowRight').defaultPrevented, undefined);
  }
  const f = fixture(false, { categories });
  assert.equal(f.dispatch('ArrowDown', { target: new f.Element({ input: true }) }).defaultPrevented, undefined);
  assert.equal(f.dispatch('ArrowDown', { target: new f.Element({ owner: {} }) }).defaultPrevented, undefined);
});

test('Enter saves and continues like the plus button, including from notes, without repeat submissions', () => {
  const f = fixture();
  assert.equal(f.dispatch('Enter').defaultPrevented, true);
  assert.equal(f.dispatch('Enter', { target: new f.Element({ input: true }) }).defaultPrevented, true);
  assert.equal(f.dispatch('Enter', { repeat: true }).defaultPrevented, true);
  assert.deepEqual(f.saves, [false, false]);
  assert.deepEqual(f.sounds, ['click', 'click']);
  for (const overrides of [{ target: new f.Element({ owner: {} }) }, { target: new f.Element({ editable: true }) }, { ctrlKey: true }, { isComposing: true }]) {
    assert.equal(f.dispatch('Enter', overrides).defaultPrevented, undefined);
  }
  const busy = fixture(true);
  busy.dispatch('Enter');
  assert.deepEqual(busy.saves, []);
  assert.deepEqual(busy.sounds, []);
});
