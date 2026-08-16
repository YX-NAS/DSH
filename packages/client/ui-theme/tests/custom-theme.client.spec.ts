import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CUSTOM_THEME,
  EDITABLE_THEME_TOKENS,
  isEditableThemeToken,
  normalizeCustomThemeTokens,
  normalizeThemeColor,
  QQ2008_THEME,
  themeContrast,
  validateCustomThemeContrast,
} from '../src/custom-theme.ts'

describe('custom theme policy', () => {
  it('normalizes complete RGB hex colors to uppercase', () => {
    expect(normalizeThemeColor('#1aB2c3')).toBe('#1AB2C3')
  })

  it.each([
    '#123', '#12345678', '123456', ' #123456', '#123456 ',
    'rgb(1, 2, 3)', 'var(--safe)', 'url(https://example.test/x)', '',
  ])('rejects non-#RRGGBB input %j', (value) => {
    expect(() => normalizeThemeColor(value)).toThrow('must use #RRGGBB')
  })

  it('recognizes only the editor allowlist', () => {
    expect(isEditableThemeToken('--dsw-alias-bg-base')).toBe(true)
    expect(isEditableThemeToken('--dsw-static-neutral-100')).toBe(false)
    expect(isEditableThemeToken('background')).toBe(false)
  })

  it('normalizes a complete draft into a detached copy', () => {
    const draft = { ...DEFAULT_CUSTOM_THEME.tokens, '--dsw-alias-brand-primary': '#abcdef' }
    const normalized = normalizeCustomThemeTokens(draft)
    expect(normalized['--dsw-alias-brand-primary']).toBe('#ABCDEF')
    draft['--dsw-alias-brand-primary'] = '#000000'
    expect(normalized['--dsw-alias-brand-primary']).toBe('#ABCDEF')
  })

  it('rejects missing and unknown tokens', () => {
    const missing = { ...DEFAULT_CUSTOM_THEME.tokens }
    delete missing['--dsw-alias-bg-base']
    expect(() => normalizeCustomThemeTokens(missing)).toThrow('is missing editable token')
    expect(() => normalizeCustomThemeTokens({
      ...DEFAULT_CUSTOM_THEME.tokens,
      '--unknown': '#123456',
    })).toThrow('is not editable')
  })

  it.each([DEFAULT_CUSTOM_THEME, QQ2008_THEME])('ships a complete immutable $id preset', (theme) => {
    expect(Object.isFrozen(theme)).toBe(true)
    expect(Object.isFrozen(theme.tokens)).toBe(true)
    expect(Object.keys(theme.tokens)).toEqual([...EDITABLE_THEME_TOKENS])
    for (const value of Object.values(theme.tokens)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('enforces readable text, buttons, and control boundaries', () => {
    expect(themeContrast('#FFFFFF', '#000000')).toBe(21)
    expect(() => { validateCustomThemeContrast({
      ...DEFAULT_CUSTOM_THEME.tokens,
      '--dsw-alias-label-primary': '#FFFFFF',
    } as never) }).toThrow('contrast')
    expect(() => { validateCustomThemeContrast({
      ...DEFAULT_CUSTOM_THEME.tokens,
      '--dsw-alias-brand-primary': DEFAULT_CUSTOM_THEME.tokens['--dsw-alias-bg-layer-1'],
    } as never) }).toThrow('brand focus')
    expect(() => { validateCustomThemeContrast(DEFAULT_CUSTOM_THEME.tokens) }).not.toThrow()
    expect(() => { validateCustomThemeContrast(QQ2008_THEME.tokens) }).not.toThrow()
  })
})
