import { render, screen, fireEvent, act } from '@testing-library/react';
import type { RunResult, Study } from '@/app/types';
import { StudySession } from '../StudySession';

const study: Study = {
  id: 'demo',
  name: 'Demo',
  randomized: false,
  display: { videoBar: true, leftText: 'Dislike', rightText: 'Like' },
  controls: {
    swipeUp: true,
    responseButtons: true,
    responseButtonsPressable: true,
    pausing: true,
    audioRecord: false,
    cameraRecord: false,
  },
  blocks: [
    { id: 'b1', type: 'instructions', label: 'instruction1', text: 'Welcome' },
    { id: 'b2', type: 'video', label: 'video1', videoUrl: '/v1.mp4', fileName: 'v1.mp4' },
    { id: 'b3', type: 'survey', label: 'survey1', prompt: 'Enjoy?', options: ['Yes', 'No'] },
  ],
};

beforeAll(() => {
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

// Arrow keys drive the same next/previous path as swipes.
const next = () => act(() => void fireEvent.keyDown(window, { key: 'ArrowDown' }));
const back = () => act(() => void fireEvent.keyDown(window, { key: 'ArrowUp' }));

describe('StudySession', () => {
  it('walks every block and reports one row per viewing', () => {
    const onComplete = jest.fn<void, [RunResult]>();
    render(
      <StudySession
        study={study}
        blocks={study.blocks}
        participantId="P1"
        startedAtIso="2026-10-16T00:00:00.000Z"
        media={new Map([['/v1.mp4', 'blob:v1']])}
        onComplete={onComplete}
      />
    );

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    next();
    back(); // swipe up returns to the video: a new row for the re-view
    next();
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    next();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const run = onComplete.mock.calls[0][0];
    expect(run.participantId).toBe('P1');
    expect(run.blockOrder).toEqual(['b1', 'b2', 'b3']);
    expect(run.rows.map((r) => [r.blockId, r.swipedUp, r.buttonPress])).toEqual([
      ['b1', 0, null],
      ['b2', 0, 'Right'],
      ['b3', 1, null],
      ['b2', 0, null],
      ['b3', 0, 'No'],
    ]);
    expect(run.rows.every((r) => r.watchTimeMs >= 0)).toBe(true);
  });

  it('uses the preloaded blob URL for videos', () => {
    const { container } = render(
      <StudySession
        study={study}
        blocks={study.blocks}
        participantId="P1"
        startedAtIso=""
        media={new Map([['/v1.mp4', 'blob:v1']])}
        onComplete={jest.fn()}
      />
    );
    expect(container.querySelector('video')).toHaveAttribute('src', 'blob:v1');
  });
});
