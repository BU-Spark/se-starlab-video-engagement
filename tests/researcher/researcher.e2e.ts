import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import process from 'node:process';

const fixture = (name: string) => path.join(process.cwd(), 'tests/researcher/fixtures', name);

async function addBlock(page: Page, type: 'Instructions' | 'Video' | 'Survey') {
  const choice = page.getByRole('button', { name: new RegExp('^' + type + ' ') });
  if (!(await choice.isVisible())) await page.getByRole('button', { name: 'Add block', exact: true }).click();
  await choice.click();
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/researcher/studies/new');
});

test('1. The real page opens and its settings can be edited', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create a study.');
  await expect(page.getByText('Frontend preview', { exact: true })).toBeVisible();
  await expect(page.getByText(/Saving is not connected yet/)).toBeVisible();
  const saves = page.getByRole('button', { name: 'Save study', exact: true });
  await expect(saves).toHaveCount(2);
  await expect(saves.nth(0)).toBeDisabled();
  await expect(saves.nth(1)).toBeDisabled();

  await page.getByLabel('Study name', { exact: false }).fill('Week 1 attention study');
  await expect(page.getByLabel('Study name', { exact: false })).toHaveValue('Week 1 attention study');
  await page.getByRole('button', { name: 'Videos only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Videos only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('switch', { name: 'Swipe back', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Swipe back', exact: true })).toHaveAttribute('aria-checked', 'true');

  await page.getByLabel('Left button icon', { exact: true }).setInputFiles(fixture('button-icon.svg'));
  const icon = page.getByAltText('Left button preview', { exact: true });
  await expect(icon).toBeVisible();
  await expect.poll(() => icon.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('2. Real clicks add, edit, reorder and delete blocks without losing content', async ({ page }) => {
  await addBlock(page, 'Instructions');
  await page.getByLabel('Instruction text', { exact: false }).fill('Watch the video, then answer the question.');
  await addBlock(page, 'Survey');
  await page.getByLabel('Survey question', { exact: false }).fill('Was the video engaging?');
  await page.getByRole('button', { name: 'Move block 2 up', exact: true }).click();
  await expect(page.getByRole('article').nth(0)).toHaveAttribute('aria-label', 'Block 1: Survey');
  await expect(page.getByLabel('Survey question', { exact: false })).toHaveValue('Was the video engaging?');
  await expect(page.getByLabel('Instruction text', { exact: false })).toHaveValue(
    'Watch the video, then answer the question.'
  );
  await expect(page.getByRole('button', { name: 'Move block 1 up', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move block 2 down', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Delete block 1', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete block 1', exact: true }).click();
  await page.getByRole('button', { name: 'Delete block', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByLabel('Instruction text', { exact: false })).toHaveValue(
    'Watch the video, then answer the question.'
  );
});

test('3. A local video really loads and plays in the browser', async ({ page }) => {
  await addBlock(page, 'Video');
  const input = page.getByLabel('Video file for block 1', { exact: true });
  await input.setInputFiles(fixture('not-a-video.txt'));
  await expect(page.getByText('Choose a non-empty video file.', { exact: true })).toBeVisible();

  await input.setInputFiles(fixture('stimulus.webm'));
  await expect(page.getByText('stimulus.webm', { exact: true })).toBeVisible();
  await expect(page.getByText(/Ready for local preview/)).toBeVisible();
  const video = page.getByLabel('Video preview for block 1', { exact: true });
  await video.evaluate(async (element) => {
    await (element as HTMLVideoElement).play();
  });
  await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
  await video.evaluate((element) => (element as HTMLVideoElement).pause());
  await expect(video).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Remove video', exact: true }).click();
  await expect(video).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(0);
});
