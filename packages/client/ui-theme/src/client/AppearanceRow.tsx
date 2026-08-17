/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30012 'Frame 2117131228'): title + three preference cubes.
 * Registered by this package — the theme feature owns its own settings
 * surface. Selection follows the persisted preference, never the resolved
 * active theme.
 */
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'
import { EDITABLE_THEME_TOKENS, MAX_BACKGROUND_IMAGE_BYTES, type EditableThemeToken } from '../custom-theme.ts'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
  /** Save a complete, allowlisted custom palette. */
  saveCustomTheme: (tokens: Readonly<Record<string, string>>, image: string, opacity: number) => void
  /** Restore the shipped custom palette. */
  resetCustomTokens: () => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
  { id: 'qq2008', labelKey: 'appearance.qq2008', Icon: IconLightOutline16 },
  { id: 'custom', labelKey: 'appearance.custom', Icon: IconLightOutline16 },
]

const TOKEN_KEYS: Record<EditableThemeToken, ThemeKey> = {
  '--dsw-alias-bg-base': 'editor.bgBase',
  '--dsw-alias-bg-layer-1': 'editor.bgLayer1',
  '--dsw-alias-bg-layer-2': 'editor.bgLayer2',
  '--dsw-alias-border-l1': 'editor.border1',
  '--dsw-alias-border-l2': 'editor.border2',
  '--dsw-alias-brand-primary': 'editor.brand',
  '--dsw-alias-button-primary-fill': 'editor.button',
  '--dsw-alias-button-primary-hover': 'editor.buttonHover',
  '--dsw-alias-interactive-bg-hover': 'editor.hover',
  '--dsw-alias-label-primary': 'editor.text',
  '--dsw-alias-label-secondary': 'editor.textSecondary',
  '--dsw-specific-sidebar-fill': 'editor.sidebar',
}

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({
  t, setTheme, saveCustomTheme, resetCustomTokens, useStore,
}: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const customTokens = useStore(s => s.customTokens)
  const backgroundImage = useStore(s => s.backgroundImage)
  const backgroundOpacity = useStore(s => s.backgroundOpacity)
  const [draft, setDraft] = useState<Record<string, string>>(() => JSON.parse(customTokens) as Record<string, string>)
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [backgroundDraft, setBackgroundDraft] = useState(backgroundImage)
  const [opacityDraft, setOpacityDraft] = useState(backgroundOpacity)
  useEffect(() => { setDraft(JSON.parse(customTokens) as Record<string, string>) }, [customTokens])
  useEffect(() => { setBackgroundDraft(backgroundImage); setOpacityDraft(backgroundOpacity) }, [backgroundImage, backgroundOpacity])
  const chooseBackground = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_BACKGROUND_IMAGE_BYTES) {
        throw new Error('unsupported background')
      }
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file)
        const validDimensions = bitmap.width <= 4096 && bitmap.height <= 4096 && bitmap.width * bitmap.height <= 8_000_000
        bitmap.close()
        if (!validDimensions) throw new Error('background dimensions exceed limit')
      }
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.addEventListener('load', () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('read failed'))
        })
        reader.addEventListener('error', () => { reject(reader.error ?? new Error('read failed')) })
        reader.readAsDataURL(file)
      })
      setBackgroundDraft(dataUrl)
      setMessage('')
      setHasError(false)
    } catch {
      setMessage(t('editor.backgroundError'))
      setHasError(true)
    }
  }
  return (
    <div className={css.group}>
      <div className={css.title}>{t('appearance.title')}</div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, preference === id && css.selected)}
            aria-pressed={preference === id}
            onClick={() => { setTheme(id) }}
          >
            <Icon />
            {t(labelKey)}
          </button>
        ))}
      </div>
      {preference === 'custom' && (
        <section className={css.editor} aria-label={t('editor.title')}>
          <p className={css.help}>{t('editor.help')}</p>
          <div className={css.tokenGrid}>
            {EDITABLE_THEME_TOKENS.map(token => (
              <label className={css.tokenField} key={token}>
                <span>{t(TOKEN_KEYS[token])}</span>
                <input
                  aria-label={t(TOKEN_KEYS[token])}
                  type="color"
                  value={draft[token] ?? '#000000'}
                  onChange={(event) => { setDraft(current => ({ ...current, [token]: event.target.value.toUpperCase() })); setMessage(''); setHasError(false) }}
                />
                <code>{draft[token]}</code>
              </label>
            ))}
          </div>
          <div className={css.backgroundEditor}>
            <div className={css.backgroundTitle}>{t('editor.background')}</div>
            {backgroundDraft !== '' && <img className={css.backgroundPreview} src={backgroundDraft} alt="" />}
            <label className={css.fileButton}>
              {t('editor.chooseBackground')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => { void chooseBackground(event.target.files?.[0]); event.target.value = '' }}
              />
            </label>
            <label className={css.opacityField}>
              <span>{t('editor.opacity')}: {opacityDraft}%</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={opacityDraft}
                onChange={(event) => { setOpacityDraft(Number(event.target.value)); setMessage(''); setHasError(false) }}
              />
            </label>
            <button type="button" disabled={backgroundDraft === ''} onClick={() => { setBackgroundDraft(''); setMessage('') }}>
              {t('editor.removeBackground')}
            </button>
            <p className={css.backgroundHint}>{t('editor.backgroundHint')}</p>
          </div>
          <div className={css.editorActions}>
            <button type="button" onClick={() => {
              try {
                saveCustomTheme(draft, backgroundDraft, opacityDraft)
                setMessage(t('editor.saved'))
                setHasError(false)
              }
              catch { setMessage(t('editor.contrastError')); setHasError(true) }
            }}>{t('editor.save')}</button>
            <button type="button" onClick={() => { resetCustomTokens(); setMessage(t('editor.resetDone')); setHasError(false) }}>{t('editor.reset')}</button>
            <span role={hasError ? 'alert' : 'status'}>{message}</span>
          </div>
        </section>
      )}
    </div>
  )
}
