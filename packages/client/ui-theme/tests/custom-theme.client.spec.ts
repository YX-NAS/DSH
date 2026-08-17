import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CUSTOM_THEME,
  EDITABLE_THEME_TOKENS,
  isEditableThemeToken,
  MAX_BACKGROUND_IMAGE_BYTES,
  normalizeBackgroundImage,
  normalizeBackgroundOpacity,
  normalizeCustomThemeTokens,
  normalizeThemeColor,
  QQ2008_THEME,
  themeContrast,
  validateCustomThemeContrast,
} from '../src/custom-theme.ts'

describe('custom theme policy', () => {
  it('accepts only signed PNG, JPEG, and WebP background data', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
    const jpeg = `data:image/jpeg;base64,${btoa('\xFF\xD8\xFF\xC0\x00\x11\x08\x00\x01\x00\x01\x03\x01\x11\x00\x02\x11\x00\x03\x11\x00\xFF\xD9')}`
    const webp = `data:image/webp;base64,${btoa('RIFF\x16\x00\x00\x00WEBPVP8X\x0A\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')}`
    expect(normalizeBackgroundImage('')).toBe('')
    expect(normalizeBackgroundImage(png)).toBe(png)
    expect(normalizeBackgroundImage(jpeg)).toBe(jpeg)
    expect(normalizeBackgroundImage(webp)).toBe(webp)
    expect(() => normalizeBackgroundImage('https://example.test/background.png')).toThrow()
    expect(() => normalizeBackgroundImage('data:image/svg+xml;base64,PHN2Zz4=')).toThrow()
    expect(() => normalizeBackgroundImage('data:image/png;base64,SGVsbG8=')).toThrow('does not match')
    const hugePng = `data:image/png;base64,${btoa('\x89PNG\r\n\x1A\n\x00\x00\x00\rIHDR\x00\x00\x20\x00\x00\x00\x00\x01')}`
    expect(() => normalizeBackgroundImage(hugePng)).toThrow('dimensions')
    const oversized = `data:image/png;base64,${btoa(`\x89PNG\r\n\x1A\n${'a'.repeat(MAX_BACKGROUND_IMAGE_BYTES)}`)}`
    expect(() => normalizeBackgroundImage(oversized)).toThrow('exceeds')
  })

  it('accepts opacity only as an integer percentage', () => {
    expect(normalizeBackgroundOpacity(0)).toBe(0)
    expect(normalizeBackgroundOpacity(100)).toBe(100)
    for (const value of [-1, 100.1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => normalizeBackgroundOpacity(value)).toThrow('integer')
    }
  })

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
