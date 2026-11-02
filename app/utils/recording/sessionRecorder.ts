/**
 * app/utils/recording/sessionRecorder.ts
 *
 * Records the microphone and/or front camera for a whole participant session when the study's
 * audioRecord / cameraRecord switches are on. One file per session: camera + audio share one video file.
 *
 * Browsers only allow this on HTTPS or localhost, and ask for permission once per site. The tablet
 * asks while the researcher is still holding it (after preloading), so participants never see the prompt.
 */

import type { RunRecording, StudyControlSettings } from '@/app/types';
import { wallClockIso } from '@/app/utils/runner';

export interface RecordingWanted {
  audio: boolean;
  camera: boolean;
}

export function recordingWanted(
  controls: Pick<StudyControlSettings, 'audioRecord' | 'cameraRecord'>
): RecordingWanted | null {
  if (!controls.audioRecord && !controls.cameraRecord) return null;
  return { audio: controls.audioRecord, camera: controls.cameraRecord };
}

/**
 * Small enough for the 50 MB bucket limit: about 4.5 MB per minute with the camera,
 * so roughly 11 minutes of camera or several hours of audio per session.
 */
const VIDEO_BITS_PER_SECOND = 500_000;
const AUDIO_BITS_PER_SECOND = 64_000;

const VIDEO_TYPES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

/** First container the browser can record (Chrome/Android: WebM, Safari/iPad: MP4); '' lets the browser pick. */
export function pickMimeType(wanted: RecordingWanted, isTypeSupported: (type: string) => boolean): string {
  return (wanted.camera ? VIDEO_TYPES : AUDIO_TYPES).find((type) => isTypeSupported(type)) ?? '';
}

function constraints(wanted: RecordingWanted): MediaStreamConstraints {
  return {
    audio: wanted.audio,
    video: wanted.camera ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
  };
}

function what(wanted: RecordingWanted): string {
  return wanted.audio && wanted.camera ? 'camera and microphone' : wanted.camera ? 'camera' : 'microphone';
}

async function openStream(wanted: RecordingWanted): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    throw new Error(
      `This study records the ${what(wanted)}, which this browser only allows over HTTPS or on localhost.`
    );
  }
  try {
    return await navigator.mediaDevices.getUserMedia(constraints(wanted));
  } catch (error) {
    const denied =
      error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
    throw new Error(
      denied
        ? `This study records the ${what(wanted)}. Allow access in the browser, then try again.`
        : `Could not open the ${what(wanted)}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

/** Asks for permission (researcher still holding the tablet) and releases the devices straight away. */
export async function checkRecordingPermission(wanted: RecordingWanted): Promise<void> {
  stopTracks(await openStream(wanted));
}

export interface SessionRecording {
  /** Stops recording and returns the file with its metadata. */
  stop(): Promise<{ blob: Blob; recording: RunRecording }>;
  /** Stops recording and throws the file away (researcher left the session). */
  cancel(): void;
}

/** Starts recording; resolves once the recorder is actually running, so startedAtIso is accurate. */
export async function startSessionRecording(wanted: RecordingWanted): Promise<SessionRecording> {
  const stream = await openStream(wanted);
  const mimeType = pickMimeType(wanted, (type) => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      ...(wanted.camera ? { videoBitsPerSecond: VIDEO_BITS_PER_SECOND } : {}),
    });
  } catch (error) {
    stopTracks(stream);
    throw error;
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const startedAtIso = await new Promise<string>((resolve, reject) => {
    recorder.onstart = () => resolve(wallClockIso());
    recorder.onerror = () => reject(new Error('The recorder failed to start.'));
    // A timeslice keeps memory in small chunks instead of one growing buffer.
    recorder.start(1000);
  }).catch((error) => {
    stopTracks(stream);
    throw error;
  });

  const finish = () =>
    new Promise<void>((resolve) => {
      if (recorder.state === 'inactive') return resolve();
      recorder.onstop = () => resolve();
      recorder.stop();
    }).finally(() => stopTracks(stream));

  return {
    async stop() {
      await finish();
      const type = recorder.mimeType || mimeType || (wanted.camera ? 'video/webm' : 'audio/webm');
      return { blob: new Blob(chunks, { type }), recording: { mimeType: type, startedAtIso } };
    },
    cancel() {
      void finish();
      chunks.length = 0;
    },
  };
}
