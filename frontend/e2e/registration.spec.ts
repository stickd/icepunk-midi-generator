import { expect, test } from '@playwright/test'

import { authModal, readSeedUser, uniqueUser } from './helpers'

test('a new visitor can register an account and is logged in immediately', async ({ page }) => {
  const user = uniqueUser('icepunk_e2e_register')

  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up' }).click()

  const modal = authModal(page)
  await expect(modal.getByRole('heading', { name: 'Create account' })).toBeVisible()

  await modal.getByPlaceholder('Username').fill(user.username)
  await modal.getByPlaceholder('Email').fill(user.email)
  await modal.getByPlaceholder('Password').fill(user.password)
  await modal.getByRole('button', { name: 'Register' }).click()

  await expect(page.getByText('You are logged in.')).toBeVisible()
  await expect(modal).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()

  const token = await page.evaluate(() => localStorage.getItem('icepunk_token'))
  expect(token).toBeTruthy()
})

test('registering with an already-used email is rejected', async ({ page }) => {
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
  await modal.getByRole('button', { name: 'Register' }).click()

  await expect(
    modal.getByText('An account with that email or username already exists.'),
  ).toBeVisible()
  await expect(modal).toBeVisible()
})
