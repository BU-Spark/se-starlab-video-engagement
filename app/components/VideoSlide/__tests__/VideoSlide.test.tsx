import { render, screen, fireEvent } from '@testing-library/react';
import type { StudyControlSettings, StudyDisplaySettings } from '@/app/types';
import { VideoSlide } from '../VideoSlide';

const display: StudyDisplaySettings = { videoBar: true, leftText: 'Dislike', rightText: 'Like' };
const controls: StudyControlSettings = {
  swipeUp: true,
  responseButtons: true,
  responseButtonsPressable: true,
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

  it('shows like/dislike but makes them unpressable unless the study allows it', () => {
    const onButton = jest.fn();
    const { container } = render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={{ ...controls, responseButtonsPressable: undefined }}
        response={null}
        onButton={onButton}
      />
    );
    expect(screen.queryByRole('button', { name: 'Like' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-side]')).toHaveLength(2);
    fireEvent.click(container.querySelector('[data-side="Right"]')!);
    expect(onButton).not.toHaveBeenCalled();
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

  it('shows only the side buttons the study turns on', () => {
    const { container } = render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={{ ...controls, responseButtons: false, commentButton: true, shareButton: true }}
        response={null}
        onButton={jest.fn()}
      />
    );
    const shown = [...container.querySelectorAll('[data-action]')].map((el) => el.getAttribute('data-action'));
    expect(shown).toEqual(['comment', 'share']);
  });

  it('opens the share sheet and reports the tap and the choice, keeping the video playing', () => {
    const onShareOpen = jest.fn();
    const onShareChoice = jest.fn();
    const pause = HTMLMediaElement.prototype.pause as jest.Mock;
    render(
      <VideoSlide
        src="/v.mp4"
        active
        display={{ ...display, shareOptions: ['Copy link', 'Email'] }}
        controls={{ ...controls, shareButton: true }}
        response={null}
        onButton={jest.fn()}
        onShareOpen={onShareOpen}
        onShareChoice={onShareChoice}
      />
    );
    pause.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(onShareOpen).toHaveBeenCalledWith(expect.any(Number));
    expect(pause).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Email/ }));
    expect(onShareChoice).toHaveBeenCalledWith('Email');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pauses while sharing when the study asks for it', () => {
    const pause = HTMLMediaElement.prototype.pause as jest.Mock;
    render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={{ ...controls, shareButton: true, pauseOnShare: true }}
        response={null}
        onButton={jest.fn()}
      />
    );
    pause.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Copy link/ })).toBeInTheDocument();
  });

  it('opens the comments panel with the video comments and reports the tap', () => {
    const onCommentOpen = jest.fn();
    render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={{ ...controls, commentButton: true }}
        comments={[{ author: 'sam', text: 'Nice one' }]}
        response={null}
        onButton={jest.fn()}
        onCommentOpen={onCommentOpen}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));
    expect(onCommentOpen).toHaveBeenCalledWith(expect.any(Number));
    expect(screen.getByText('Nice one')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reports save taps and shows the saved state it is given', () => {
    const onSave = jest.fn();
    render(
      <VideoSlide
        src="/v.mp4"
        active
        display={display}
        controls={{ ...controls, saveButton: true }}
        saved
        response={null}
        onButton={jest.fn()}
        onSave={onSave}
      />
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
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
