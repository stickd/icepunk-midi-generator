import { request } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { registerViaApi } from './helpers'

const SEED_FILE = path.join(__dirname, '.seed-user.json')

export default async function globalSetup() {
  // Reuse a still-valid local seed account. Re-registering for every targeted
  // Playwright run hits the backend's deliberate registration rate limit and
  // adds no isolation benefit: tests generate uniquely named packs.
  if (fs.existsSync(SEED_FILE)) return;

  const context = await request.newContext()

  try {
    const seedUser = await registerViaApi(context, 'icepunk_e2e_seed')

    fs.writeFileSync(
      SEED_FILE,
      JSON.stringify(
        { username: seedUser.username, email: seedUser.email, password: seedUser.password },
        null,
        2,
      ),
    )
  } finally {
    await context.dispose()
  }
}
