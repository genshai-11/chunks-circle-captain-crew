import { useEffect, useState } from 'react';
import { defaultPublicScoringSettings, subscribePublicScoringSettings, type PublicScoringSettings } from '@/services/publicScoringRepository';

export function usePublicScoring() {
  const [scoring, setScoring] = useState<PublicScoringSettings>(defaultPublicScoringSettings);

  useEffect(() => {
    const unsub = subscribePublicScoringSettings(setScoring);
    return () => unsub?.();
  }, []);

  return scoring;
}
