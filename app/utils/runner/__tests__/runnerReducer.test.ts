import type { Block } from '@/app/types';
import { createRunnerState, runnerReducer, type RunnerAction, type RunnerState } from '../runnerReducer';

const blocks: Block[] = [
  { id: 'b1', type: 'instructions', label: 'instruction1', text: 'Hi' },
  { id: 'b2', type: 'video', label: 'video1', videoUrl: '/v.mp4', fileName: 'testvideo1.mp4' },
  { id: 'b3', type: 'survey', label: 'survey1', prompt: 'Q?', options: ['Agree', 'Neutral', 'Disagree'] },
];

const iso = '2026-10-16T00:00:00.000Z';
const run = (actions: RunnerAction[]): RunnerState => actions.reduce(runnerReducer, createRunnerState(blocks));

describe('runnerReducer', () => {
  it('records watch time for each block and finishes after the last one', () => {
    const state = run([
      { type: 'start', now: 1000, iso },
      { type: 'next', now: 3500, iso },
      { type: 'next', now: 9000, iso },
      { type: 'next', now: 12000, iso },
    ]);
    expect(state.finished).toBe(true);
    expect(state.rows.map((r) => [r.blockId, r.order, r.stimulus, r.watchTimeMs])).toEqual([
      ['b1', 1, 'instruction1', 2500],
      ['b2', 2, 'testvideo1.mp4', 5500],
      ['b3', 3, 'survey1', 3000],
    ]);
  });

  it('records only the first video button press', () => {
    const state = run([
      { type: 'start', now: 0, iso },
      { type: 'next', now: 1000, iso },
      { type: 'button', side: 'Left', now: 5200 },
      { type: 'button', side: 'Right', now: 6000 },
      { type: 'next', now: 7000, iso },
    ]);
    expect(state.rows[1]).toMatchObject({ buttonPress: 'Left', buttonTimeMs: 4200 });
  });

  it('lets survey answers switch but keeps the first-touch time', () => {
    const state = run([
      { type: 'start', now: 0, iso },
      { type: 'next', now: 0, iso },
      { type: 'next', now: 100, iso },
      { type: 'bubble', option: 'Agree', now: 1100 },
      { type: 'bubble', option: 'Neutral', now: 4000 },
      { type: 'next', now: 5000, iso },
    ]);
    expect(state.rows[2]).toMatchObject({ buttonPress: 'Neutral', buttonTimeMs: 1000, watchTimeMs: 4900 });
  });

  it('marks swipe-up rows and creates a new row for the return viewing', () => {
    const state = run([
      { type: 'start', now: 0, iso },
      { type: 'next', now: 1000, iso },
      { type: 'next', now: 2000, iso },
      { type: 'previous', now: 2500, iso },
      { type: 'next', now: 4000, iso },
    ]);
    expect(state.index).toBe(2);
    expect(state.rows.map((r) => [r.blockId, r.swipedUp, r.watchTimeMs])).toEqual([
      ['b1', 0, 1000],
      ['b2', 0, 1000],
      ['b3', 1, 500],
      ['b2', 0, 1500],
    ]);
  });

  it('ignores previous on the first block and actions after finishing', () => {
    let state = run([
      { type: 'start', now: 0, iso },
      { type: 'previous', now: 10, iso },
    ]);
    expect(state.rows).toHaveLength(0);
    const finishAll: RunnerAction[] = [
      { type: 'next', now: 1, iso },
      { type: 'next', now: 2, iso },
      { type: 'next', now: 3, iso },
    ];
    state = finishAll.reduce(runnerReducer, state);
    const finished = runnerReducer(state, { type: 'next', now: 99, iso });
    expect(finished).toBe(state);
  });

  it('does nothing before start', () => {
    const initial = createRunnerState(blocks);
    expect(runnerReducer(initial, { type: 'next', now: 5, iso })).toBe(initial);
  });
});
