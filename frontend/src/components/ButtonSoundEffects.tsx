'use client';

import { useEffect } from 'react';
import { attachSoundEffects, createSoundPlayer } from '@/lib/soundEffects';

export default function ButtonSoundEffects() {
  useEffect(() => attachSoundEffects(createSoundPlayer()), []);
  return null;
}
