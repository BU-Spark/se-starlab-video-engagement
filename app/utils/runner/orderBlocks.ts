/**
 * app/utils/runner/orderBlocks.ts
 *
 * Decides the order a participant sees the blocks in.
 * - randomized: every block is shuffled.
 * - otherwise: blocks that share a randomGroup are shuffled among the positions that group
 *   occupies, and every other block stays where the researcher put it.
 */

import type { Block } from '@/app/types';

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function orderBlocks(blocks: Block[], randomized: boolean, random: () => number = Math.random): Block[] {
  if (randomized) {
    return shuffle(blocks, random);
  }

  const positionsByGroup = new Map<string, number[]>();
  blocks.forEach((block, index) => {
    if (block.randomGroup) {
      const positions = positionsByGroup.get(block.randomGroup) ?? [];
      positions.push(index);
      positionsByGroup.set(block.randomGroup, positions);
    }
  });

  const result = [...blocks];
  positionsByGroup.forEach((positions) => {
    const shuffled = shuffle(
      positions.map((p) => blocks[p]),
      random
    );
    positions.forEach((p, i) => {
      result[p] = shuffled[i];
    });
  });
  return result;
}
