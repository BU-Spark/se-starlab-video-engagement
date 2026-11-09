'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Block, RunResult, Study } from '@/app/types';
import { useKiosk, useLocalStorage } from '@/app/hooks';
import { studyRepository, type StudySummary } from '@/app/utils/studies';
import { orderBlocks } from '@/app/utils/runner';
import { preloadStudy, releaseMedia, type MediaMap, type PreloadProgress } from '@/app/utils/preload/preloadStudy';
import {
  checkRecordingPermission,
  deleteRecording,
  loadRecording,
  recordingWanted,
  saveRecording,
  startSessionRecording,
  type SessionRecording,
} from '@/app/utils/recording';
import { StudySelectScreen } from '../components/StudySelectScreen';
import { PreloadScreen } from '../components/PreloadScreen';
import { ParticipantIdScreen } from '../components/ParticipantIdScreen';
import { CompletionScreen, type UploadStatus } from '../components/CompletionScreen';
import { ResearcherExit } from '../components/ResearcherExit';
import { tabletStyles } from '../components/TabletScreen';
import { StudySession } from './StudySession';
import styles from './tablet.module.css';

const PENDING_RUNS_KEY = 'pending-runs';
const RESEARCHER_PIN = process.env.NEXT_PUBLIC_RESEARCHER_PIN ?? '0000';
const EMPTY_PROGRESS: PreloadProgress = { loadedBytes: 0, totalBytes: 0, filesDone: 0, filesTotal: 0 };

type Phase =
  | { name: 'select' }
  | { name: 'loading'; studyId: string; studyName: string }
  | { name: 'participant'; study: Study; media: MediaMap }
  | {
      name: 'running';
      study: Study;
      media: MediaMap;
      blocks: Block[];
      participantId: string;
      startedAtIso: string;
    }
  | { name: 'done'; status: UploadStatus };

const runKey = (run: RunResult) => `${run.studyId}|${run.participantId}|${run.startedAtIso}`;

/**
 * The participant tablet app. Everything happens on this one page so the preloaded videos and
 * fullscreen survive the whole session: select study → preload → participant ID → blocks → upload.
 */
export function TabletApp() {
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [studiesLoading, setStudiesLoading] = useState(true);
  const [studiesError, setStudiesError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PreloadProgress>(EMPTY_PROGRESS);
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const [preloadAttempt, setPreloadAttempt] = useState(0);
  const [pendingRuns, setPendingRuns] = useLocalStorage<RunResult[]>(PENDING_RUNS_KEY, []);
  const kiosk = useKiosk(phase.name === 'running' || phase.name === 'done');

  // ---- Uploads: every finished run is queued on the tablet first, then sent. ----
  // Recordings wait in IndexedDB under the run's key; `fresh` holds one just recorded, in case storing it failed.
  const flushing = useRef(false);
  const uploadRuns = useCallback(
    async (runs: RunResult[], fresh?: { key: string; blob: Blob }): Promise<boolean> => {
      if (flushing.current) return false;
      flushing.current = true;
      const sent = new Set<string>();
      for (const run of runs) {
        const key = runKey(run);
        try {
          let recording: Blob | null = null;
          if (run.recording) {
            recording = fresh?.key === key ? fresh.blob : await loadRecording(key).catch(() => null);
            if (!recording) console.warn('[tablet] Recording missing on this tablet; uploading the run without it');
          }
          await studyRepository.submitRun(run, recording);
          sent.add(key);
          if (run.recording) await deleteRecording(key).catch(() => undefined);
        } catch (error) {
          console.warn('[tablet] Upload failed; keeping run queued', error);
        }
      }
      flushing.current = false;
      setPendingRuns((current) => current.filter((r) => !sent.has(runKey(r))));
      return sent.size === runs.length;
    },
    [setPendingRuns]
  );

  // ---- Study list (synced every time we return to the select screen) ----
  const loadStudies = useCallback(async () => {
    setStudiesLoading(true);
    setStudiesError(null);
    try {
      setStudies(await studyRepository.listStudies());
    } catch (error) {
      setStudiesError(error instanceof Error ? error.message : 'Could not load studies');
    } finally {
      setStudiesLoading(false);
    }
  }, []);

  const pendingAtStartup = useRef(pendingRuns);
  useEffect(() => {
    loadStudies();
    // Retry uploads left over from earlier sessions (e.g. the Wi-Fi was down).
    if (pendingAtStartup.current.length > 0) uploadRuns(pendingAtStartup.current);
  }, [loadStudies, uploadRuns]);

  // Studies created or deleted on the researcher website show up when the tablet screen comes back into view.
  const onSelectScreen = phase.name === 'select';
  useEffect(() => {
    if (!onSelectScreen) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') loadStudies();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [onSelectScreen, loadStudies]);

  // ---- Preloading ----
  const loadingStudyId = phase.name === 'loading' ? phase.studyId : null;
  useEffect(() => {
    if (!loadingStudyId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const study = await studyRepository.getStudy(loadingStudyId);
        const media = await preloadStudy(study, setProgress, controller.signal);
        if (controller.signal.aborted) {
          releaseMedia(media);
          return;
        }
        // Ask for camera/microphone now, while the researcher still holds the tablet.
        const wanted = recordingWanted(study.controls);
        if (wanted) {
          try {
            await checkRecordingPermission(wanted);
          } catch (error) {
            releaseMedia(media);
            throw error;
          }
          if (controller.signal.aborted) {
            releaseMedia(media);
            return;
          }
        }
        setPhase({ name: 'participant', study, media });
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreloadError(error instanceof Error ? error.message : 'Download failed');
        }
      }
    })();
    return () => controller.abort();
  }, [loadingStudyId, preloadAttempt]);

  const selectStudy = (studyId: string) => {
    setProgress(EMPTY_PROGRESS);
    setPreloadError(null);
    setPhase({ name: 'loading', studyId, studyName: studies.find((s) => s.id === studyId)?.name ?? '' });
  };

  // ---- Recording: started with the session, stopped when the last block is swiped away. ----
  const recorder = useRef<Promise<SessionRecording | null> | null>(null);
  const cancelRecording = useCallback(() => {
    void recorder.current?.then((session) => session?.cancel());
    recorder.current = null;
  }, []);
  useEffect(() => cancelRecording, [cancelRecording]);

  const backToStudies = () => {
    // Leaving mid-session discards the run, so its recording goes too.
    cancelRecording();
    if (phase.name === 'participant' || phase.name === 'running') releaseMedia(phase.media);
    // Fullscreen is only for the session itself. Staying in it afterwards stopped the next
    // Participant ID box from taking typing until Esc; the next Start tap re-enters it.
    kiosk.exit();
    setPhase({ name: 'select' });
    loadStudies();
  };

  // ---- Session ----
  const startSession = (participantId: string) => {
    if (phase.name !== 'participant') return;
    // Called inside the Start tap, which is what lets the browser go fullscreen and play sound.
    kiosk.enter();
    const wanted = recordingWanted(phase.study.controls);
    recorder.current = wanted
      ? startSessionRecording(wanted).catch((error) => {
          // The session still runs; the run is uploaded without a recording.
          console.warn('[tablet] Recording could not start', error);
          return null;
        })
      : null;
    setPhase({
      name: 'running',
      study: phase.study,
      media: phase.media,
      participantId,
      blocks: orderBlocks(phase.study.blocks, phase.study.randomized),
      startedAtIso: new Date().toISOString(),
    });
  };

  const runningMedia = phase.name === 'running' ? phase.media : null;
  const completeSession = useCallback(
    async (result: RunResult) => {
      if (runningMedia) releaseMedia(runningMedia);
      setPhase({ name: 'done', status: 'uploading' });
      let run = result;
      let fresh: { key: string; blob: Blob } | undefined;
      const session = await recorder.current;
      recorder.current = null;
      if (session) {
        try {
          const { blob, recording } = await session.stop();
          run = { ...result, recording };
          fresh = { key: runKey(run), blob };
          await saveRecording(fresh.key, blob);
        } catch (error) {
          console.warn('[tablet] Could not keep the recording on the tablet', error);
        }
      }
      setPendingRuns((current) => [...current, run]);
      const ok = await uploadRuns([run], fresh);
      setPhase({ name: 'done', status: ok ? 'saved' : 'queued' });
    },
    [runningMedia, setPendingRuns, uploadRuns]
  );

  const retryUploads = async () => {
    setPhase({ name: 'done', status: 'uploading' });
    const ok = await uploadRuns(pendingRuns);
    setPhase({ name: 'done', status: ok ? 'saved' : 'queued' });
  };

  return (
    <main className={styles.root}>
      <div className={styles.frame}>
        {phase.name === 'select' && (
          <StudySelectScreen
            studies={studies}
            loading={studiesLoading}
            error={studiesError}
            pendingUploads={pendingRuns.length}
            onSelect={selectStudy}
            onReload={loadStudies}
          />
        )}

        {phase.name === 'loading' && (
          <PreloadScreen
            studyName={phase.studyName}
            progress={progress}
            error={preloadError}
            onRetry={() => {
              setPreloadError(null);
              setProgress(EMPTY_PROGRESS);
              setPreloadAttempt((n) => n + 1);
            }}
            onCancel={backToStudies}
          />
        )}

        {phase.name === 'participant' && (
          <ParticipantIdScreen studyName={phase.study.name} onStart={startSession} onBack={backToStudies} />
        )}

        {phase.name === 'running' && (
          <>
            <StudySession
              study={phase.study}
              blocks={phase.blocks}
              participantId={phase.participantId}
              startedAtIso={phase.startedAtIso}
              media={phase.media}
              onComplete={completeSession}
            />
            <ResearcherExit pin={RESEARCHER_PIN} onExit={backToStudies} />
            {kiosk.lostFullscreen && (
              <button type="button" className={styles.resumeOverlay} onClick={() => kiosk.enter()}>
                <span className={tabletStyles.primaryButton}>Tap to continue</span>
              </button>
            )}
          </>
        )}

        {phase.name === 'done' && (
          <CompletionScreen status={phase.status} onRetry={retryUploads} onFinish={backToStudies} />
        )}
      </div>
    </main>
  );
}
