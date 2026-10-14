import { describe, expect, it } from 'vitest'
import manifestText from '../public/manifest.webmanifest?raw'
import html from '../index.html?raw'

const manifest = JSON.parse(manifestText)
const publicPngs = Object.keys(import.meta.glob('../public/*.png')).map((p) => p.replace('../public', ''))

describe('web app manifest', () => {
  it('is linked from the page with a phone icon and theme color', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
    expect(publicPngs).toContain('/apple-touch-icon.png')
    expect(html).toContain(`<meta name="theme-color" content="${manifest.theme_color}"`)
  })

  it('makes the site installable: name, standalone start page, 192 and 512 icons that exist', () => {
    expect(manifest).toMatchObject({ name: 'Campus Notices', start_url: '/', display: 'standalone' })
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) expect(publicPngs).toContain(icon.src)
  })
})
