import { expect, test } from '@playwright/test'

import { authModal, readSeedUser, uniqueUser } from './helpers'

test('a new visitor can register and is asked to verify their email', async ({ page }) => {
  const user = uniqueUser('icepunk_e2e_register')

  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up' }).click()

  const modal = authModal(page)
  await expect(modal.getByRole('heading', { name: 'Create account' })).toBeVisible()

  await modal.getByPlaceholder('Username').fill(user.username)
  await modal.getByPlaceholder('Email').fill(user.email)
  await modal.getByPlaceholder('Password').fill(user.password)
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Register' }).click()

  await expect(modal.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Resend verification email' })).toBeVisible()
})

test('re-registering with an existing email keeps the response generic', async ({ page }) => {
  // Reuses the shared seed user (registered once in global setup) instead of
  // registering a second throwaway account, to stay under the backend's
  // 3-registrations-per-hour-per-IP anti-abuse limit.
  const seedUser = readSeedUser()

  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up' }).click()

  const modal = authModal(page)
  await modal.getByPlaceholder('Username').fill(`${seedUser.username}_2`)
  await modal.getByPlaceholder('Email').fill(seedUser.email)
  await modal.getByPlaceholder('Password').fill(seedUser.password)
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Register' }).click()

  await expect(modal.getByRole('heading', { name: 'Check your email' })).toBeVisible()
})
