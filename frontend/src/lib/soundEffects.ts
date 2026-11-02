export const SOUND_URLS = {
  click: '/sounds/minecraft-click-menu.mp3',
  complete: '/sounds/nintendo-switch-click.mp3',
  input: '/sounds/click-123.mp3',
};
export type SoundKind = keyof typeof SOUND_URLS;
const MAX_PENDING_AGE = 180;

// MP3 padding/leading silence must not become perceptible button latency.
export function trimLeadingSilence(context: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  let onset = 0;
  while (onset < buffer.length && channels.every(channel => Math.abs(channel[onset]) < 0.001)) onset++;
  const start = Math.max(0, onset - Math.ceil(buffer.sampleRate * 0.002));
  if (start === 0 || onset === buffer.length) return buffer;
  const trimmed = context.createBuffer(buffer.numberOfChannels, buffer.length - start, buffer.sampleRate);
  channels.forEach((channel, index) => trimmed.getChannelData(index).set(channel.subarray(start)));
  return trimmed;
}

export function createSoundPlayer() {
  let context: AudioContext | null = null;
  let disposed = false;
  let pending: { kind: SoundKind; time: number } | null = null;
  const buffers = new Map<SoundKind, AudioBuffer>();
  const loading = new Map<SoundKind, Promise<void>>();
  const sources = new Set<AudioBufferSourceNode>();
  const abort = new AbortController();

  const getContext = () => {
    if (disposed) return null;
    // iOS can leave the old context interrupted after locking/backgrounding a PWA.
    if (context && ['closed', 'interrupted'].includes(context.state)) {
      sources.forEach(source => { try { source.stop(); source.disconnect(); } catch {} });
      sources.clear();
      void context.close().catch(() => {});
      context = null;
    }
    if (!context) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      try { context = new AudioContextClass({ latencyHint: 'interactive' }); } catch { return null; }
    }
    return context;
  };

  const flush = () => {
    if (!pending || disposed) return;
    if (document.visibilityState === 'hidden' || performance.now() - pending.time > MAX_PENDING_AGE) {
      pending = null;
      return;
    }
    const buffer = buffers.get(pending.kind);
    if (!context || context.state !== 'running' || !buffer) return;
    pending = null;
    try {
      // Buffer sources are cheap, single-use nodes; decoded PCM is shared.
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      sources.add(source);
      source.onended = () => { source.disconnect(); sources.delete(source); };
      if (sources.size > 16) {
        const oldest = sources.values().next().value;
        oldest?.stop();
        oldest?.disconnect();
        if (oldest) sources.delete(oldest);
      }
      source.start(0);
    } catch { /* Sound must never block an action. */ }
  };

  const preload = () => {
    const decoder = getContext();
    if (!decoder) return;
    for (const kind of Object.keys(SOUND_URLS) as SoundKind[]) {
      if (buffers.has(kind) || loading.has(kind)) continue;
      const request = fetch(SOUND_URLS[kind], { signal: abort.signal, cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error('Sound unavailable');
          return response.arrayBuffer();
        })
        .then(bytes => decoder.decodeAudioData(bytes))
        .then(buffer => {
          if (!disposed) { buffers.set(kind, trimLeadingSilence(decoder, buffer)); flush(); }
        })
        .catch(() => { /* Retry a failed load on the next interaction. */ })
        .finally(() => { loading.delete(kind); });
      loading.set(kind, request);
    }
  };

  const unlock = () => {
    if (disposed) return;
    // Safari supports this progressively. Playback also works with iOS's silent
    // switch where Audio Session is available; no looping silent media is needed.
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== 'playback') session.type = 'playback';
    } catch { /* Older Safari versions do not expose Audio Session. */ }
    const active = getContext();
    if (!active) return;
    if (active.state !== 'running') {
      // Call resume AND start within the trusted gesture, before any await.
      try {
        void active.resume().then(flush).catch(() => {});
        const prime = active.createBufferSource();
        prime.buffer = active.createBuffer(1, 1, active.sampleRate);
        prime.connect(active.destination);
        prime.onended = () => prime.disconnect();
        prime.start(0);
      } catch { /* A later touchend/click can unlock again. */ }
    }
    preload();
    flush();
  };

  return {
    preload,
    unlock,
    play(kind: SoundKind) {
      pending = { kind, time: performance.now() };
      unlock();
    },
    restore() {
      pending = null;
      // Only resume here; the next real tap also retries within a user gesture.
      const active = getContext();
      if (active && active.state !== 'running') void active.resume().catch(() => {});
      preload();
    },
    dispose() {
      disposed = true;
      pending = null;
      abort.abort();
      sources.forEach(source => { try { source.stop(); source.disconnect(); } catch {} });
      sources.clear();
      if (context) void context.close().catch(() => {});
      buffers.clear();
    },
  };
}

type SoundPlayer = ReturnType<typeof createSoundPlayer>;

function soundTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest('button, a[href], [role="button"], input, textarea, select, label, [data-sound]') || target;
  return control instanceof HTMLLabelElement && control.control ? control.control : control;
}

function soundKind(target: Element | null): SoundKind | null {
  if (!target || target.closest(':disabled, [aria-disabled="true"], [data-sound="none"]')) return null;
  const requested = target.closest<HTMLElement>('[data-sound]')?.dataset.sound;
  return requested === 'complete' || requested === 'input' ? requested : 'click';
}

export function attachSoundEffects(player: SoundPlayer) {
  let touch: { id: number; x: number; y: number; moved: boolean } | null = null;
  let lastTap: { target: Element; time: number } | null = null;
  const options = { capture: true, passive: true };
  const unlock = (event: Event) => {
    if (!event.isTrusted) return;
    if (event.type === 'keydown' || (event.type === 'pointerdown' && (event as PointerEvent).pointerType !== 'touch')) lastTap = null;
    player.unlock();
  };
  const onTouchStart = (event: TouchEvent) => {
    if (!event.isTrusted) return;
    player.unlock();
    const first = event.changedTouches[0];
    touch = event.touches.length === 1 && first ? { id: first.identifier, x: first.clientX, y: first.clientY, moved: false } : null;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!touch) return;
    const current = Array.from(event.changedTouches).find(point => point.identifier === touch?.id);
    if (current && Math.hypot(current.clientX - touch.x, current.clientY - touch.y) > 10) touch.moved = true;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (!event.isTrusted) return;
    player.unlock();
    const start = touch;
    touch = null;
    const end = start && Array.from(event.changedTouches).find(point => point.identifier === start.id);
    if (!start || start.moved || !end || Math.hypot(end.clientX - start.x, end.clientY - start.y) > 10) return;
    // Play at finger release, before Safari's compatibility click and React work.
    const target = soundTarget(event.target);
    if (event.target instanceof Element && event.target.closest('[data-sound="none"]')) return;
    const kind = soundKind(target);
    if (kind && target) {
      player.play(kind);
      lastTap = { target, time: performance.now() };
    }
  };
  const cancelTouch = () => { touch = null; };
  const onClick = (event: MouseEvent) => {
    if (!event.isTrusted) return;
    player.unlock();
    const target = soundTarget(event.target);
    // Ignore only the matching touch-generated click; keyboard clicks still work.
    if (lastTap?.target === target && performance.now() - lastTap.time < 750) return;
    if (event.target instanceof Element && event.target.closest('[data-sound="none"]')) return;
    // A label forwards another click to its control. The control owns its sound.
    if (event.target instanceof Element && event.target.closest('label')?.control === target && !target?.contains(event.target)) return;
    const kind = soundKind(target);
    if (kind) player.play(kind);
  };
  const onInput = (event: Event) => {
    if (!event.isTrusted) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('[data-sound="none"], :disabled, [aria-disabled="true"]')) return;
    const textInput = target instanceof HTMLInputElement &&
      ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(target.type) && !target.readOnly;
    if (textInput || (target instanceof HTMLTextAreaElement && !target.readOnly) || target.isContentEditable) player.play('input');
  };
  const onVisible = () => { if (document.visibilityState === 'visible') player.restore(); };
  const onPageHide = () => { cancelTouch(); lastTap = null; };
  document.addEventListener('pointerdown', unlock, options);
  document.addEventListener('keydown', unlock, options);
  document.addEventListener('touchstart', onTouchStart, options);
  document.addEventListener('touchmove', onTouchMove, options);
  document.addEventListener('touchend', onTouchEnd, options);
  document.addEventListener('touchcancel', cancelTouch, options);
  document.addEventListener('click', onClick, options);
  document.addEventListener('input', onInput, options);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  window.addEventListener('pagehide', onPageHide);
  player.preload();
  return () => {
    document.removeEventListener('pointerdown', unlock, options);
    document.removeEventListener('keydown', unlock, options);
    document.removeEventListener('touchstart', onTouchStart, options);
    document.removeEventListener('touchmove', onTouchMove, options);
    document.removeEventListener('touchend', onTouchEnd, options);
    document.removeEventListener('touchcancel', cancelTouch, options);
    document.removeEventListener('click', onClick, options);
    document.removeEventListener('input', onInput, options);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onVisible);
    window.removeEventListener('pagehide', onPageHide);
    player.dispose();
  };
}
