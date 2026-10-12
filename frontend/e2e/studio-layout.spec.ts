import { expect, test } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

test('studio fits desktop and compact screens without horizontal scrolling', async ({ page }) => {
  const captureDir = process.env.ICEPUNK_CAPTURE_DIR
  if (captureDir) fs.mkdirSync(captureDir, { recursive: true })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading', { name: 'Cold by nature. Endless by design.' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (captureDir) await page.screenshot({ path: path.join(captureDir, width === 1440 ? 'icepunk-desktop.png' : 'icepunk-mobile.png'), fullPage: true })
  }
})
