import { expect, test } from '@playwright/test'

test('a generated 17-MIDI pack loads only selected and visible piano-roll previews', async ({ page }) => {
  const previewUrlRequests: string[] = []
  const midiObjectRequests: string[] = []

  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/preview-url')) previewUrlRequests.push(url)
    if (url.includes(':9010/') && /\.mid(?:\?|$)/.test(url)) midiObjectRequests.push(url)
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Generate', exact: true }).click()
  await page.getByRole('dialog', { name: 'Create pack' }).getByRole('button', { name: 'Next →' }).click()

  await expect(page.getByRole('button', { name: /Download whole pack/ })).toBeVisible()
  await expect(page.getByRole('img', { name: /MIDI notes across/ })).toBeVisible()
  await expect(page.getByText('n/a', { exact: true })).toHaveCount(0)

  // The default modal creates 17 items. The carousel mounts at most six thumbnails;
  // the selected item shares its request with its thumbnail through the stable cache.
  await expect.poll(() => previewUrlRequests.length).toBeGreaterThan(0)
  expect(previewUrlRequests.length).toBeLessThanOrEqual(6)
  expect(midiObjectRequests.length).toBeLessThanOrEqual(6)

  const requestsBeforeNavigation = previewUrlRequests.length
  const initialThumbnailNames = await page.locator('button[aria-label^="Select "]').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label')),
  )
  await page.getByRole('button', { name: 'Next items' }).click()
  await expect.poll(async () => page.locator('button[aria-label^="Select "]').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label')),
  )).not.toEqual(initialThumbnailNames)
  await expect.poll(() => previewUrlRequests.length).toBeGreaterThan(requestsBeforeNavigation)
  expect(previewUrlRequests.length).toBeLessThan(17)
})
