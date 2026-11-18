// Screenshots of the main pages for design review.
//   node scripts/shots.mjs <base-url> <out-dir> [light|dark]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [, , base = 'http://localhost:5173', out = 'shots', scheme = 'light'] = process.argv
mkdirSync(out, { recursive: true })

// the installed Edge, so no browser download is needed
const browser = await chromium.launch({ channel: process.env.SHOTS_CHANNEL ?? 'msedge' })
for (const [name, width, height] of [['desktop', 1366, 900], ['phone', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 })
  const firstId = await page.request
    .get(`${base}/api/notices?size=1`)
    .then((r) => r.json())
    .then((j) => j.items[0]?.id)
    .catch(() => null)
  const routes = [['home', '/'], ['deadlines', '/deadlines'], ['ask', '/ask'], ['signin', '/sign-in']]
  if (firstId) routes.push(['notice', `/notices/${firstId}`])
  for (const [label, path] of routes) {
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${out}/${name}-${scheme}-${label}.png`, fullPage: label !== 'home' || name === 'phone' ? false : false })
  }
  await page.close()
}
await browser.close()
console.log('done')
