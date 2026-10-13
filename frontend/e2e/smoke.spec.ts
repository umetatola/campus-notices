import { expect, test } from '@playwright/test'
import { demoApi, notice } from './demo-api.ts'

test.beforeEach(async ({ page }) => {
  await demoApi(page)
})

test('browse, open a notice, come back with the search kept', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Fall 2026 course withdrawal/ })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search notices' }).fill('withdrawal')
  await expect(page).toHaveURL(/\?q=withdrawal/)

  await page.getByRole('link', { name: /Fall 2026 course withdrawal/ }).click()
  await expect(page).toHaveURL(`/notices/${notice.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Fall 2026 course withdrawal' })).toBeVisible()
  await expect(page.getByText('Undergraduates can withdraw')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute(
    'href',
    `/api/notices/${notice.id}/calendar.ics`,
  )
  await expect(page.getByAltText('Notice image 1 of 1')).toBeAttached()

  await page.getByRole('button', { name: '← All notices' }).click()
  await expect(page).toHaveURL(/\?q=withdrawal/)
  await expect(page.getByRole('searchbox', { name: 'Search notices' })).toHaveValue('withdrawal')
})

test('a direct visit to a notice page works', async ({ page }) => {
  await page.goto(`/notices/${notice.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Fall 2026 course withdrawal' })).toBeVisible()
})

test('switch to Korean and keep it after a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch language' }).click()
  await expect(page.getByRole('link', { name: '알림 받기' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')

  await page.reload()
  await expect(page.getByRole('searchbox', { name: '공지 검색' })).toBeVisible()
})

test('get alerts leads to sign-in', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Get alerts' }).click()
  await expect(page).toHaveURL('/sign-in')
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible()
})
