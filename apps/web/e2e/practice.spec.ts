import { expect, test } from '@playwright/test';

test('upgrades an anonymous practice connection before hosting multiplayer', async ({
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
  await expect(
    page.getByRole('region', { name: 'Your hand' }).locator('.art img').first(),
  ).toBeVisible();
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
  await page.getByRole('button', { name: 'New practice' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  // This socket connected anonymously for Practice. Guest creation must replace that
  // handshake before the protected lobby event, or the server returns AUTH_REQUIRED.
  await page.getByRole('button', { name: 'Host Game' }).click();
  await page.getByLabel('Display name').fill('Multiplayer Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Host a lobby' })).toBeVisible();
  await page.getByRole('button', { name: 'Create lobby' }).click();
  await expect(page.getByRole('heading', { name: /Code:/ })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave lobby' }).click();
  await expect(page.getByText('Playing as Multiplayer Ada')).toBeVisible();

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
    // Bot turns are authoritative and can advance while the geometry loop runs in parallel CI.
    // Keep enough tolerance for card/score content while still catching meaningful layout drift.
    maxDiffPixelRatio: 0.04,
    mask: [page.getByTestId('turn-timer')],
  });
});

test('keeps a ten-card table hand within a mobile viewport', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Practice' }).click();
    await page.getByLabel('Display name').fill('Ada');
    await page.getByLabel('Bot opponents').selectOption('3');
    await page.getByRole('button', { name: 'Start practice' }).click();
    const hand = page.getByRole('region', { name: 'Your hand' });
    await expect(hand.locator('[data-hand-card]')).toHaveCount(10);
    expect(
      await hand.evaluate(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          element.scrollHeight <= element.clientHeight,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    const geometry = await hand.locator('[data-hand-card]').evaluateAll((cards) =>
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          inside:
            box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
        };
      }),
    );
    expect(geometry.every((card) => card.width >= 24 && card.height >= 36 && card.inside)).toBe(
      true,
    );
    await expect(page.getByRole('region', { name: 'Table challenge' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    const overlap = await page.evaluate(() => {
      const challenge = document
        .querySelector<HTMLElement>('.challenge-card')!
        .getBoundingClientRect();
      const seats = [...document.querySelectorAll<HTMLElement>('.opponent-seat, .local-seat')].map(
        (el) => el.getBoundingClientRect(),
      );
      const exit = document.querySelector<HTMLElement>('.match-exit')!.getBoundingClientRect();
      const eyebrow = document
        .querySelector<HTMLElement>('.table-header .eyebrow')!
        .getBoundingClientRect();
      return {
        challengeReadable: challenge.width > 40 && challenge.height > 50,
        seatOverlap: seats.some(
          (seat) =>
            !(
              challenge.right < seat.left ||
              challenge.left > seat.right ||
              challenge.bottom < seat.top ||
              challenge.top > seat.bottom
            ),
        ),
        exitOverlap: !(
          exit.right < eyebrow.left ||
          exit.left > eyebrow.right ||
          exit.bottom < eyebrow.top ||
          exit.top > eyebrow.bottom
        ),
      };
    });
    expect(overlap).toEqual({ challengeReadable: true, seatOverlap: false, exitOverlap: false });
  }
});

test('serves contained local card artwork on desktop and mobile', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Practice' }).click();
    await page.getByLabel('Display name').fill('Art Ada');
    await page.getByLabel('Bot opponents').selectOption('1');
    await page.getByRole('button', { name: 'Start practice' }).click();
    const art = page.getByRole('region', { name: 'Your hand' }).locator('.art img').first();
    await expect(art).toBeVisible();
    await expect(art).toHaveAttribute('src', /\/cards\/.+\.png$/);
    expect(
      await art.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true);
    expect(
      await art.evaluate((image) => {
        const styles = getComputedStyle(image);
        return styles.objectFit === 'contain' && image.getBoundingClientRect().width > 0;
      }),
    ).toBe(true);
  }
});

test('contains a six-seat practice table on desktop and mobile', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Practice' }).click();
    await page.getByLabel('Display name').fill('Ada');
    await page.getByLabel('Bot opponents').selectOption('5');
    await page.getByRole('button', { name: 'Start practice' }).click();
    const table = page.getByRole('region', { name: 'Game table' });
    await expect(table.locator('.opponent-seat')).toHaveCount(5);
    expect(await table.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
