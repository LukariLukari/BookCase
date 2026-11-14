import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

const code = ts.transpileModule(fs.readFileSync(new URL('../src/app/business/expenses/TransactionEntry.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function fixture(saving = false) {
  const effects = [], keys = [], sounds = [], saves = [], listeners = new Map();
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
  exports.default({ form: { amount: '', type: 'expense' }, accounts: [], categories: [], saving, press: key => keys.push(key), save: close => saves.push(close) });
  const cleanups = effects.map(effect => effect());
  return {
    keys, sounds, saves, Element, listeners,
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
  for (const key of ['Escape', 'Tab', 'a']) assert.equal(f.dispatch(key).defaultPrevented, undefined);
  assert.deepEqual(f.keys, []);
  assert.deepEqual(f.sounds, []);
  assert.equal(fixture(true).dispatch('1').defaultPrevented, undefined);
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
