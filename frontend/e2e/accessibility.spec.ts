import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { authModal } from './helpers'

// Runs only on chromium (see playwright.config.ts) and never touches the
// backend, so it can run as often as needed without affecting rate limits.
test('the landing page has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const results = await new AxeBuilder({ page })
    .include('main')
    .analyze()

  const seriousOrWorse = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )

  expect(seriousOrWorse, JSON.stringify(seriousOrWorse, null, 2)).toEqual([])
})

test('the auth modal has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up' }).click()

  const modal = authModal(page)
  await expect(modal.getByRole('heading', { name: 'Create account' })).toBeVisible()

  const results = await new AxeBuilder({ page }).include('div[role="dialog"]').analyze()

  const seriousOrWorse = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )

  expect(seriousOrWorse, JSON.stringify(seriousOrWorse, null, 2)).toEqual([])
})
