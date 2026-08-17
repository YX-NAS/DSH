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
const BACKGROUND_IMAGE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/
/** Maximum decoded background image size accepted by settings. */
export const MAX_BACKGROUND_IMAGE_BYTES = 524_288
const MAX_BACKGROUND_EDGE = 4096
const MAX_BACKGROUND_PIXELS = 8_000_000

function readBackgroundDimensions(bytes: Uint8Array, mime: string): readonly [number, number] | undefined {
  if (mime === 'png' && bytes.length >= 24 && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return [view.getUint32(16), view.getUint32(20)]
  }
  if (mime === 'jpeg') {
    for (let offset = 2; offset + 8 < bytes.length;) {
      if (bytes[offset] !== 0xFF) return undefined
      const marker = bytes[offset + 1] ?? 0
      if (marker === 0xD9 || marker === 0xDA) break
      const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)
      if (length < 2 || offset + 2 + length > bytes.length) return undefined
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7)
        || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        return [((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0),
          ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0)]
      }
      offset += 2 + length
    }
    return undefined
  }
  if (mime === 'webp' && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8X') {
      return [1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16),
        1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16)]
    }
    if (chunk === 'VP8 ' && bytes[23] === 0x9D && bytes[24] === 0x01 && bytes[25] === 0x2A) {
      return [((bytes[27] ?? 0) << 8 | (bytes[26] ?? 0)) & 0x3FFF,
        ((bytes[29] ?? 0) << 8 | (bytes[28] ?? 0)) & 0x3FFF]
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2F) {
      const bits = (bytes[21] ?? 0) | ((bytes[22] ?? 0) << 8) | ((bytes[23] ?? 0) << 16) | ((bytes[24] ?? 0) << 24)
      return [1 + (bits & 0x3FFF), 1 + ((bits >>> 14) & 0x3FFF)]
    }
  }
  return undefined
}

/**
 * Validate a browser-produced background image data URL.
 * @param value - empty string or PNG/JPEG/WebP base64 data URL.
 * @returns the validated value unchanged.
 */
export function normalizeBackgroundImage(value: string): string {
  if (value === '') return ''
  const match = BACKGROUND_IMAGE.exec(value)
  if (match === null) throw new TypeError('theme background must be a PNG, JPEG, or WebP data URL')
  const encoded = match[2] ?? ''
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const decodedBytes = Math.floor(encoded.length * 3 / 4) - padding
  if (decodedBytes > MAX_BACKGROUND_IMAGE_BYTES) {
    throw new TypeError(`theme background exceeds ${MAX_BACKGROUND_IMAGE_BYTES} bytes`)
  }
  let binary: string
  try { binary = atob(encoded) } catch { throw new TypeError('theme background contains invalid base64') }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  const mime = match[1] ?? ''
  const valid = mime === 'png'
    ? bytes.length >= 8 && [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].every((byte, index) => bytes[index] === byte)
    : mime === 'jpeg'
      ? bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
        && bytes.at(-2) === 0xFF && bytes.at(-1) === 0xD9
      : bytes.length >= 12 && binary.slice(0, 4) === 'RIFF' && binary.slice(8, 12) === 'WEBP'
  if (!valid) throw new TypeError(`theme background content does not match image/${mime}`)
  const dimensions = readBackgroundDimensions(bytes, mime)
  if (dimensions === undefined) throw new TypeError('theme background has no valid dimensions')
  const [width, height] = dimensions
  if (width < 1 || height < 1 || width > MAX_BACKGROUND_EDGE || height > MAX_BACKGROUND_EDGE
    || width * height > MAX_BACKGROUND_PIXELS) {
    throw new TypeError('theme background dimensions exceed the safe limit')
  }
  return `data:image/${mime};base64,${btoa(binary)}`
}

/**
 * Validate background image opacity as an integer percentage.
 * @param value - candidate percentage.
 * @returns the accepted integer from 0 through 100.
 */
export function normalizeBackgroundOpacity(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new TypeError('theme background opacity must be an integer from 0 to 100')
  }
  return value
}

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
