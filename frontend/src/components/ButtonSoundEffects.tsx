'use client';

import { useEffect } from 'react';

type SoundKind = 'tap' | 'keypad' | 'money' | 'delete';

let sharedContext: AudioContext | null = null;

function audioContext() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioContextClass();
  if (sharedContext.state === 'suspended') void sharedContext.resume();
  return sharedContext;
}

function note(context: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function play(kind: SoundKind) {
  try {
    const context = audioContext();
    if (!context) return;
    const now = context.currentTime;
    if (kind === 'money') {
      // A short bright coin drop / cash-register confirmation.
      note(context, 1046, now, 0.09, 0.045, 'sine');
      note(context, 1568, now + 0.055, 0.16, 0.04, 'sine');
      note(context, 2093, now + 0.09, 0.1, 0.018, 'triangle');
    } else if (kind === 'keypad') {
      // A firm calculator-key blip with a short low transient and clear upper tone.
      note(context, 185, now, 0.045, 0.045, 'square');
      note(context, 720, now + 0.004, 0.07, 0.065, 'triangle');
      note(context, 1080, now + 0.012, 0.045, 0.025, 'sine');
    } else if (kind === 'delete') {
      note(context, 190, now, 0.075, 0.025, 'triangle');
    } else {
      note(context, 480, now, 0.035, 0.018, 'sine');
    }
  } catch {
    // Sound is progressive enhancement; controls remain fully functional without it.
  }
}

export default function ButtonSoundEffects() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button, a[href], [role="button"]') : null;
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      const requested = target.dataset.sound;
      const moneyIcon = target.querySelector('.lucide-plus, .lucide-check, .lucide-circle-check, .lucide-badge-check');
      const deleteIcon = target.querySelector('.lucide-trash, .lucide-trash-2, .lucide-delete');
      const keypadKey = target.classList.contains('finance-entry-key') && !target.matches('.finance-entry-add, .finance-entry-done, .finance-entry-delete');
      play(requested === 'money' || moneyIcon ? 'money' : requested === 'delete' || deleteIcon ? 'delete' : keypadKey ? 'keypad' : 'tap');
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
