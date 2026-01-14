import { test, expect } from '@playwright/test';
import path from 'path';

test('login, upload csv, group keywords, and verify grouped view', async ({ page }) => {
  test.skip(
    !process.env.E2E_USERNAME || !process.env.E2E_PASSWORD,
    'E2E_USERNAME and E2E_PASSWORD must be set to run this test.',
  );

  const username = process.env.E2E_USERNAME ?? '';
  const password = process.env.E2E_PASSWORD ?? '';
  const projectName = process.env.E2E_PROJECT_NAME;
  const groupName = `E2E Group ${Date.now()}`;

  await page.goto('/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);

  await Promise.all([
    page.waitForURL('**/projects'),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);

  await page.waitForSelector('table tbody tr');

  if (projectName) {
    await page
      .locator('table tbody tr', { hasText: projectName })
      .first()
      .click();
  } else {
    await page.locator('table tbody tr').first().click();
  }

  await page.waitForURL(/\/projects\/\d+/);

  const fixturePath = path.join(__dirname, 'fixtures', 'sample-keywords.csv');
  const reloadPromise = page.waitForNavigation({
    url: /\/projects\/\d+/,
    waitUntil: 'domcontentloaded',
  });

  await page.setInputFiles('#input-file-upload', fixturePath);
  await reloadPromise;

  await page.waitForSelector('table tbody tr');
  const firstKeywordCheckbox = page.locator('table tbody tr input[type="checkbox"]').first();
  await firstKeywordCheckbox.check();

  await page.locator('#groupNameInput').fill(groupName);
  await page.getByRole('button', { name: 'Group' }).click();

  await expect(
    page.locator(`text=/Successfully grouped|Grouped .* as/`),
  ).toBeVisible();

  await page.getByRole('button', { name: /View 2/i }).click();
  await expect(page.locator(`table tbody tr:has-text("${groupName}")`).first()).toBeVisible();
});
