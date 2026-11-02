'use client';

import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function FinanceBookPanel({ name, children }: { name?: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    let lastY = window.scrollY;
    let distance = 0;
    let settleUntil = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      // Ignore scroll anchoring caused by our own height transition.
      if (performance.now() < settleUntil) return;
      distance = Math.sign(delta) === Math.sign(distance) ? distance + delta : delta;
      if (y < 48 || distance < -40) {
        setCollapsed(false);
        settleUntil = performance.now() + 260;
        distance = 0;
      } else if (y > 160 && distance > 40 && !panel.current?.contains(document.activeElement)) {
        setCollapsed(true);
        settleUntil = performance.now() + 260;
        distance = 0;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <section ref={panel} className={`finance-book-panel${collapsed ? ' is-collapsed' : ''}`}>
    <button type="button" className="finance-book-toggle" aria-expanded={!collapsed} aria-controls="finance-book-details" onClick={() => setCollapsed(value => !value)}>
      <BookOpen size={18} /><span className="min-w-0 flex-1 truncate text-left">{name || 'Sổ thu chi'}</span>{collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
    </button>
    <div id="finance-book-details" className="finance-book-details" inert={collapsed}>
      <div>{children}</div>
    </div>
  </section>;
}
