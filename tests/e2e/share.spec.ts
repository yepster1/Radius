import { expect, test } from '@playwright/test';

/**
 * The core brief requirement: a shared URL must render identically for
 * someone with no localStorage and no prior session.
 */
test('a shared report renders for a cold visitor', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: /address/i }).fill('1600 Pennsylvania Ave NW');
  await page.getByRole('option').first().click();
  await expect(page).toHaveURL(/\/a\/.+/);

  const sharedUrl = page.url();
  const heading = await page.getByRole('heading', { level: 1 }).textContent();
  const overall = await page.locator('main').getByText(/\/100/).textContent();

  // A brand-new context: no cookies, no localStorage, no history.
  const cold = await browser.newContext();
  const coldPage = await cold.newPage();
  await coldPage.goto(sharedUrl);

  await expect(coldPage.getByRole('heading', { level: 1 })).toHaveText(heading ?? '');
  await expect(coldPage.locator('main').getByText(/\/100/)).toHaveText(overall ?? '');

  await cold.close();
});

test('visited addresses appear in recent searches', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: /address/i }).fill('1600 Pennsylvania Ave NW');
  await page.getByRole('option').first().click();
  await expect(page).toHaveURL(/\/a\/.+/);

  // RecordVisit lives in the streamed report content and writes to
  // localStorage from a mount effect. The URL updates client-side before
  // that content has arrived, so navigating home immediately after the URL
  // assertion races past the write — deterministically, not flakily: it
  // failed on every run until this wait was added. Wait for the report to
  // actually render (same signal search.spec.ts's first test already uses)
  // before leaving the page.
  await expect(page.getByText('Location score')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('Recent')).toBeVisible();
});
