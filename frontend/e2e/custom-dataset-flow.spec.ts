import { expect, test } from '@playwright/test'
import { Midi } from '@tonejs/midi'
import { registerViaApi } from './helpers'

test('custom MIDI analysis, playback, dataset saving and profile remain connected', async ({ page, request }) => {
  const user = await registerViaApi(request, 'studio_custom')
  await page.addInitScript(token => localStorage.setItem('icepunk_token', token), user.token)
  const midi = new Midi()
  midi.header.setTempo(146)
  const track = midi.addTrack()
  for (let i = 0; i < 16; i++) {
    track.addNote({ midi: [57, 60, 64, 67][i % 4], time: i * 0.4, duration: 0.35, velocity: 0.8 })
  }
  await page.goto('/')
  await page.getByRole('tab', { name: 'Custom', exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'studio-reference.mid', mimeType: 'audio/midi', buffer: Buffer.from(midi.toArray()),
  })
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByText(/Custom generation is ready/)).toBeVisible()
  await page.getByRole('button', { name: 'Generate', exact: true }).click()
  await page.getByRole('dialog', { name: 'Create pack' }).getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByRole('button', { name: /Download whole pack/ })).toBeVisible({ timeout: 15000 })
  const generator = page.getByRole('region', { name: 'MIDI generator' })
  await generator.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(generator.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await generator.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.getByRole('button', { name: 'Save as Dataset', exact: true }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save as Dataset' })
  await saveDialog.getByPlaceholder('e.g. Dark loops').fill('Studio reference dataset')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(saveDialog).not.toBeVisible()
  await page.getByRole('link', { name: user.username, exact: true }).click()
  await expect(page.getByRole('heading', { name: user.username })).toBeVisible()
  await page.getByRole('tab', { name: /Datasets/ }).click()
  await expect(page.getByText('Studio reference dataset', { exact: true })).toBeVisible()
})
