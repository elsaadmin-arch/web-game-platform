import { test, expect } from '@playwright/test'

test.describe('Landing screen', () => {
  test('shows Create Room and Join Room buttons', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join Room' })).toBeVisible()
  })
})

test.describe('Create room flow', () => {
  test('navigates to name prompt on Create Room click', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(page.getByPlaceholder('Your name')).toBeVisible()
  })

  test('Create Room button is disabled without a name', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeDisabled()
  })

  test('creates a room and shows 6-char code', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByPlaceholder('Your name').fill('Alice')
    await page.getByRole('button', { name: 'Create Room' }).click()
    const code = page.locator('.font-mono.font-bold')
    await expect(code).toBeVisible()
    const text = await code.innerText()
    expect(text.replace(/\s/g, '')).toMatch(/^[A-Z2-9]{6}$/)
  })

  test('shows Copy Code button in waiting room', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByPlaceholder('Your name').fill('Alice')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(page.getByRole('button', { name: 'Copy Code' })).toBeVisible()
  })

  test('shows Copied! feedback after copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByPlaceholder('Your name').fill('Alice')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByRole('button', { name: 'Copy Code' }).click()
    await expect(page.getByRole('button', { name: '✓ Copied!' })).toBeVisible()
  })

  test('Start Game is disabled with only 1 player', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByPlaceholder('Your name').fill('Alice')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled()
  })

  test('Leave Room returns to landing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByPlaceholder('Your name').fill('Alice')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByRole('button', { name: 'Leave Room' }).click()
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()
  })
})

test.describe('Join room flow', () => {
  test('navigates to name + code prompt on Join Room click', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Join Room' }).click()
    await expect(page.getByPlaceholder('Your name')).toBeVisible()
    await expect(page.getByPlaceholder('Room code')).toBeVisible()
  })

  test('Join button disabled without name and code', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Join Room' }).click()
    await expect(page.getByRole('button', { name: 'Join' })).toBeDisabled()
  })

  test('Join button disabled with name but no code', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Join Room' }).click()
    await page.getByPlaceholder('Your name').fill('Bob')
    await expect(page.getByRole('button', { name: 'Join' })).toBeDisabled()
  })
})

test.describe('Two-player multiplayer', () => {
  test('second player joins and appears in host player list', async ({ browser }) => {
    // Player 1: create room
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await page1.goto('/')
    await page1.getByRole('button', { name: 'Create Room' }).click()
    await page1.getByPlaceholder('Your name').fill('Alice')
    await page1.getByRole('button', { name: 'Create Room' }).click()
    const codeText = await page1.locator('.font-mono.font-bold').innerText()
    const code = codeText.replace(/\s/g, '')

    // Player 2: join room
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await page2.goto('/')
    await page2.getByRole('button', { name: 'Join Room' }).click()
    await page2.getByPlaceholder('Your name').fill('Bob')
    await page2.getByPlaceholder('Room code').fill(code)
    await page2.getByRole('button', { name: 'Join' }).click()

    // Host should now see Bob in the player list
    await expect(page1.getByText('Bob')).toBeVisible({ timeout: 5000 })

    // Start Game should now be enabled for host (2 players = enough)
    await expect(page1.getByRole('button', { name: 'Start Game' })).toBeEnabled({ timeout: 5000 })

    // Guest should NOT see Start Game button
    await expect(page2.getByText('Waiting for host to start')).toBeVisible()

    // Player count shows 2
    await expect(page1.getByText('Players (2)')).toBeVisible()

    await ctx1.close()
    await ctx2.close()
  })

  test('host sees themselves in player list immediately', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByPlaceholder('Your name').fill('Alice')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Players (1)')).toBeVisible()
  })
})

test.describe('Session persistence', () => {
  test('waiting room survives page reload', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByPlaceholder('Your name').fill('Alice')
    await page.getByRole('button', { name: 'Create Room' }).click()
    const codeText = await page.locator('.font-mono.font-bold').innerText()

    await page.reload()
    await expect(page.locator('.font-mono.font-bold')).toHaveText(codeText.trim())
  })
})
