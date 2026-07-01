import { expect, test } from '@playwright/test'

import { authModal } from './helpers'

// Runs on chromium, firefox, and webkit (see playwright.config.ts projects)
// to cover cross-browser compatibility of the core landing page.
test('the landing page renders and the auth modal opens/closes across browsers', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByText('iCEPUNK', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate MIDI Pack' })).toBeVisible()
  await expect(page.getByText('MIDI packs generated')).toBeVisible()

  await page.getByRole('button', { name: 'Sign up' }).click()
  const modal = authModal(page)
  await expect(modal.getByRole('heading', { name: 'Create account' })).toBeVisible()

  await modal.getByRole('button', { name: 'Close' }).click()
  await expect(modal).not.toBeVisible()
})
