import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Voice-note recording built on the browser MediaRecorder API.
//
//  hold 🎤 → recording (timer runs) → release pauses · 🔒 keeps recording
//  hands-free → 🗑️ discards → ➤ stops and hands the blob to the composer.
//
// Falls back gracefully: `supported` is false on browsers without
// MediaRecorder (Safari <14.1 / older in-app browsers), where the composer
// shows an informative message instead of a broken button.
// ---------------------------------------------------------------------------

export default function useVoiceRecorder({ onComplete, onError, maxMs = 5 * 60 * 1000 } = {}) {
  const [state, setState] = useState('idle'); // idle | recording | paused
  const [locked, setLocked] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const elapsedBaseRef = useRef(0);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  const supported =
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const stopTimer = useCallback(() => {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch (e) {
        // already inactive
      }
    }
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    chunksRef.current = [];
    elapsedBaseRef.current = 0;
    startedAtRef.current = 0;
    setLocked(false);
    setElapsedMs(0);
    setState('idle');
  }, [stopTimer]);

  // Hard stop at the maximum length so a locked recording cannot run forever.
  useEffect(() => {
    if (state === 'recording' && elapsedMs >= maxMs) {
      finishRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, maxMs, state]);

  const begin = useCallback(async () => {
    if (!supported || recorderRef.current) return;
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const duration = elapsedBaseRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const hadData = blob.size > 0;
        const keep = recorderRef.current === recorder;
        recorderRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        if (keep && hadData && duration >= 500 && onComplete) {
          onComplete(blob, duration);
        }
        chunksRef.current = [];
        elapsedBaseRef.current = 0;
        setLocked(false);
        setElapsedMs(0);
        setState('idle');
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(250);
      setState('recording');
      timerRef.current = window.setInterval(() => {
        setElapsedMs(elapsedBaseRef.current + (Date.now() - startedAtRef.current));
      }, 200);
    } catch (err) {
      teardown();
      if (onError) onError('Microphone unavailable — check permissions.');
    }
  }, [supported, onComplete, onError, teardown]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.pause();
    elapsedBaseRef.current += Date.now() - startedAtRef.current;
    stopTimer();
    setElapsedMs(elapsedBaseRef.current);
    setState('paused');
  }, [stopTimer]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    startedAtRef.current = Date.now();
    recorder.resume();
    timerRef.current = window.setInterval(() => {
      setElapsedMs(elapsedBaseRef.current + (Date.now() - startedAtRef.current));
    }, 200);
    setState('recording');
  }, []);

  // Ends recording and delivers the blob through onComplete (via onstop).
  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    stopTimer();
    if (!recorder) {
      teardown();
      return;
    }
    if (recorder.state === 'recording') {
      elapsedBaseRef.current += Date.now() - startedAtRef.current;
    }
    setElapsedMs(elapsedBaseRef.current);
    try {
      recorder.stop();
    } catch (e) {
      teardown();
    }
  }, [stopTimer, teardown]);

  const discard = useCallback(() => {
    cancelledRef.current = true;
    // Detach the completion path, then stop the recorder/stream.
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorderRef.current = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch (e) {
        // ignore
      }
      recorder.stream.getTracks().forEach((t) => t.stop());
    }
    teardown();
  }, [teardown]);

  useEffect(() => () => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch (e) {
        // ignore
      }
      recorder.stream.getTracks().forEach((t) => t.stop());
    }
    stopTimer();
  }, [stopTimer]);

  return {
    supported,
    state, // idle | recording | paused
    locked,
    elapsedMs,
    begin,
    pause,
    resume,
    finish: finishRecording,
    discard,
    setLocked,
  };
}
