import { expect, test } from '@playwright/test'

test('a visitor can submit the feedback form', async ({ page }) => {
  await page.goto('/')

  const form = page.locator('form', { has: page.getByPlaceholder('Your name') })

  await form.getByPlaceholder('Your name').fill('Ada Lovelace')
  await form.getByPlaceholder('you@example.com').fill('ada@example.com')
  await form.locator('select[name="feedbackType"]').selectOption('Feature Request')
  await form
    .getByPlaceholder('Tell us what should be colder, sharper, or easier to use.')
    .fill('It would be great to export stems alongside the MIDI pack.')

  await form.getByRole('button', { name: 'Send Feedback' }).click()

  await expect(form.getByText('Thanks for helping improve IcePunk.')).toBeVisible()
})
