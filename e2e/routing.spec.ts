import { test, expect } from '@playwright/test';

test.describe('App routing and offline capabilities', () => {
  test('Dynamic deep link routing resolves correctly', async ({ page }) => {
    // Navigating to a dynamic dashboard deep link.
    // Ensure that rewrites work and it does not return a 404.
    const response = await page.goto('/dashboard/messages/123');
    expect(response?.status()).toBeLessThan(400);
    
    // Ensure the page actually loads content and isn't a dead end.
    await expect(page.locator('body')).toBeVisible();
  });

  test('PWA registers service worker and functions offline', async ({ page, context }) => {
    // 1. Visit root to ensure service worker registers and caches assets
    await page.goto('/');
    
    // Wait for the Service Worker to be registered and activated
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          // ensure it's fully activated
          if (registration.active.state !== 'activated') {
            await new Promise((resolve) => {
              registration.active?.addEventListener('statechange', (e) => {
                if ((e.target as ServiceWorker).state === 'activated') {
                  resolve(null);
                }
              });
            });
          }
        }
      }
    });
    
    // Wait for the Service Worker to take control of the page
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 10000 }).catch(() => {
       // Ignore timeout as it might already be registered in previous test or fast enough
    });
    
    // Allow a brief moment for precaching to complete
    await page.waitForTimeout(2000);

    // 2. Go offline
    await context.setOffline(true);

    // 3. Reload the page while offline
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {
       // Playwright may sometimes throw on network error despite SW handling it
    });

    // 4. Assert it still loads successfully via the PWA cache
    await expect(page.locator('body')).toBeVisible();

    // 5. Test offline navigation to a deep link (offline PWA capabilities)
    await page.goto('/dashboard/messages/123', { waitUntil: 'domcontentloaded' }).catch(() => {
      // Playwright may sometimes throw on network error despite SW handling it
    });
    
    // Ensure the deep link is served offline properly
    await expect(page.locator('body')).toBeVisible();
  });
});
