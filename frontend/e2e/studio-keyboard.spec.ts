import { expect, test } from '@playwright/test'

test('create dialog traps focus, closes on Escape and restores its trigger', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Generate', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Create pack' })
  await expect(dialog.getByRole('slider')).toBeFocused()
  await dialog.getByRole('button', { name: 'Next →' }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Next →' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('login submits from the keyboard and restores navigation focus on close', async ({ page }) => {
  // A contract-level response keeps this keyboard test independent of login rate limits.
  await page.route('**/auth/login', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid credentials' }),
  }))
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Login', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Welcome back' })
  await expect(dialog.getByPlaceholder('Email or Username')).toBeFocused()
  await dialog.getByPlaceholder('Email or Username').fill('keyboard-test@example.com')
  await dialog.getByPlaceholder('Password', { exact: true }).fill('test-password')
  const response = page.waitForResponse('**/auth/login')
  await dialog.getByPlaceholder('Password', { exact: true }).press('Enter')
  expect((await response).status()).toBe(401)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})
