import type { APIRequestContext, Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SEED_FILE = path.join(__dirname, '.seed-user.json')

export function readSeedUser(): { username: string; email: string; password: string } {
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'))
}

export function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081'
}

export function uniqueUser(prefix: string) {
  // Backend enforces a 40-char max username (RegisterRequest.java), so keep the
  // whole thing compact regardless of how long the caller's prefix is.
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1_000_000).toString(36)}`
  const shortPrefix = prefix.slice(0, 20)

  return {
    username: `${shortPrefix}_${suffix}`,
    email: `${shortPrefix}_${suffix}@example.com`,
    password: 'Sup3rSecret!',
  }
}

export async function registerViaApi(
  request: APIRequestContext,
  prefix: string,
): Promise<{ username: string; email: string; password: string; token: string }> {
  const user = uniqueUser(prefix)

  const response = await request.post(`${apiUrl()}/auth/register`, {
    data: user,
  })

  if (!response.ok()) {
    throw new Error(
      `Failed to register seed user via API: ${response.status()} ${await response.text()}`,
    )
  }

  const body = (await response.json()) as { token: string }

  return { ...user, token: body.token }
}

export function authModal(page: Page) {
  // `.z-50` disambiguates from the page's decorative `fixed inset-0 z-0` background layer.
  return page.locator('div.fixed.inset-0.z-50')
}

export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Login', exact: true }).click()

  const modal = authModal(page)
  await modal.getByPlaceholder('Email').fill(email)
  await modal.getByPlaceholder('Password').fill(password)
  await modal.getByRole('button', { name: 'Login', exact: true }).click()

  await page.getByText('You are logged in.').waitFor()
}

export async function openGeneratedMidiSketchModal(page: Page) {
  await page.getByRole('button', { name: 'Generate random' }).click()
  await page.getByRole('dialog', { name: 'Create pack' }).waitFor()
  await page.getByRole('button', { name: 'Next →' }).click()
  await page.getByRole('dialog', { name: 'Generated Midis' }).waitFor()
}
