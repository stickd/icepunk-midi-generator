import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import path from 'node:path'

test('feed loads a bounded strip of MIDI thumbnails per pack and fits a compact viewport', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/preview-url')) requests.push(request.url()) })
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  const feed = page.getByRole('region', { name: 'Community feed' })
  await feed.click()
  const pack = feed.getByRole('article').first()
  await expect(pack.getByRole('button', { name: 'Preview', exact: true })).toBeEnabled()
  await expect(pack.locator('.midi-roll:not(.midi-roll-compact)').getByRole('img')).toBeVisible()
  await expect(pack.getByRole('button', { name: /^Select / }).first().getByRole('img')).toBeVisible()
  const byPack = new Map<string, number>()
  for (const url of requests) {
    const packId = new URL(url).pathname.split('/')[2]
    byPack.set(packId, (byPack.get(packId) ?? 0) + 1)
  }
  expect(byPack.size).toBeGreaterThan(0)
  expect([...byPack.values()].every(count => count <= 6)).toBeTruthy()
  const accessibility = await new AxeBuilder({ page }).include('.studio-community').analyze()
  expect(accessibility.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  const captureDir = process.env.ICEPUNK_CAPTURE_DIR
  if (captureDir) {
    fs.mkdirSync(captureDir, { recursive: true })
    await page.locator('.studio-community').screenshot({ path: path.join(captureDir, 'icepunk-feed.png') })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(pack).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
