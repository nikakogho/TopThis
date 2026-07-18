import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function identity(page: Page, action: 'Host Game' | 'Join Game', name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: action }).click();
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function ready(page: Page) {
  await page.getByRole('button', { name: /Ready up|Not ready/ }).click();
}

test('three guests host, join, start, time out, reconnect, and complete privately', async ({
  browser,
}, testInfo) => {
  test.setTimeout(70_000);
  const contexts: BrowserContext[] = [];
  const make = async () => {
    const context = await browser.newContext();
    contexts.push(context);
    return context.newPage();
  };
  const host = await make();
  const two = await make();
  const three = await make();
  const consoleLines: string[] = [];
  for (const page of [host, two, three]) {
    page.on('console', (message) =>
      consoleLines.push(`${page.url()} ${message.type()}: ${message.text()}`),
    );
    page.on('pageerror', (error) => consoleLines.push(`${page.url()} pageerror: ${error.message}`));
  }
  try {
    await identity(host, 'Host Game', 'Ada');
    await host.getByLabel('Players').first().selectOption('3');
    await host.getByRole('button', { name: 'Create lobby' }).click();
    const code = (await host.getByRole('heading', { name: /Code:/ }).textContent())!.replace(
      'Code: ',
      '',
    );
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    await identity(two, 'Join Game', 'Bea');
    await two.getByLabel('Join code').fill(code);
    await two.getByRole('button', { name: 'Join lobby' }).click();
    await identity(three, 'Join Game', 'Cy');
    await three.getByLabel('Join code').fill(code);
    await three.getByRole('button', { name: 'Join lobby' }).click();

    await expect(host.getByRole('button', { name: 'Start Match' })).toBeDisabled();
    await ready(host);
    await ready(two);
    await ready(three);
    await expect(host.getByRole('button', { name: 'Start Match' })).toBeEnabled();
    await host.getByRole('button', { name: 'Start Match' }).click();
    for (const page of [host, two, three]) await expect(page.getByText('TOP THIS')).toBeVisible();

    const hostCards = await host
      .locator('[data-hand-card]')
      .evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')));
    const twoCards = await two
      .locator('[data-hand-card]')
      .evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')));
    expect(hostCards).toHaveLength(10);
    expect(twoCards).toHaveLength(10);
    // Only the local hand is rendered; the opponent region is count-only.
    await expect(host.getByRole('region', { name: 'Opponents' })).not.toContainText(
      hostCards[0]!.split('.')[0]!,
    );

    const pages = [host, two, three];
    const actor = await (async () => {
      for (const page of pages)
        if (
          await page
            .getByText('Your turn', { exact: true })
            .isVisible()
            .catch(() => false)
        )
          return page;
      throw new Error('No current private player');
    })();
    const playable = actor.getByRole('button', { name: /Playable/ }).first();
    const actorHandCount = await actor.locator('[data-hand-card]').count();
    if (await playable.count()) {
      await playable.click();
      await actor.getByRole('button', { name: 'Play Card' }).click();
      await expect(actor.locator('[data-hand-card]')).toHaveCount(actorHandCount - 1);
    } else {
      await actor.getByRole('button', { name: 'Skip' }).click();
      await expect(actor.getByRole('button', { name: 'Skip' })).toBeDisabled();
    }

    const savedHand = await two
      .locator('[data-hand-card]')
      .evaluateAll((cards) => cards.map((c) => c.getAttribute('data-card-instance-id')));
    await two.reload();
    await expect(two.getByText('TOP THIS')).toBeVisible();
    await expect
      .poll(async () =>
        two
          .locator('[data-hand-card]')
          .evaluateAll((cards) => cards.map((c) => c.getAttribute('data-card-instance-id'))),
      )
      .toEqual(savedHand);

    // Deliberately let the next authoritative turn expire. A different client must observe the
    // new owner/round state, proving the timeout is server-driven rather than local UI state.
    const beforeTimeout = await (async () => {
      const turns = await Promise.all(
        pages.map((page) =>
          page
            .getByText('Your turn', { exact: true })
            .isVisible()
            .catch(() => false),
        ),
      );
      return turns.findIndex(Boolean);
    })();
    expect(beforeTimeout).toBeGreaterThanOrEqual(0);
    await expect
      .poll(
        async () => {
          const turns = await Promise.all(
            pages.map((page) =>
              page
                .getByText('Your turn', { exact: true })
                .isVisible()
                .catch(() => false),
            ),
          );
          return turns.findIndex(Boolean);
        },
        { timeout: 8_000 },
      )
      .not.toBe(beforeTimeout);

    // With the test server's target score of three, repeated real Skip commands complete three
    // rounds. The loop chooses only the page currently enabled by the recipient-safe state.
    for (let actions = 0; actions < 18;) {
      if (
        (await host
          .getByRole('dialog')
          .isVisible()
          .catch(() => false)) &&
        (await host
          .getByText('MATCH RESULT')
          .isVisible()
          .catch(() => false))
      )
        break;
      const current = await (async () => {
        for (const page of pages)
          if (
            await page
              .getByRole('button', { name: 'Skip' })
              .isEnabled()
              .catch(() => false)
          )
            return page;
        return undefined;
      })();
      if (current) {
        const skip = current.getByRole('button', { name: 'Skip' });
        await skip.click();
        // Do not race a second click against the Socket.IO acknowledgement. The next
        // authoritative recipient view disables this player's control.
        await expect(skip).toBeDisabled({ timeout: 2_000 });
        actions += 1;
      } else await host.waitForTimeout(100);
    }
    for (const page of pages) {
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('MATCH RESULT')).toBeVisible({ timeout: 10_000 });
      await expect(dialog).toContainText(/Final place: [1-3] of 3/);
    }
  } finally {
    if (
      testInfo.status !== testInfo.expectedStatus ||
      consoleLines.some((line) => line.includes('pageerror:'))
    )
      await testInfo.attach('browser-console.txt', {
        body: Buffer.from(consoleLines.join('\n')),
        contentType: 'text/plain',
      });
    await Promise.all(contexts.map((context) => context.close()));
  }
});
