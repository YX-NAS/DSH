/**
 * Appearance row slot store: a mirror of the theme service snapshot. The
 * plugin's apply-world change listener is the only writer; the row component
 * reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemePreference } from '../theme-settings.ts'

/** Store state mirrored from the theme snapshot. */
export interface AppearanceRowState {
  /** Persisted preference (selection state reads this, never the resolved active theme). */
  preference: ThemePreference
  /** Service revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
  /** Canonical custom-theme JSON shown by the constrained editor. */
  customTokens: string
  /** Validated custom background data URL. */
  backgroundImage: string
  /** Background opacity percentage. */
  backgroundOpacity: number
}

/** Declared action shape giving the exported factory a stable return type. */
type AppearanceRowActions = {
  sync: (
    draft: AppearanceRowState,
    preference: ThemePreference,
    customTokens: string,
    backgroundImage: string,
    backgroundOpacity: number,
    revision: number,
  ) => void
}

/**
 * Declares the Appearance row state and write surface.
 * @returns the store handle.
 */
export function createAppearanceRowStore(): EngineStoreHandle<AppearanceRowState, AppearanceRowActions> {
  return defineStore({
    init: (): AppearanceRowState => ({
      preference: 'system', customTokens: '{}', backgroundImage: '', backgroundOpacity: 25, revision: -1,
    }),
    actions: {
      sync: (d, preference, customTokens, backgroundImage, backgroundOpacity, revision) => {
        if (revision <= d.revision) return
        d.preference = preference
        d.customTokens = customTokens
        d.backgroundImage = backgroundImage
        d.backgroundOpacity = backgroundOpacity
        d.revision = revision
      },
    },
  })
}
