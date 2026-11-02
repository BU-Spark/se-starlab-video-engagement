import { render, screen, fireEvent } from '@testing-library/react';
import type { StudyControlSettings, StudyDisplaySettings } from '@/app/types';
import { VideoSlide } from '../VideoSlide';

const display: StudyDisplaySettings = { videoBar: true, leftText: 'Dislike', rightText: 'Like' };
const controls: StudyControlSettings = {
  swipeUp: true,
  responseButtons: true,
  pausing: true,
  audioRecord: false,
  cameraRecord: false,
};

beforeAll(() => {
  // jsdom does not implement media playback.
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

describe('VideoSlide', () => {
  it('reports playback start, and pauses and resumes from participant taps only', () => {
    const onVideoStart = jest.fn();
    const onPause = jest.fn();
    const onResume = jest.fn();
    const { container } = render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={controls}
        response={null}
        onButton={jest.fn()}
        onVideoStart={onVideoStart}
        onPause={onPause}
        onResume={onResume}
      />
    );
    const video = container.querySelector('video')!;
    let paused = false;
    Object.defineProperty(video, 'paused', { get: () => paused });

    fireEvent(video, new Event('playing'));
    expect(onVideoStart).toHaveBeenCalledTimes(1);

    // A play event that is not a resume from the participant's pause (e.g. a panel closing) is not counted.
    fireEvent.play(video);
    expect(onResume).not.toHaveBeenCalled();

    fireEvent.click(video); // tap while playing: pause
    expect(onPause).toHaveBeenCalledTimes(1);
    paused = true;
    fireEvent.click(video); // tap while paused: play, reported by the play event
    fireEvent.play(video);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('reports the pressed side with the touch-down time', () => {
    const onButton = jest.fn();
    render(
      <VideoSlide src="/v.mp4" active display={display} controls={controls} response={null} onButton={onButton} />
    );
    const like = screen.getByRole('button', { name: 'Like' });
    fireEvent.pointerDown(like, { timeStamp: 1234 });
    fireEvent.click(like);
    expect(onButton).toHaveBeenCalledWith('Like', expect.any(Number));
    expect(screen.getByText('Dislike')).toBeInTheDocument();
  });

  it('locks both buttons once a response is recorded', () => {
    render(
      <VideoSlide src="/v.mp4" active display={display} controls={controls} response="Dislike" onButton={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Dislike' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Like' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dislike' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides the buttons when the study turns them off', () => {
    render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={{ ...controls, responseButtons: false }}
        response={null}
        onButton={jest.fn()}
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows only the like and dislike buttons: no comment, share or save buttons', () => {
    render(
      <VideoSlide src="/v.mp4" active display={display} controls={controls} response={null} onButton={jest.fn()} />
    );
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Like',
      'Dislike',
    ]);
  });

  it('shows the title and description when set', () => {
    render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={controls}
        title="My video"
        description="Some details"
        response={null}
        onButton={jest.fn()}
      />
    );
    expect(screen.getByText('My video')).toBeInTheDocument();
    expect(screen.getByText('Some details')).toBeInTheDocument();
  });

  it('renders no caption when the title and description are blank', () => {
    const { container } = render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={controls}
        title="  "
        response={null}
        onButton={jest.fn()}
      />
    );
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('plays when active and pauses when inactive', () => {
    const play = HTMLMediaElement.prototype.play as jest.Mock;
    const pause = HTMLMediaElement.prototype.pause as jest.Mock;
    play.mockClear();
    pause.mockClear();
    const { rerender } = render(
      <VideoSlide src="/v.mp4" active display={display} controls={controls} response={null} onButton={jest.fn()} />
    );
    expect(play).toHaveBeenCalled();
    rerender(
      <VideoSlide
        src="/v.mp4"
        active={false}
        display={display}
        controls={controls}
        response={null}
        onButton={jest.fn()}
      />
    );
    expect(pause).toHaveBeenCalled();
  });
});
