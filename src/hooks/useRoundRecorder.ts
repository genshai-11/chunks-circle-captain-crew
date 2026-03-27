import { useCallback, useEffect, useRef, useState } from 'react';

function createIdleLevels() {
  return Array.from({ length: 12 }, () => 0.08);
}

function getPreferredAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useRoundRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimeMs, setRecordingTimeMs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(createIdleLevels());

  const clearVisualizer = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setLevels(createIdleLevels());
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startVisualizer = useCallback((stream: MediaStream) => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = context;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      analyser.getByteFrequencyData(data);
      const bucketSize = Math.max(1, Math.floor(data.length / 12));
      const next = Array.from({ length: 12 }, (_, index) => {
        const start = index * bucketSize;
        const end = Math.min(data.length, start + bucketSize);
        let total = 0;
        for (let i = start; i < end; i += 1) total += data[i];
        const avg = end > start ? total / (end - start) : 0;
        return Math.max(0.08, Math.min(1, avg / 160));
      });
      setLevels(next);
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMimeType = getPreferredAudioMimeType();
      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.start();
      startVisualizer(stream);
      setIsRecording(true);
      setRecordingTimeMs(0);
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) setRecordingTimeMs(Date.now() - startedAtRef.current);
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Microphone access failed');
    }
  }, [startVisualizer]);

  const stop = useCallback(async () => {
    if (!mediaRecorderRef.current) return null;
    return await new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setIsRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
        clearVisualizer();
        stopStream();
        mediaRecorderRef.current = null;
        resolve(blob);
      };
      recorder.stop();
    });
  }, [clearVisualizer, stopStream]);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setRecordingTimeMs(0);
    setError(null);
    setLevels(createIdleLevels());
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      clearVisualizer();
      stopStream();
    };
  }, [clearVisualizer, stopStream]);

  return {
    isRecording,
    recordingTimeMs,
    audioBlob,
    error,
    levels,
    start,
    stop,
    reset,
  };
}
