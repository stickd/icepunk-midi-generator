import { expect, test } from '@playwright/test'
import { generateMidiPack } from './helpers'

test('a guest can generate and download a MIDI pack without logging in', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()

  const startedAt = Date.now()
  const downloadPromise = page.waitForEvent('download')
  await generateMidiPack(page)
  await page.getByRole('button', { name: /Download whole pack/ }).click()
  const download = await downloadPromise
  const elapsedMs = Date.now() - startedAt

  expect(download.suggestedFilename()).toMatch(/\.zip$/)
  // Clicking a `download` link doesn't navigate away — the results view (and its
  // re-clickable download link) should still be there afterwards.
  await expect(page.getByRole('button', { name: /Download whole pack/ })).toBeVisible()

  // Client-side fetch aborts generation requests after 15s (lib/api.ts), so a
  // healthy generation should complete well inside that budget.
  expect(elapsedMs).toBeLessThan(10_000)

  // Guests never get a token, logged out the whole time.
  const token = await page.evaluate(() => localStorage.getItem('icepunk_token'))
  expect(token).toBeNull()
})
