'use client';

import { MotionConfig } from 'framer-motion';

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 440, damping: 36, mass: 0.8 }}>
      {children}
    </MotionConfig>
  );
}
