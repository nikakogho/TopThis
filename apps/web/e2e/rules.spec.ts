import { expect, test } from '@playwright/test';

test('opens rules and remains contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const rules = page.getByRole('button', { name: 'How to Play' });
  await expect(rules).toBeVisible();
  await rules.focus();
  await expect(rules).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Top this.' })).toBeFocused();
  await expect(page.getByText('HOW TO PLAY', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Objective' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeFocused();
});
