import { fireEvent, render } from '@testing-library/react';
import useWheelStep, { type WheelStep } from '../useWheelStep';

function Harness({ onStep }: { onStep: (step: WheelStep, timeStamp: number) => void }) {
  const onWheel = useWheelStep(onStep);
  return <div data-testid="target" onWheel={onWheel} />;
}

// Times start above 0 because React replaces a timeStamp of 0 with Date.now().
const wheel = (el: HTMLElement, deltaY: number, timeStamp: number) => {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  fireEvent(el, event);
};

describe('useWheelStep', () => {
  it('steps once per gesture, ignoring trailing inertia', () => {
    const onStep = jest.fn();
    const { getByTestId } = render(<Harness onStep={onStep} />);
    const target = getByTestId('target');
    wheel(target, 30, 1000);
    wheel(target, 30, 1020);
    wheel(target, 30, 1040);
    wheel(target, 10, 1200);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith('next', 1020);
  });

  it('steps again after a pause, in the scrolled direction', () => {
    const onStep = jest.fn();
    const { getByTestId } = render(<Harness onStep={onStep} />);
    const target = getByTestId('target');
    wheel(target, 100, 1000);
    wheel(target, -100, 2000);
    expect(onStep.mock.calls.map(([step]) => step)).toEqual(['next', 'previous']);
  });

  it('steps again when a new swipe starts while inertia is still running', () => {
    const onStep = jest.fn();
    const { getByTestId } = render(<Harness onStep={onStep} />);
    const target = getByTestId('target');
    // Swipe, then decaying inertia with no quiet gap...
    [60, 50, 35, 25, 15, 10, 6].forEach((d, i) => wheel(target, d, 1000 + i * 70));
    // ...then the fingers swipe again before the inertia has stopped.
    wheel(target, 40, 1500);
    wheel(target, 60, 1520);
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('does not step twice from one swipe with uneven inertia', () => {
    const onStep = jest.fn();
    const { getByTestId } = render(<Harness onStep={onStep} />);
    const target = getByTestId('target');
    [60, 55, 58, 40, 41, 30, 20].forEach((d, i) => wheel(target, d, 1000 + i * 70));
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('ignores small scrolls', () => {
    const onStep = jest.fn();
    const { getByTestId } = render(<Harness onStep={onStep} />);
    wheel(getByTestId('target'), 10, 0);
    expect(onStep).not.toHaveBeenCalled();
  });
});
