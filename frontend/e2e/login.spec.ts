import { expect, test } from '@playwright/test'

import { authModal, readSeedUser } from './helpers'

test('an existing user can log in with valid credentials', async ({ page }) => {
  const seedUser = readSeedUser()

  await page.goto('/')
  await page.getByRole('button', { name: 'Login', exact: true }).click()

  const modal = authModal(page)
  await expect(modal.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

  await modal.getByPlaceholder('Email').fill(seedUser.email)
  await modal.getByPlaceholder('Password').fill(seedUser.password)
  await modal.getByRole('button', { name: 'Login', exact: true }).click()

  await expect(page.getByText('You are logged in.')).toBeVisible()
  await expect(modal).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()

  const token = await page.evaluate(() => localStorage.getItem('icepunk_token'))
  expect(token).toBeTruthy()
})

test('logging in with the wrong password is rejected', async ({ page }) => {
  const seedUser = readSeedUser()

  await page.goto('/')
  await page.getByRole('button', { name: 'Login', exact: true }).click()

  const modal = authModal(page)
  await modal.getByPlaceholder('Email').fill(seedUser.email)
  await modal.getByPlaceholder('Password').fill('definitely-the-wrong-password')
  await modal.getByRole('button', { name: 'Login', exact: true }).click()

  await expect(modal.getByText('Invalid credentials.')).toBeVisible()
  await expect(modal).toBeVisible()
})

test('a logged-in user can log out', async ({ page }) => {
  const seedUser = readSeedUser()

  await page.goto('/')
  await page.getByRole('button', { name: 'Login', exact: true }).click()

  const modal = authModal(page)
  await modal.getByPlaceholder('Email').fill(seedUser.email)
  await modal.getByPlaceholder('Password').fill(seedUser.password)
  await modal.getByRole('button', { name: 'Login', exact: true }).click()

  await page.getByRole('button', { name: 'Logout' }).click()

  await expect(page.getByText('You are logged out.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()

  const token = await page.evaluate(() => localStorage.getItem('icepunk_token'))
  expect(token).toBeNull()
})
