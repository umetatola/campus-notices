import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from './SettingsPage'
import { json, mockApi, renderPage } from '../test/helpers'
import type { DesktopSettings } from '../api'

const settings = (over: Partial<DesktopSettings> = {}): DesktopSettings => ({
  apiKeySet: false,
  apiKeyHint: null,
  summariesOn: false,
  backgroundAvailable: true,
  keepRunning: false,
  startedAt: '2026-11-11T00:00:00Z',
  ...over,
})

describe('SettingsPage', () => {
  it('saves a key, restarts the app and shows summaries on once the new copy answers', async () => {
    let current = settings()
    const sentKeys: unknown[] = []
    let restarted = false
    mockApi({
      '/api/desktop/settings': () =>
        json(restarted ? { ...current, summariesOn: true, startedAt: '2026-11-11T01:00:00Z' } : current),
      '/api/desktop/settings/api-key': async (_url, init) => {
        sentKeys.push(JSON.parse(String(init?.body)))
        current = settings({ apiKeySet: true, apiKeyHint: '…wxyz' })
        return json(current)
      },
      '/api/desktop/restart': (_url, init) => {
        expect(init?.method).toBe('POST')
        restarted = true
        return new Response(null, { status: 202 })
      },
    })
    renderPage(<SettingsPage />, { url: '/settings', path: '/settings' })

    expect(await screen.findByText(/^Off: add a Claude API key/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Claude API key'), '  sk-ant-test-0123456789wxyz  ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Key saved (…wxyz)')).toBeInTheDocument()
    expect(sentKeys).toEqual([{ apiKey: 'sk-ant-test-0123456789wxyz' }])
    expect(screen.getByLabelText('Replace the key')).toHaveValue('')
    expect(screen.getByText('Restart Campus Notices to apply the change.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Restart now' }))
    expect(await screen.findByText(/^Restarting/)).toBeInTheDocument()
    // the page checks once a second until a copy with a newer start time answers
    expect(await screen.findByText(/^On: new notices get/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // real 1 s restart checks: about 2 s alone, more when the whole suite runs in parallel
  }, 15_000)

  it('shows why a key was refused', async () => {
    mockApi({
      '/api/desktop/settings': () => json(settings()),
      '/api/desktop/settings/api-key': () => json({ detail: "That doesn't look like an API key." }, 400),
    })
    renderPage(<SettingsPage />, { url: '/settings', path: '/settings' })

    await userEvent.type(await screen.findByLabelText('Claude API key'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("That doesn't look like an API key.")
  })

  it('removes a saved key', async () => {
    const sentKeys: unknown[] = []
    mockApi({
      '/api/desktop/settings': () => json(settings({ apiKeySet: true, apiKeyHint: '…wxyz', summariesOn: true })),
      '/api/desktop/settings/api-key': (_url, init) => {
        sentKeys.push(JSON.parse(String(init?.body)))
        return json(settings({ summariesOn: true }))
      },
    })
    renderPage(<SettingsPage />, { url: '/settings', path: '/settings' })

    await userEvent.click(await screen.findByRole('button', { name: 'Remove key' }))

    expect(sentKeys).toEqual([{ apiKey: '' }])
    expect(await screen.findByText('Restart Campus Notices to apply the change.')).toBeInTheDocument()
  })

  it('turns running in the background on and off at once', async () => {
    const sent: unknown[] = []
    mockApi({
      '/api/desktop/settings': () => json(settings()),
      '/api/desktop/settings/keep-running': (_url, init) => {
        const body = JSON.parse(String(init?.body))
        sent.push(body)
        return json(settings({ keepRunning: body.enabled }))
      },
    })
    renderPage(<SettingsPage />, { url: '/settings', path: '/settings' })

    const box = await screen.findByRole('switch', { name: /Keep running in the tray/ })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    await waitFor(() => expect(box).toBeChecked())
    await userEvent.click(box)
    await waitFor(() => expect(box).not.toBeChecked())

    expect(sent).toEqual([{ enabled: true }, { enabled: false }])
    expect(screen.queryByText('Restart Campus Notices to apply the change.')).not.toBeInTheDocument()
  })

  it('hides the background option when there is no tray icon', async () => {
    mockApi({ '/api/desktop/settings': () => json(settings({ backgroundAvailable: false })) })
    renderPage(<SettingsPage />, { url: '/settings', path: '/settings' })

    expect(await screen.findByText('English summaries')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('explains that settings belong to the desktop app on the website', async () => {
    mockApi({})
    renderPage(<SettingsPage />, { url: '/settings', path: '/settings' })

    expect(
      await screen.findByText('Settings are only available in the Campus Notices desktop app.'),
    ).toBeInTheDocument()
  })
})
