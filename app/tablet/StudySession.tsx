'use client';

import { useEffect, useRef, useState } from 'react';
import type { Block, RunResult, Study } from '@/app/types';
import { useBlockRunner } from '@/app/hooks';
import type { MediaMap } from '@/app/utils/preload/preloadStudy';
import { ReelsViewport } from '../components/ReelsViewport';
import { InstructionsSlide } from '../components/InstructionsSlide';
import { VideoSlide } from '../components/VideoSlide';
import { SurveySlide } from '../components/SurveySlide';

interface StudySessionProps {
  study: Study;
  /** Blocks already ordered/randomized for this participant */
  blocks: Block[];
  participantId: string;
  startedAtIso: string;
  media: MediaMap;
  onComplete: (run: RunResult) => void;
}

/** Runs one participant through every block and reports the RunResult when the last block is swiped away. */
export function StudySession({ study, blocks, participantId, startedAtIso, media, onComplete }: StudySessionProps) {
  const { state, start, next, previous, pressButton, chooseBubble, videoPlaying, pauseVideo, resumeVideo } =
    useBlockRunner(blocks);
  const reported = useRef(false);
  // Sound on/off carries over from one video to the next.
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (!state.finished || reported.current) return;
    reported.current = true;
    onComplete({
      studyId: study.id,
      studyName: study.name,
      participantId,
      startedAtIso,
      completedAtIso: new Date().toISOString(),
      blockOrder: blocks.map((b) => b.id),
      rows: state.rows,
    });
  }, [state.finished, state.rows, study, participantId, startedAtIso, blocks, onComplete]);

  const renderSlide = (block: Block, active: boolean) => {
    switch (block.type) {
      case 'instructions':
        return <InstructionsSlide block={block} />;
      case 'video':
        return (
          <VideoSlide
            src={media.get(block.videoUrl) ?? block.videoUrl}
            active={active}
            display={study.display}
            controls={study.controls}
            leftIconSrc={study.display.leftIcon && (media.get(study.display.leftIcon) ?? study.display.leftIcon)}
            rightIconSrc={study.display.rightIcon && (media.get(study.display.rightIcon) ?? study.display.rightIcon)}
            title={block.title}
            description={block.description}
            response={active ? (state.current?.likeDislike ?? null) : null}
            onButton={pressButton}
            onVideoStart={(at) => videoPlaying(block.id, at)}
            onPause={(at) => pauseVideo(block.id, at)}
            onResume={(at) => resumeVideo(block.id, at)}
            muted={muted}
            onMutedChange={setMuted}
            volume={volume}
            onVolumeChange={setVolume}
          />
        );
      case 'survey':
        return (
          <SurveySlide
            block={block}
            selected={active ? (state.current?.surveyAnswer ?? null) : null}
            onChoose={chooseBubble}
          />
        );
    }
  };

  return (
    <ReelsViewport
      items={blocks}
      index={state.index}
      renderSlide={renderSlide}
      onNext={next}
      onPrevious={previous}
      canGoBack={study.controls.swipeUp}
    />
  );
}
