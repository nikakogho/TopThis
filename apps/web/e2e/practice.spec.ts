import { expect, test } from '@playwright/test';

test('completes a deterministic server-authoritative practice match', async ({
  page,
}, testInfo) => {
  const consoleLines: string[] = [];
  page.on('console', (message) => consoleLines.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => consoleLines.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await expect(page).toHaveTitle(/TopThis/);
  await expect(
    page.getByRole('heading', { name: 'Everything beats something. Top this.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Practice' }).click();
  await page.getByLabel('Display name').fill('Ada');
  await page.getByLabel('Bot opponents').selectOption('1');
  await page.getByRole('button', { name: 'Start practice' }).click();

  await expect(page.getByText('Your turn', { exact: true })).toBeVisible();
  const opponents = page.getByRole('region', { name: 'Opponents' });
  await expect(opponents).toContainText('Bot 1');
  await expect(opponents).toContainText('10 cards in hand');
  await expect(opponents.locator('img')).toHaveCount(0);
  await expect(page.locator('.fallback-symbol').first()).toBeVisible();
  const hand = page.getByRole('region', { name: 'Your hand' });
  await expect(hand.locator('[data-hand-card]')).toHaveCount(10);
  const handGeometry = await hand.evaluate((element) => {
    const cards = [...element.querySelectorAll<HTMLElement>('[data-hand-card]')];
    const rows = new Map<number, number>();
    for (const card of cards) {
      const top = Math.round(card.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    return {
      fits: element.scrollWidth <= element.clientWidth,
      rowCounts: [...rows.values()],
    };
  });
  expect(handGeometry).toEqual({ fits: true, rowCounts: [5, 5] });

  const playable = page.getByRole('button', { name: /Playable/ }).first();
  await playable.click();
  await expect(playable).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Selected:/)).toBeVisible();
  await page.getByRole('button', { name: 'Play Card' }).click();

  await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('ROUND RESULT')).toBeVisible();
  await expect(dialog).toContainText('Bot 1 takes the pile');
  await expect(dialog.getByText('3 cards captured.')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: 'New practice' })).toBeVisible();

  if (
    testInfo.status !== testInfo.expectedStatus ||
    consoleLines.some((line) => line.startsWith('pageerror:'))
  ) {
    await testInfo.attach('browser-console.txt', {
      body: Buffer.from(consoleLines.join('\n')),
      contentType: 'text/plain',
    });
  }
});

test('seats two-, three-, and four-player games around one table', async ({ page }) => {
  for (const bots of [1, 2, 3]) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Practice' }).click();
    await page.getByLabel('Display name').fill('Ada');
    await page.getByLabel('Bot opponents').selectOption(String(bots));
    await page.getByRole('button', { name: 'Start practice' }).click();

    const table = page.getByRole('region', { name: 'Game table' });
    const opponentSeats = table.locator('.opponent-seat');
    const localSeat = table.locator('.local-seat');
    await expect(opponentSeats).toHaveCount(bots);
    await expect(localSeat).toBeVisible();
    await expect(table.getByRole('region', { name: 'Table challenge' })).toBeVisible();
    await expect(table.locator('.score-badge')).toHaveCount(bots + 1);
    const geometry = await table.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const local = element.querySelector<HTMLElement>('.local-seat')!.getBoundingClientRect();
      const opponents = [...element.querySelectorAll<HTMLElement>('.opponent-seat')].map((seat) =>
        seat.getBoundingClientRect(),
      );
      return {
        contained: [local, ...opponents].every(
          (seat) => seat.left >= bounds.left && seat.right <= bounds.right,
        ),
        localBelowOpponents: opponents.every((seat) => local.top > seat.top),
      };
    });
    expect(geometry).toEqual({ contained: true, localBelowOpponents: true });
  }

  await expect(page.locator('body')).toHaveScreenshot('practice-table.png', {
    animations: 'disabled',
    maxDiffPixels: 20,
    mask: [page.getByTestId('turn-timer')],
  });
});

test('keeps a ten-card table hand within a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice' }).click();
  await page.getByLabel('Display name').fill('Ada');
  await page.getByLabel('Bot opponents').selectOption('3');
  await page.getByRole('button', { name: 'Start practice' }).click();
  const hand = page.getByRole('region', { name: 'Your hand' });
  await expect(hand.locator('[data-hand-card]')).toHaveCount(10);
  expect(await hand.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
