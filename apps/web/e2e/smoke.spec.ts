import { test, expect } from '@playwright/test';
test('shows TopThis landing shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TopThis/);
  await expect(
    page.getByRole('heading', { name: 'Everything beats something. Top this.' }),
  ).toBeVisible();
  await expect(page.getByText('The table is being dealt. Phase 0 is ready.')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
