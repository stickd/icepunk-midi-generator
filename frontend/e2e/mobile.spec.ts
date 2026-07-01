import { expect, test } from '@playwright/test'

import { authModal } from './helpers'

// Runs only under the mobile-chrome project (Pixel 5 viewport), see
// playwright.config.ts. Checks layout and interaction at a mobile viewport
// without hitting rate-limited backend endpoints.
test('key controls are visible and usable at a mobile viewport', async ({ page }) => {
  await page.goto('/')

  const viewportWidth = page.viewportSize()!.width

  const navbar = page.getByText('iCEPUNK', { exact: true })
  const generateButton = page.getByRole('button', { name: 'Generate MIDI Pack' })

  await expect(navbar).toBeVisible()
  await expect(generateButton).toBeVisible()

  for (const locator of [navbar, generateButton]) {
    const box = await locator.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1)
  }

  const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 1)

  await page.getByRole('button', { name: 'Sign up' }).click()
  const modal = authModal(page)
  await expect(modal.getByRole('heading', { name: 'Create account' })).toBeVisible()

  const modalBox = await modal.locator('> div').boundingBox()
  expect(modalBox).toBeTruthy()
  expect(modalBox!.width).toBeLessThanOrEqual(viewportWidth + 1)

  await modal.getByPlaceholder('Username').fill('mobile-tester')
  await expect(modal.getByPlaceholder('Username')).toHaveValue('mobile-tester')

  await modal.getByRole('button', { name: 'Close' }).click()
  await expect(modal).not.toBeVisible()
})
