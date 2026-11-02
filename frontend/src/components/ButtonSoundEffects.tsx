'use client';

import { useEffect } from 'react';

const SOUND_URLS = {
  click: '/sounds/minecraft-click-menu.mp3',
  complete: '/sounds/nintendo-switch-click.mp3',
  input: '/sounds/click-123.mp3',
};
type SoundKind = keyof typeof SOUND_URLS;
const AUDIO_POOL_SIZE = 4;

export default function ButtonSoundEffects() {
  useEffect(() => {
    // Reuse preloaded players so rapid clicks can overlap without downloading again.
    const pools = Object.fromEntries(Object.entries(SOUND_URLS).map(([kind, url]) => [kind, {
      players: Array.from({ length: AUDIO_POOL_SIZE }, () => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.load();
        return audio;
      }),
      nextPlayer: 0,
    }])) as Record<SoundKind, { players: HTMLAudioElement[]; nextPlayer: number }>;

    const play = (kind: SoundKind) => {
      const pool = pools[kind];
      const audio = pool.players[pool.nextPlayer];
      pool.nextPlayer = (pool.nextPlayer + 1) % pool.players.length;
      try {
        audio.currentTime = 0;
        void audio.play().catch(() => {
          // Unavailable audio must never interrupt the control.
        });
      } catch {
        // Controls also work when the browser cannot play audio.
      }
    };

    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(':disabled, [aria-disabled="true"]')) return;
      // Labels forward a click to their control; let that click play the sound once.
      const label = target?.closest('label');
      if (label?.control && target !== label.control && !label.control.contains(target)) return;

      const requested = target?.closest<HTMLElement>('[data-sound]')?.dataset.sound;
      if (requested === 'none') return;
      play(requested === 'complete' || requested === 'input' ? requested : 'click');
    };

    const onInput = (event: Event) => {
      if (!event.isTrusted) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest('[data-sound="none"], :disabled, [aria-disabled="true"]')) return;
      const textInput = target instanceof HTMLInputElement &&
        ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(target.type) && !target.readOnly;
      if (textInput || (target instanceof HTMLTextAreaElement && !target.readOnly) || target.isContentEditable) {
        play('input');
      }
    };

    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('input', onInput, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('input', onInput, { capture: true });
      Object.values(pools).flatMap(pool => pool.players).forEach((audio) => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, []);

  return null;
}
