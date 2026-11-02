'use client';

import { useState, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { applyTheme, isThemePreference, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';

const choices = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Theo thiết bị', icon: Monitor },
] as const;

function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (document.documentElement.dataset.themePreference === 'system') applyTheme('system');
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyTheme(isThemePreference(event.newValue) ? event.newValue : 'system');
  };
  window.addEventListener('billy-theme-change', notify);
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', onSystemChange);
  return () => {
    window.removeEventListener('billy-theme-change', notify);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', onSystemChange);
  };
}

function snapshot() {
  return document.documentElement.dataset.themePreference || 'system';
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const preference = useSyncExternalStore(subscribe, snapshot, () => 'system');
  const [open, setOpen] = useState(false);
  const current = choices.find(choice => choice.value === preference) || choices[2];
  const Icon = current.icon;
  const select = (value: ThemePreference) => {
    applyTheme(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Keep the session preference. */ }
    setOpen(false);
  };

  return (
    <div className={`theme-control ${compact ? 'theme-control-compact' : ''}`} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.querySelector('button')?.focus(); } }}>
      <button type="button" className="theme-toggle btn-push" aria-label={`Giao diện: ${current.label}`} title={`Giao diện: ${current.label}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Icon size={19} /><span>Giao diện: {current.label}</span>
      </button>
      {open && <div className="theme-options" role="group" aria-label="Chọn giao diện">
        {choices.map(({ value, label, icon: OptionIcon }) => <button key={value} type="button" title={label} aria-label={label} aria-pressed={preference === value} onClick={() => select(value)}><OptionIcon size={18} /><span className="theme-option-label">{label}</span></button>)}
      </div>}
    </div>
  );
}

export function PublicThemeToggle() {
  const pathname = usePathname();
  if (pathname.startsWith('/business') || pathname.startsWith('/admin')) return null;
  return <div className="public-theme-toggle"><ThemeToggle compact /></div>;
}
