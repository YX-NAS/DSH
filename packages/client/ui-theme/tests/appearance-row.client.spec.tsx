// @vitest-environment jsdom
/** AppearanceRow behavior: three cubes, selection follows the persisted
 * preference, clicks drive setTheme. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { AppearanceRow } from '../src/client/AppearanceRow.tsx'
import type { AppearanceRowComponentProps } from '../src/client/AppearanceRow.tsx'
import { createAppearanceRowStore } from '../src/client/settings-store.ts'
import type { ThemePreference } from '../src/client/index.ts'
import { DEFAULT_CUSTOM_THEME } from '../src/custom-theme.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
}

/** Empty global standard-kit hooks (the row reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(preference: ThemePreference = 'system') {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createAppearanceRowStore().create()
  store.actions.sync(preference, JSON.stringify(DEFAULT_CUSTOM_THEME.tokens), '', 25, 0)
  const setTheme = vi.fn()
  const props: AppearanceRowComponentProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => (en as Record<string, string>)[key] ?? COPY[key] ?? key,
    setTheme,
    saveCustomTheme: vi.fn(),
    resetCustomTokens: vi.fn(),
  }
  render(<AppearanceRow {...props} />)
  return { store, setTheme, saveCustomTheme: props.saveCustomTheme }
}

const pressed = (name: RegExp): string | null =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed')

describe('AppearanceRow', () => {
  it('renders the title and five cubes with the preference cube selected', () => {
    mount('dark')
    expect(screen.getByText('Appearance')).toBeDefined()
    expect(pressed(/Dark/)).toBe('true')
    expect(pressed(/Light/)).toBe('false')
    expect(pressed(/System/)).toBe('false')
    expect(pressed(/QQ 2008/)).toBe('false')
    expect(pressed(/My theme/)).toBe('false')
  })

  it('click drives setTheme; selection follows the store mirror, not the click echo', () => {
    const b = mount('dark')
    fireEvent.click(screen.getByRole('button', { name: /Light/ }))
    expect(b.setTheme).toHaveBeenCalledWith('light')
    // No store write yet: selection is unchanged.
    expect(pressed(/Dark/)).toBe('true')
    act(() => { b.store.actions.sync('light', '{}', '', 25, 1) })
    expect(pressed(/Light/)).toBe('true')
    expect(pressed(/Dark/)).toBe('false')
  })

  it('renders a constrained color editor for the custom theme', () => {
    mount('custom')
    expect(screen.getByLabelText('Theme style editor')).toBeDefined()
    expect(screen.getAllByDisplayValue(/^#[0-9a-f]{6}$/i)).toHaveLength(12)
    expect(screen.getByRole('button', { name: 'Save and apply' })).toBeDefined()
    expect(screen.getByText('Background image')).toBeDefined()
    expect(screen.getByRole('slider', { name: /Image opacity/ }).getAttribute('value')).toBe('25')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('uploads, adjusts, saves, and removes a validated background draft', async () => {
    const mounted = mount('custom')
    const bytes = Uint8Array.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
      0, 0, 0, 1, 0, 0, 0, 1,
    ])
    const file = new File([bytes], 'background.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Choose local image'), { target: { files: [file] } })
    await waitFor(() => { expect(document.querySelector('img')).not.toBeNull() })
    fireEvent.change(screen.getByRole('slider', { name: /Image opacity/ }), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and apply' }))
    expect(mounted.saveCustomTheme).toHaveBeenCalledWith(
      expect.any(Object), expect.stringMatching(/^data:image\/png;base64,/), 40,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove background' }))
    expect(document.querySelector('img')).toBeNull()
  })

  it('rejects an unsupported background before save', async () => {
    mount('custom')
    const file = new File(['<svg/>'], 'background.svg', { type: 'image/svg+xml' })
    fireEvent.change(screen.getByLabelText('Choose local image'), { target: { files: [file] } })
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('invalid') })
  })
})
