import { expect, test } from '@playwright/test'

test('a guest can generate and download a MIDI pack without logging in', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Generate MIDI Pack' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/\.zip$/)
  await expect(page.getByText('MIDI pack downloaded.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate MIDI Pack' })).toBeEnabled()

  // Guests never get a token, logged out the whole time.
  const token = await page.evaluate(() => localStorage.getItem('icepunk_token'))
  expect(token).toBeNull()
})
