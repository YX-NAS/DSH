/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system', 'qq2008', 'custom'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the validated custom-theme color document. */
export const THEME_CUSTOM_TOKENS_FIELD = 'customTokens'
/** Single-field envelope used to atomically persist all custom-theme content. */
export const THEME_CUSTOM_THEME_FIELD = 'customTheme'
/** Field carrying the validated embedded background image. */
export const THEME_BACKGROUND_IMAGE_FIELD = 'backgroundImage'
/** Field carrying background opacity as an integer percentage. */
export const THEME_BACKGROUND_OPACITY_FIELD = 'backgroundOpacity'

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in preference. */
  preference: ThemePreference
  /** JSON object produced by the constrained theme editor. */
  customTokens: string
  /** Atomic JSON envelope containing colors, background, and opacity. */
  customTheme: string
  /** Embedded PNG/JPEG/WebP data URL; empty disables the background. */
  backgroundImage: string
  /** Background image opacity percentage. */
  backgroundOpacity: number
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [THEME_CUSTOM_TOKENS_FIELD]: z.string().default('{}'),
  [THEME_CUSTOM_THEME_FIELD]: z.string().default(''),
  [THEME_BACKGROUND_IMAGE_FIELD]: z.string().default(''),
  [THEME_BACKGROUND_OPACITY_FIELD]: z.number().step(1).min(0).max(100).default(25),
})

/**
 * Narrow one wire or registry value to a persistable preference.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}
