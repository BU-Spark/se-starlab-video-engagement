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
    expect(screen.queryByRole('button', { name: 'Like' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dislike' })).not.toBeInTheDocument();
  });

  it('shows only pause, sound, like and dislike: no comment, share or save buttons', () => {
    render(
      <VideoSlide src="/v.mp4" active display={display} controls={controls} response={null} onButton={jest.fn()} />
    );
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Pause',
      'Mute',
      'Like',
      'Dislike',
    ]);
  });

  it('hides the pause button when the study turns pausing off', () => {
    render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={{ ...controls, pausing: false }}
        response={null}
        onButton={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });

  it('pauses from the pause button and toggles the sound', () => {
    const onPause = jest.fn();
    const onMutedChange = jest.fn();
    const { container, rerender } = render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={controls}
        response={null}
        onButton={jest.fn()}
        onPause={onPause}
        muted={false}
        onMutedChange={onMutedChange}
      />
    );
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'paused', { get: () => false });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(onMutedChange).toHaveBeenCalledWith(true);
    rerender(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={controls}
        response={null}
        onButton={jest.fn()}
        muted
        onMutedChange={onMutedChange}
      />
    );
    expect(video.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
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

  it('jumps to the clicked point of the progress bar without pausing', () => {
    const onPause = jest.fn();
    const { container } = render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={controls}
        response={null}
        onButton={jest.fn()}
        onPause={onPause}
      />
    );
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { value: 20 });
    const bar = screen.getByRole('slider', { name: 'Video position' });
    bar.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;

    // jsdom has no PointerEvent, so send mouse events under the pointer event names.
    const pointer = (type: string, clientX = 0) =>
      fireEvent(bar, new MouseEvent(type, { bubbles: true, cancelable: true, clientX }));

    pointer('pointerdown', 150);
    expect(video.currentTime).toBe(5);
    pointer('pointermove', 250);
    expect(video.currentTime).toBe(15);
    pointer('pointerup');
    pointer('pointermove', 120); // no longer dragging
    expect(video.currentTime).toBe(15);
    fireEvent.click(bar);
    expect(onPause).not.toHaveBeenCalled();
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
