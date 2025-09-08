import { test, expect } from '@playwright/test';

test.describe('Basic Functionality', () => {
  test('should load the landing page correctly', async ({ page }) => {
    await page.goto('/');

    // Check if the main title is visible
    await expect(page.locator('h1')).toContainText('Silo Market Crafter');

    // Check if the logo is present
    await expect(page.locator('img[alt="Silo"]')).toBeVisible();

    // Check if navigation links are present
    await expect(page.locator('a:has-text("Silo Finance")')).toBeVisible();
    await expect(page.locator('a:has-text("Silo App")')).toBeVisible();

    // Check if MetaMask connect button is present
    await expect(page.locator('button:has-text("Connect MetaMask")')).toBeVisible();
  });

  test('should have proper page title and meta description', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle('Silo Market Crafter');

    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', 'UI for market creation for Silo');
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check if main elements are still visible on mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('img[alt="Silo"]')).toBeVisible();
    await expect(page.locator('button:has-text("Connect MetaMask")')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check Silo Finance link
    const siloFinanceLink = page.locator('a:has-text("Silo Finance")');
    await expect(siloFinanceLink).toHaveAttribute('href', 'https://silo.finance');
    await expect(siloFinanceLink).toHaveAttribute('target', '_blank');

    // Check Silo App link
    const siloAppLink = page.locator('a:has-text("Silo App")');
    await expect(siloAppLink).toHaveAttribute('href', 'https://app.silo.finance');
    await expect(siloAppLink).toHaveAttribute('target', '_blank');
  });

  test('should have proper logo link', async ({ page }) => {
    await page.goto('/');

    // Check if logo links to home page
    const logoLink = page.locator('a').first();
    await expect(logoLink).toHaveAttribute('href', '/');
  });
});
