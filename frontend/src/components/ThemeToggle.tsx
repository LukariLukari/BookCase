'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { applyTheme, isThemePreference, THEME_STORAGE_KEY } from '@/lib/theme';

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
  return document.documentElement.dataset.theme || 'light';
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'light');
  const dark = theme === 'dark';
  const Icon = dark ? Moon : Sun;
  const toggle = () => {
    const value = dark ? 'light' : 'dark';
    applyTheme(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Keep the session preference. */ }
  };

  return (
    <div className={`theme-control ${compact ? 'theme-control-compact' : ''}`}>
      <button type="button" className="theme-toggle btn-push" aria-label="Giao diện tối" aria-pressed={dark} title={`Chuyển sang giao diện ${dark ? 'sáng' : 'tối'}`} onClick={toggle}>
        <Icon size={19} /><span>Giao diện: {dark ? 'Tối' : 'Sáng'}</span>
      </button>
    </div>
  );
}

export function PublicThemeToggle() {
  const pathname = usePathname();
  if (pathname.startsWith('/business') || pathname.startsWith('/admin')) return null;
  return <div className="public-theme-toggle"><ThemeToggle compact /></div>;
}
