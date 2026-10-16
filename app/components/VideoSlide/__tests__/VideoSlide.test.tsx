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
  it('reports the pressed side with the touch-down time', () => {
    const onButton = jest.fn();
    render(
      <VideoSlide src="/v.mp4" active display={display} controls={controls} response={null} onButton={onButton} />
    );
    const like = screen.getByRole('button', { name: 'Like' });
    fireEvent.pointerDown(like, { timeStamp: 1234 });
    fireEvent.click(like);
    expect(onButton).toHaveBeenCalledWith('Right', expect.any(Number));
    expect(screen.getByText('Dislike')).toBeInTheDocument();
  });

  it('locks both buttons once a response is recorded', () => {
    render(
      <VideoSlide src="/v.mp4" active display={display} controls={controls} response="Left" onButton={jest.fn()} />
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
