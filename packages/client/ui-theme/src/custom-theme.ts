/** Safe color-token policy and shipped presets for editable themes. */

/** Theme shape consumed structurally by the browser theme registry. */
export interface CustomThemeDefinition {
  /** Stable selection id. */
  id: string
  /** Base palette semantics used by native controls and fallback tokens. */
  colorScheme: 'light' | 'dark'
  /** Semantic CSS custom-property overrides. */
  tokens: Readonly<Record<string, string>>
}

/** Semantic color tokens exposed by the theme editor. */
export const EDITABLE_THEME_TOKENS = Object.freeze([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-button-primary-fill',
  '--dsw-alias-button-primary-hover',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-specific-sidebar-fill',
] as const)

/** One token accepted at the editable-theme boundary. */
export type EditableThemeToken = typeof EDITABLE_THEME_TOKENS[number]

const EDITABLE_TOKEN_SET: ReadonlySet<string> = new Set(EDITABLE_THEME_TOKENS)
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/**
 * Whether a string is one of the deliberately editable semantic tokens.
 * @param value - candidate CSS custom-property name.
 * @returns whether the name belongs to the editor allowlist.
 */
export function isEditableThemeToken(value: string): value is EditableThemeToken {
  return EDITABLE_TOKEN_SET.has(value)
}

/**
 * Validate and normalize one editor color. Only complete opaque RGB hex is
 * accepted; rejecting shorthand, alpha, whitespace, and CSS functions keeps
 * the persisted value from becoming a general CSS injection channel.
 * @param value - candidate color string.
 * @returns the canonical uppercase color.
 */
export function normalizeThemeColor(value: string): string {
  if (!HEX_COLOR.test(value)) {
    throw new TypeError(`theme color ${JSON.stringify(value)} must use #RRGGBB`)
  }
  return value.toUpperCase()
}

/**
 * Validate a complete token draft and return a detached normalized copy.
 * @param tokens - complete candidate palette.
 * @returns a detached palette containing only allowlisted canonical colors.
 */
export function normalizeCustomThemeTokens(
  tokens: Readonly<Record<string, string>>,
): Record<EditableThemeToken, string> {
  const normalized = {} as Record<EditableThemeToken, string>
  for (const token of EDITABLE_THEME_TOKENS) {
    const value = tokens[token]
    if (value === undefined) throw new TypeError(`custom theme is missing editable token ${JSON.stringify(token)}`)
    normalized[token] = normalizeThemeColor(value)
  }
  for (const token of Object.keys(tokens)) {
    if (!isEditableThemeToken(token)) {
      throw new TypeError(`custom theme token ${JSON.stringify(token)} is not editable`)
    }
  }
  return normalized
}

/**
 * WCAG relative contrast ratio for two normalized RGB colors.
 * @param left - first `#RRGGBB` color.
 * @param right - second `#RRGGBB` color.
 * @returns the WCAG contrast ratio.
 */
export function themeContrast(left: string, right: string): number {
  const luminance = (value: string): number => {
    const channels = [1, 3, 5].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    const [red = 0, green = 0, blue = 0] = channels
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const a = luminance(normalizeThemeColor(left))
  const b = luminance(normalizeThemeColor(right))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/**
 * Reject palettes that would hide core text, buttons, or control boundaries.
 * @param tokens - normalized complete editable palette.
 */
export function validateCustomThemeContrast(tokens: Readonly<Record<EditableThemeToken, string>>): void {
  const checks = [
    ['primary text', tokens['--dsw-alias-label-primary'], tokens['--dsw-alias-bg-layer-1'], 4.5],
    ['secondary text', tokens['--dsw-alias-label-secondary'], tokens['--dsw-alias-bg-layer-1'], 4.5],
    ['button text', '#FFFFFF', tokens['--dsw-alias-button-primary-fill'], 4.5],
    ['button hover text', '#FFFFFF', tokens['--dsw-alias-button-primary-hover'], 4.5],
    ['primary border', tokens['--dsw-alias-border-l1'], tokens['--dsw-alias-bg-layer-1'], 3],
    ['secondary border', tokens['--dsw-alias-border-l2'], tokens['--dsw-alias-bg-layer-1'], 3],
    ['brand focus on primary panel', tokens['--dsw-alias-brand-primary'], tokens['--dsw-alias-bg-layer-1'], 3],
    ['brand focus on secondary panel', tokens['--dsw-alias-brand-primary'], tokens['--dsw-alias-bg-layer-2'], 3],
  ] as const
  for (const [role, foreground, background, minimum] of checks) {
    if (themeContrast(foreground, background) < minimum) {
      throw new TypeError(`${role} contrast must be at least ${minimum}:1`)
    }
  }
}

/** Conservative starting palette for a user-authored light theme. */
export const DEFAULT_CUSTOM_THEME: CustomThemeDefinition = Object.freeze({
  id: 'custom',
  colorScheme: 'light',
  tokens: Object.freeze(normalizeCustomThemeTokens({
    '--dsw-alias-bg-base': '#F7F9FC',
    '--dsw-alias-bg-layer-1': '#FFFFFF',
    '--dsw-alias-bg-layer-2': '#F0F3F8',
    '--dsw-alias-border-l1': '#7A8494',
    '--dsw-alias-border-l2': '#7D8796',
    '--dsw-alias-brand-primary': '#4176E6',
    '--dsw-alias-button-primary-fill': '#315FC0',
    '--dsw-alias-button-primary-hover': '#284FA2',
    '--dsw-alias-interactive-bg-hover': '#E8EEF9',
    '--dsw-alias-label-primary': '#1F2633',
    '--dsw-alias-label-secondary': '#626C7A',
    '--dsw-specific-sidebar-fill': '#EEF2F8',
  })),
})

/** QQ 2008-inspired blue-and-silver palette over the existing light base. */
export const QQ2008_THEME: CustomThemeDefinition = Object.freeze({
  id: 'qq2008',
  colorScheme: 'light',
  tokens: Object.freeze(normalizeCustomThemeTokens({
    '--dsw-alias-bg-base': '#DCECF8',
    '--dsw-alias-bg-layer-1': '#F8FCFF',
    '--dsw-alias-bg-layer-2': '#EAF5FC',
    '--dsw-alias-border-l1': '#4D88B0',
    '--dsw-alias-border-l2': '#5B91B5',
    '--dsw-alias-brand-primary': '#0066A8',
    '--dsw-alias-button-primary-fill': '#0066A8',
    '--dsw-alias-button-primary-hover': '#0874B5',
    '--dsw-alias-interactive-bg-hover': '#D8EEFA',
    '--dsw-alias-label-primary': '#183A52',
    '--dsw-alias-label-secondary': '#4D7087',
    '--dsw-specific-sidebar-fill': '#C9E4F5',
  })),
})
