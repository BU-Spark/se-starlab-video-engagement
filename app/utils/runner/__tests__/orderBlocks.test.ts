import type { Block } from '@/app/types';
import { orderBlocks } from '../orderBlocks';

const instr = (id: string, randomGroup?: string): Block => ({
  id,
  type: 'instructions',
  label: id,
  text: id,
  randomGroup,
});

// Deterministic "random" source so shuffles are reproducible.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('orderBlocks', () => {
  const blocks = [instr('a'), instr('b', 'g'), instr('c'), instr('d', 'g'), instr('e', 'g'), instr('f')];

  it('keeps the researcher order when nothing is randomized', () => {
    const plain = [instr('a'), instr('b'), instr('c')];
    expect(orderBlocks(plain, false).map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('only shuffles blocks inside a random group, keeping other positions fixed', () => {
    for (let seed = 1; seed < 20; seed++) {
      const ids = orderBlocks(blocks, false, seeded(seed)).map((b) => b.id);
      expect([ids[0], ids[2], ids[5]]).toEqual(['a', 'c', 'f']);
      expect([ids[1], ids[3], ids[4]].sort()).toEqual(['b', 'd', 'e']);
    }
  });

  it('actually produces different group orders across seeds', () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) =>
        orderBlocks(blocks, false, seeded(i + 1))
          .map((b) => b.id)
          .join('')
      )
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('shuffles every block when randomized is on, without losing any', () => {
    const ids = orderBlocks(blocks, true, seeded(7)).map((b) => b.id);
    expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('does not mutate the input array', () => {
    const copy = [...blocks];
    orderBlocks(blocks, true, seeded(3));
    expect(blocks).toEqual(copy);
  });
});
