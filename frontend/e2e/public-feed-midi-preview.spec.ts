import { expect, test } from '@playwright/test'

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
    await expect(pack.getByRole('img', { name: /MIDI notes across/ })).toBeVisible()
    await expect(pack.getByText('n/a', { exact: true })).toHaveCount(0)
    await expect(pack.getByRole('button', { name: 'Preview' })).toBeEnabled()

    const secondMidi = pack.getByRole('button', { name: /^Select / }).nth(1)
    // The second card is visible in the carousel and has already requested its
    // preview. Selecting it must take the shared cache, not fetch it again.
    await expect.poll(() => secondPreviewUrlRequests.length).toBe(1)
    await feedPage.waitForTimeout(200)
    const previewRequestsBeforeSelect = secondPreviewUrlRequests.length
    const midiRequestsBeforeSelect = midiObjectRequests.length
    await secondMidi.click()
    await expect(secondMidi).toHaveAttribute('aria-current', 'true')
    await expect(pack.getByRole('img', { name: /MIDI notes across/ })).toBeVisible()
    await expect(pack.getByText('n/a', { exact: true })).toHaveCount(0)
    await expect(pack.getByRole('button', { name: 'Preview' })).toBeEnabled()
    expect(secondPreviewUrlRequests.length).toBe(previewRequestsBeforeSelect)
    expect(midiObjectRequests.length).toBe(midiRequestsBeforeSelect)
  } finally {
    await feedPage.close()
  }
})
