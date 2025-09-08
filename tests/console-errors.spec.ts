import { test, expect } from '@playwright/test';

test.describe('Console Error Detection', () => {
  test('should not have console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const consoleLogs: string[] = [];

    // Listen for console messages
    page.on('console', (msg) => {
      const text = msg.text();
      
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      } else if (msg.type() === 'log') {
        consoleLogs.push(text);
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Navigate to the page
    await page.goto('/');

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');

    // Check for console errors
    if (consoleErrors.length > 0) {
      console.log('Console Errors Found:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Check for console warnings
    if (consoleWarnings.length > 0) {
      console.log('Console Warnings Found:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
    }

    // Assert no console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('should not have console errors when interacting with MetaMask button', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Listen for console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Navigate to the page
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Try to click the MetaMask connect button (it will fail but shouldn't cause console errors)
    const connectButton = page.locator('button:has-text("Connect MetaMask")');
    if (await connectButton.isVisible()) {
      await connectButton.click();
      
      // Wait a bit for any potential errors
      await page.waitForTimeout(1000);
    }

    // Check for console errors
    if (consoleErrors.length > 0) {
      console.log('Console Errors Found after MetaMask interaction:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Assert no console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('should not have CSS import order warnings', async ({ page }) => {
    const consoleWarnings: string[] = [];

    // Listen for console warnings
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('@import')) {
        consoleWarnings.push(msg.text());
      }
    });

    // Navigate to the page
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check for CSS import warnings
    if (consoleWarnings.length > 0) {
      console.log('CSS Import Warnings Found:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
    }

    // Assert no CSS import warnings
    expect(consoleWarnings).toHaveLength(0);
  });

  test('should load without network errors', async ({ page }) => {
    const networkErrors: string[] = [];

    // Listen for failed network requests
    page.on('response', (response) => {
      if (!response.ok()) {
        networkErrors.push(`Failed request: ${response.url()} - ${response.status()}`);
      }
    });

    // Navigate to the page
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check for network errors
    if (networkErrors.length > 0) {
      console.log('Network Errors Found:');
      networkErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Assert no network errors (excluding expected external resources)
    const criticalErrors = networkErrors.filter(error => 
      !error.includes('fonts.googleapis.com') && 
      !error.includes('cdn.prod.website-files.com')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
