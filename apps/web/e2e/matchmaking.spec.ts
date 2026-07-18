import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function queue(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Find Match' }).click();
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('two guests match, complete through the rendered table, and retain leaderboard ratings', async ({
  browser,
}, testInfo) => {
  test.setTimeout(70_000);
  const contexts: BrowserContext[] = [];
  const consoleLines: string[] = [];
  const make = async () => {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    page.on('console', (message) =>
      consoleLines.push(`${page.url()} ${message.type()}: ${message.text()}`),
    );
    page.on('pageerror', (error) => consoleLines.push(`${page.url()} pageerror: ${error.message}`));
    return page;
  };
  try {
    const one = await make();
    const two = await make();
    await queue(one, 'Match Ada');
    await expect(one.getByRole('heading', { name: 'Finding your match' })).toBeVisible();
    await expect(one.getByText(/Position 1 .* 1 more player needed/)).toBeVisible();

    const oneTable = expect(one.getByText('TOPTHIS / MATCHMAKING'));
    const twoTable = expect(two.getByText('TOPTHIS / MATCHMAKING'));
    await queue(two, 'Match Bea');
    await oneTable.toBeVisible();
    await twoTable.toBeVisible();

    const oneCards = await one
      .locator('[data-hand-card]')
      .evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')));
    const twoCards = await two
      .locator('[data-hand-card]')
      .evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')));
    expect(oneCards).toHaveLength(10);
    expect(twoCards).toHaveLength(10);
    expect(oneCards).not.toEqual(twoCards);
    await expect(one.getByRole('region', { name: 'Opponents' })).toContainText('10 cards in hand');
    await expect(one.getByRole('region', { name: 'Opponents' })).not.toContainText(
      oneCards[0]!.split('.')[0]!,
    );

    const pages = [one, two];
    // Assert both UI control states, then use the normal select/confirm path once.
    await expect
      .poll(async () =>
        (
          await Promise.all(
            pages.map((page) =>
              page
                .getByText('Your turn', { exact: true })
                .isVisible()
                .catch(() => false),
            ),
          )
        ).some(Boolean),
      )
      .toBe(true);
    const turnPage = (
      await Promise.all(
        pages.map((page) =>
          page
            .getByText('Your turn', { exact: true })
            .isVisible()
            .catch(() => false),
        ),
      )
    ).findIndex(Boolean);
    const initialActor = pages[turnPage]!;
    await expect(initialActor.getByRole('button', { name: /Playable/ }).first()).toBeEnabled();
    const illegal = initialActor.getByRole('button', { name: /Cannot beat current card/ }).first();
    if (await illegal.count()) await expect(illegal).toBeDisabled();
    const initialHandCount = await initialActor.locator('[data-hand-card]').count();
    await initialActor
      .getByRole('button', { name: /Playable/ })
      .first()
      .click();
    await initialActor.getByRole('button', { name: 'Play Card' }).click();
    await expect(initialActor.locator('[data-hand-card]')).toHaveCount(initialHandCount - 1);

    for (let actions = 0; actions < 20;) {
      if (
        await one
          .getByText('MATCH RESULT')
          .isVisible()
          .catch(() => false)
      )
        break;
      const active = await (async () => {
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
      if (active) {
        const skip = active.getByRole('button', { name: 'Skip' });
        // The authoritative five-second timer can expire between the enabled-state probe and
        // the click. Keep that expected race bounded and retry against the newly active client.
        const clicked = await skip
          .click({ timeout: 1_000 })
          .then(() => true)
          .catch(() => false);
        if (clicked) {
          await expect(skip).toBeDisabled({ timeout: 2_000 });
          actions++;
        }
      } else await one.waitForTimeout(75);
    }
    for (const page of pages) {
      const result = page.getByRole('dialog');
      await expect(result.getByText('MATCH RESULT')).toBeVisible({ timeout: 10_000 });
      await expect(result).toContainText('Final place:');
    }

    // Before explicitly leaving, the authenticated socket can reclaim its completed result.
    await one.reload();
    await expect(one.getByText('MATCH RESULT')).toBeVisible();
    await one.getByRole('button', { name: 'Return home' }).click();
    await expect(one.getByText('Playing as Match Ada')).toBeVisible();

    // match:leave releases completed ownership, so the same profile can immediately begin
    // another protected server session instead of receiving ALREADY_ACTIVE.
    await one.getByRole('button', { name: 'Host Game' }).click();
    await expect(one.getByRole('heading', { name: 'Host a lobby' })).toBeVisible();
    await one.getByRole('button', { name: 'Create lobby' }).click();
    await expect(one.getByRole('heading', { name: /Code:/ })).toBeVisible();
    await one.getByRole('button', { name: 'Leave lobby' }).click();

    await one.getByRole('button', { name: 'Leaderboard' }).click();
    const ratings = one.locator('table tbody tr').filter({ hasText: /Match (Ada|Bea)/ });
    await expect(ratings).toHaveCount(2);
    const parsed = await ratings.evaluateAll((rows) =>
      rows.map((row) => {
        const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? '');
        return { rating: Number(cells[2]), games: Number(cells[3]), record: cells[4] };
      }),
    );
    expect(parsed.map((entry) => entry.games)).toEqual([1, 1]);
    expect(parsed.map((entry) => entry.rating)).not.toContain(1000);
    expect(parsed.reduce((sum, entry) => sum + entry.rating, 0)).toBe(2000);
    expect(parsed[0]!.rating).toBeGreaterThan(parsed[1]!.rating);
    expect(parsed.map((entry) => entry.record).sort()).toEqual(['0-1-0', '1-0-0']);
    await one.reload();
    await expect(
      one.getByRole('heading', { name: 'Everything beats something. Top this.' }),
    ).toBeVisible();
    await expect(one.getByText('MATCH RESULT')).toHaveCount(0);
    await one.getByRole('button', { name: 'Leaderboard' }).click();
    await expect(one.locator('table tbody tr').filter({ hasText: /Match (Ada|Bea)/ })).toHaveCount(
      2,
    );
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
