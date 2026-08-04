import { expect, test } from '@playwright/test';

// Queries must disambiguate the way a real user's would. "1600 Pennsylvania
// Ave" without the "NW" ranks Lorain, Ohio first — correct geocoder behaviour
// for an ambiguous string, but it would send these tests to the wrong city.
test('search an address and read its report', async ({ page }) => {
  await page.goto('/');

  const input = page.getByRole('combobox', { name: /address/i });
  await input.fill('1600 Pennsylvania Ave NW');

  const option = page.getByRole('option').first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page).toHaveURL(/\/a\/.+-[0-9a-z]{7}$/);
  await expect(page.getByText('Location score')).toBeVisible();

  // Four scores, each with an accessible meter.
  await expect(page.getByRole('meter')).toHaveCount(5); // 4 tiles + urban/suburban
});

test('keyboard-only users can complete the flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: /address/i }).fill('350 5th Ave New York');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/a\/.+/);
});

test('an invalid slug shows the not-found page', async ({ page }) => {
  await page.goto('/a/not-a-real-address');
  await expect(page.getByText(/address not found/i)).toBeVisible();
});
