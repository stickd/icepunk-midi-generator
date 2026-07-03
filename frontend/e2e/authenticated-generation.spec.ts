import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import type { Browser, Page } from '@playwright/test'

import { loginViaUi, openGeneratedMidiSketchModal, readSeedUser } from './helpers'

// Runs serially and shares a single logged-in page across both tests below,
// so the suite only needs one /auth/login call (the backend rate-limits
// login attempts to 5 per 15 minutes per IP).
test.describe.serial('authenticated MIDI generation', () => {
  let page: Page

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    page = await browser.newPage()
    const seedUser = readSeedUser()
    await loginViaUi(page, seedUser.email, seedUser.password)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('an authenticated user can generate and download a MIDI pack', async () => {
    const startedAt = Date.now()
    const downloadPromise = page.waitForEvent('download')
    await openGeneratedMidiSketchModal(page)
    await page.getByRole('button', { name: /Download and publish/ }).click()
    const download = await downloadPromise
    const elapsedMs = Date.now() - startedAt

    expect(download.suggestedFilename()).toMatch(/\.zip$/)
    await expect(page.getByText('MIDI pack downloaded.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Download and publish/ })).toBeEnabled()

    // Client-side fetch aborts generation requests after 15s (lib/api.ts), so
    // a healthy generation should complete well inside that budget.
    expect(elapsedMs).toBeLessThan(10_000)
  })

  test('the downloaded ZIP file is a valid, non-empty archive', async () => {
    const downloadPromise = page.waitForEvent('download')
    await openGeneratedMidiSketchModal(page)
    await page.getByRole('button', { name: /Download and publish/ }).click()
    const download = await downloadPromise

    const filePath = await download.path()
    expect(filePath).toBeTruthy()

    const buffer = fs.readFileSync(filePath!)
    expect(buffer.length).toBeGreaterThan(0)

    // First 4 bytes of every ZIP local file header ("PK\x03\x04").
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  })
})
