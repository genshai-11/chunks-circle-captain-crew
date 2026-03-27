import { useCallback, useState } from 'react';

export function useMicrophoneGate() {
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const requestMic = useCallback(async () => {
    setMicError(null);
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicReady(true);
    } catch (err: any) {
      setMicError(err?.message || 'Microphone permission denied');
      setMicReady(false);
    } finally {
      setRequesting(false);
    }
  }, []);

  return { micReady, micError, requesting, requestMic, setMicReady };
}
