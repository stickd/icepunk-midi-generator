import { expect, test } from '@playwright/test'
import path from 'node:path'

import { loginViaUi, readSeedUser } from './helpers'

test('a public feed pack renders and plays the selected generated MIDI', async ({ browser, page, request }) => {
  const seedUser = readSeedUser()
  const packName = `Feed preview ${Date.now().toString(36)}`

  await loginViaUi(page, seedUser.email, seedUser.password)
  await page.getByRole('button', { name: 'Generate', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create pack' })
  await dialog.getByLabel('Pack Name').fill(packName)
  await dialog.getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByRole('button', { name: /Download whole pack/ })).toBeVisible()
  const generatorRoll = page.locator('.midi-roll:not(.midi-roll-compact)').first()
  await expect(generatorRoll.getByRole('img')).toBeVisible()
  const generatorStyle = await generatorRoll.locator('.midi-roll-surface').evaluate(el => ({ height: getComputedStyle(el).height, background: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderRadius }))
  if (process.env.ICEPUNK_CAPTURE_DIR) await generatorRoll.screenshot({ path: path.join(process.env.ICEPUNK_CAPTURE_DIR, 'midi-generator.png') })

  const feedResponse = await request.get('http://localhost:8081/generated-packs/feed?page=0&size=10')
  expect(feedResponse.ok()).toBeTruthy()
  const feedPayload = await feedResponse.json() as {
    items: Array<{ name: string; packId: string; items: Array<{ id: string }> }>
  }
  const generatedPack = feedPayload.items.find((item) => item.name === packName)
  expect(generatedPack).toBeTruthy()
  expect(generatedPack?.items.length).toBeGreaterThan(1)
  const secondPreviewEndpoint = `http://localhost:8081/generated-packs/${generatedPack!.packId}/items/${generatedPack!.items[1].id}/preview-url`

  // A separate page has an empty in-memory preview cache, so this verifies the
  // public-feed path itself rather than reusing the generator page's cache.
  const token = await page.evaluate(() => localStorage.getItem('icepunk_token'))
  const feedPage = await browser.newPage()
  const secondPreviewUrlRequests: string[] = []
  const midiObjectRequests: string[] = []
  let secondObjectUrl = ""
  feedPage.on("response", async response => { if (response.url() === secondPreviewEndpoint) secondObjectUrl = (await response.json()).url })
  feedPage.on('request', (request) => {
    const url = request.url()
    if (url === secondPreviewEndpoint) secondPreviewUrlRequests.push(url)
    if (url.includes(':9010/') && /\.mid(?:\?|$)/.test(url)) midiObjectRequests.push(url)
  })
  await feedPage.addInitScript((value) => localStorage.setItem('icepunk_token', value ?? ''), token)

  try {
    await feedPage.goto('/')
    const feed = feedPage.getByRole('region', { name: 'Community feed' })
    await feed.click()

    const pack = feed.getByRole('article', { name: `Generated pack ${packName}` })
    await expect(pack).toBeVisible()
    await expect(pack.locator('.midi-roll:not(.midi-roll-compact)').getByRole('img')).toBeVisible()
    await expect(pack.getByText('n/a', { exact: true })).toHaveCount(0)
    await expect(pack.getByRole('button', { name: 'Preview' })).toBeEnabled()

    const feedStyle = await pack.locator('.midi-roll:not(.midi-roll-compact) .midi-roll-surface').evaluate(el => ({ height: getComputedStyle(el).height, background: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderRadius }))
    expect(feedStyle).toEqual(generatorStyle)
    if (process.env.ICEPUNK_CAPTURE_DIR) await pack.screenshot({ path: path.join(process.env.ICEPUNK_CAPTURE_DIR, 'midi-feed.png') })

    const secondMidi = pack.getByRole('button', { name: /^Select / }).nth(1)
    // Visible thumbnails preload once and share their cache with the main roll.
    await expect(secondMidi.getByRole('img')).toBeVisible()
    await expect.poll(() => secondPreviewUrlRequests.length).toBe(1)
    await secondMidi.click()
    await expect(secondMidi).toHaveAttribute('aria-current', 'true')
    await expect(pack.locator('.midi-roll:not(.midi-roll-compact)').getByRole('img')).toBeVisible()
    await expect(pack.getByText('n/a', { exact: true })).toHaveCount(0)
    await expect(pack.getByRole('button', { name: 'Preview' })).toBeEnabled()
    await expect.poll(() => secondPreviewUrlRequests.length).toBe(1)
    await expect.poll(() => midiObjectRequests.filter((url) => url === secondObjectUrl).length).toBe(1)
    await pack.getByRole('button', { name: /^Select / }).nth(0).click()
    await secondMidi.click()
    await expect(secondMidi).toHaveAttribute('aria-current', 'true')
    expect(secondPreviewUrlRequests.length).toBe(1)
    expect(midiObjectRequests.filter((url) => url === secondObjectUrl).length).toBe(1)
    await pack.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(pack.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    await pack.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(pack.getByRole('button', { name: 'Preview', exact: true })).toBeEnabled()
  } finally {
    await feedPage.close()
  }
})
