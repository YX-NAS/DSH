/**
 * Host-rendered theme bootstrap for the browser's pre-plugin interval. Each
 * index response embeds the current durable built-in preference; the browser
 * resolves only `system`, then writes the same DOM fields ui-layout's
 * ThemePresenter owns after the client plugin tree activates.
 */

import { DEFAULT_PREFERENCE, type ThemePreference } from './theme-settings.ts'
import { EDITABLE_THEME_TOKENS, QQ2008_THEME } from './custom-theme.ts'

/** Build the inline script for one schema-validated built-in preference. */
function bootThemeScript(preference: ThemePreference): string {
  const qqTokens = JSON.stringify(QQ2008_THEME.tokens)
  const editableTokens = JSON.stringify(EDITABLE_THEME_TOKENS)
  return `<script>(() => {
  let preference = ${JSON.stringify(preference)}
  let customTokens = undefined
  try {
    const stored = JSON.parse(localStorage.getItem('ui-theme') || 'null')
    if (stored && ['light', 'dark', 'system', 'qq2008', 'custom'].includes(stored.preference)) {
      preference = stored.preference
      const allowed = ${editableTokens}
      if (stored.customTokens && allowed.every(name => /^#[0-9A-Fa-f]{6}$/.test(stored.customTokens[name]))) {
        const candidate = Object.fromEntries(allowed.map(name => [name, stored.customTokens[name]]))
        const luminance = value => {
          const channels = [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255)
            .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
          return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
        }
        const contrast = (left, right) => (Math.max(luminance(left), luminance(right)) + .05)
          / (Math.min(luminance(left), luminance(right)) + .05)
        const readable = [
          [candidate['--dsw-alias-label-primary'], candidate['--dsw-alias-bg-layer-1'], 4.5],
          [candidate['--dsw-alias-label-secondary'], candidate['--dsw-alias-bg-layer-1'], 4.5],
          ['#FFFFFF', candidate['--dsw-alias-button-primary-fill'], 4.5],
          ['#FFFFFF', candidate['--dsw-alias-button-primary-hover'], 4.5],
          [candidate['--dsw-alias-border-l1'], candidate['--dsw-alias-bg-layer-1'], 3],
          [candidate['--dsw-alias-border-l2'], candidate['--dsw-alias-bg-layer-1'], 3],
          [candidate['--dsw-alias-brand-primary'], candidate['--dsw-alias-bg-layer-1'], 3],
          [candidate['--dsw-alias-brand-primary'], candidate['--dsw-alias-bg-layer-2'], 3],
        ].every(([left, right, minimum]) => contrast(left, right) >= minimum)
        if (readable) customTokens = candidate
      }
    }
  } catch {}
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  document.body.setAttribute('data-dsh-theme', preference === 'system' ? (dark ? 'dark' : 'light') : preference)
  if (preference === 'qq2008' || (preference === 'custom' && customTokens)) {
    const tokens = preference === 'qq2008' ? ${qqTokens} : customTokens
    for (const [name, value] of Object.entries(tokens)) document.body.style.setProperty(name, value)
    document.body.setAttribute('data-dsh-boot-theme-tokens', Object.keys(tokens).join(','))
  }
})()</script>`
}

/**
 * Insert the theme bootstrap immediately after the opening body tag, before
 * the shell mount and module script. Body-less fragments receive it at the
 * end, where the HTML parser has already synthesized a body.
 * @param html - Raw application index HTML.
 * @param preference - Current Host-backed built-in preference.
 * @returns HTML containing the theme bootstrap.
 */
export function injectBootTheme(
  html: string,
  preference: ThemePreference = DEFAULT_PREFERENCE,
): string {
  const script = bootThemeScript(preference)
  const body = /<body(?:\s[^>]*)?>/i.exec(html)
  if (body === null) return `${html}${script}`
  const at = body.index + body[0].length
  return `${html.slice(0, at)}${script}${html.slice(at)}`
}
