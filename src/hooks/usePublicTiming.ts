import { useEffect, useState } from 'react';
import { defaultPublicTimingSettings, subscribePublicTimingSettings, type PublicTimingSettings } from '@/services/publicTimingRepository';

export function usePublicTiming() {
  const [timing, setTiming] = useState<PublicTimingSettings>(defaultPublicTimingSettings);

  useEffect(() => {
    const unsub = subscribePublicTimingSettings(setTiming);
    return () => unsub?.();
  }, []);

  return timing;
}
