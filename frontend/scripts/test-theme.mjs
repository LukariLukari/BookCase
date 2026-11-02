import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/theme.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(code, { exports });
const { contrastRatio, ensureContrast, darkPalette, darkSurfaces, themeBootstrapScript, isThemePreference } = exports;

test('contrast calculation matches black/white reference and is symmetric', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#abcdef', '#abcdef'), 1);
  assert.equal(contrastRatio('#123456', '#abcdef'), contrastRatio('#abcdef', '#123456'));
});

test('all dark text tokens pass their contrast targets on every surface', () => {
  for (const token of ['text', 'muted', 'accent', 'success', 'danger', 'info', 'border']) {
    const minimum = token === 'text' ? 7 : token === 'border' ? 3 : 4.5;
    for (const background of darkSurfaces) {
      assert.ok(contrastRatio(darkPalette[`--theme-${token}`], background) >= minimum, `${token} against ${background}`);
    }
  }
  for (const token of ['action', 'action-hover']) assert.ok(contrastRatio('#ffffff', darkPalette[`--theme-${token}`]) >= 4.5);
  for (const background of ['#256341', '#9c3528', '#20587e']) assert.ok(contrastRatio('#ffffff', background) >= 4.5);
});

test('contrast adjustment preserves passing seeds and corrects failing seeds in either direction', () => {
  assert.equal(ensureContrast('#ffffff', ['#000000']), '#ffffff');
  assert.ok(contrastRatio(ensureContrast('#333333', ['#292d33']), '#292d33') >= 4.5);
  assert.ok(contrastRatio(ensureContrast('#dddddd', ['#ffffff']), '#ffffff') >= 4.5);
  assert.throws(() => ensureContrast('#777777', ['#000000', '#ffffff'], 7));
});

function bootstrap(saved, systemDark = false, storageBlocked = false) {
  const root = { dataset: {}, style: { setProperty(key, value) { this[key] = value; } } };
  vm.runInNewContext(themeBootstrapScript, {
    document: { documentElement: root },
    matchMedia: () => ({ matches: systemDark }),
    localStorage: { getItem() { if (storageBlocked) throw new Error('blocked'); return saved; } },
  });
  return root;
}

test('before-paint bootstrap respects saved modes, system settings and unavailable storage', () => {
  assert.equal(bootstrap('light', true).dataset.theme, 'light');
  assert.equal(bootstrap('dark', false).dataset.theme, 'dark');
  assert.equal(bootstrap('system', true).dataset.theme, 'dark');
  assert.equal(bootstrap(null, false).dataset.theme, 'light');
  assert.equal(bootstrap('invalid', true).dataset.theme, 'dark');
  assert.equal(bootstrap(null, true, true).dataset.theme, 'dark');
  assert.equal(bootstrap('dark').style['--theme-text'], darkPalette['--theme-text']);
  assert.equal(isThemePreference('invalid'), false);
});

test('changing theme follows the device only in system mode and notifies controls', () => {
  const root = { dataset: {}, style: { setProperty() {} } };
  let deviceDark = true;
  let notifications = 0;
  const runtime = {};
  vm.runInNewContext(code, {
    exports: runtime,
    document: { documentElement: root },
    window: { matchMedia: () => ({ matches: deviceDark }), dispatchEvent: () => { notifications++; } },
    Event: class { constructor(type) { this.type = type; } },
  });
  runtime.applyTheme('system');
  assert.equal(root.dataset.theme, 'dark');
  deviceDark = false;
  runtime.applyTheme('system');
  assert.equal(root.dataset.theme, 'light');
  runtime.applyTheme('dark');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.themePreference, 'dark');
  assert.equal(notifications, 3);
});
