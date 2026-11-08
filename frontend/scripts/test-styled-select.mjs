import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
const source = fs.readFileSync(new URL('../src/components/StyledSelect.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const option = (value, label, disabled = false) => React.createElement('option', { value, disabled }, label);
function fixture(props) {
  const state = [], refs = [];
  let slot = 0, ref = 0, changes = 0, focused = false;
  const native = { value: String(props.value ?? props.defaultValue ?? ''), dispatchEvent(event) { changes++; props.onChange?.({ type: event.type, target: this }); } };
  const imports = { 'react/jsx-runtime': jsx, '@/app/business/expenses/FinancePicker': { FinanceSelect: () => null }, react: { ...React, useId: () => 'picker', useRef: () => refs[ref++] ||= { current: ref === 1 ? native : { focus() { focused = true; } } }, useState(initial) { const index = slot++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial; return [state[index], value => { state[index] = value; }]; } } };
  const exports = {};
  vm.runInNewContext(code, { exports, Event, require: name => imports[name] });
  const render = () => { slot = 0; ref = 0; return exports.default(props).props.children; };
  return { render, native, get changes() { return changes; }, get focused() { return focused; } };
}
test('The custom picker keeps option values, Vietnamese labels and disabled choices', () => {
  const f = fixture({ value: 'percent', disabled: true, children: [option('amount', 'Giảm số tiền (đ)'), option('percent', 'Giảm phần trăm (%)'), option('custom', 'Tặng quà', true)] });
  const [native, picker] = f.render();
  assert.equal(native.props.hidden, true);
  assert.equal(picker.props.value, 'percent');
  assert.equal(picker.props.disabled, true);
  assert.equal(picker.props.options[1].label, 'Giảm phần trăm (%)');
  assert.equal(picker.props.options[2].disabled, true);
});
test('Choosing a custom option forwards the new native value to existing form handlers', () => {
  let value;
  const f = fixture({ value: 'amount', onChange: event => { value = event.target.value; }, children: [option('amount', 'Số tiền'), option('percent', 'Phần trăm')] });
  f.render()[1].props.onChange('percent');
  assert.equal(value, 'percent');
  assert.equal(f.native.value, 'percent');
  assert.equal(f.changes, 1);
});
test('Required fields focus the visible picker on invalid submission and clear after choosing', () => {
  const f = fixture({ required: true, value: '', children: [option('', 'Chọn ứng dụng'), option('Netflix', 'Netflix')] });
  const [native] = f.render();
  let prevented = false;
  native.props.onInvalid({ preventDefault() { prevented = true; } });
  assert.equal(native.props.required, true);
  assert.equal(prevented, true);
  assert.equal(f.focused, true);
  assert.equal(f.render()[1].props.invalid, true);
  f.render()[1].props.onChange('Netflix');
  assert.equal(f.render()[1].props.invalid, false);
});
test('Implicit option values and uncontrolled selects retain the chosen display value', () => {
  const f = fixture({ children: [option(undefined, 'VND'), option(undefined, 'USD')] });
  assert.equal(f.render()[1].props.value, 'VND');
  f.render()[1].props.onChange('USD');
  assert.equal(f.render()[1].props.value, 'USD');
});
