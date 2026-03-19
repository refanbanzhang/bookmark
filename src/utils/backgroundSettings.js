export const BACKGROUND_SETTINGS_KEY = 'bookmark-background-settings'

export const createDefaultBackgroundSettings = () => ({
  enabled: false,
  imageUrl: '',
  opacity: 0.72,
  backdropBlur: 6,
  position: 'center center',
  size: 'cover',
  repeat: 'no-repeat'
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '')

export const normalizeBackgroundSettings = (value = {}) => {
  const fallback = createDefaultBackgroundSettings()
  const imageUrl = toTrimmedString(value.imageUrl ?? value.url ?? '')
  const enabled = Boolean(value.enabled) || Boolean(imageUrl)
  const opacity = Number(value.opacity)
  const backdropBlur = Number(value.backdropBlur)
  const size = ['cover', 'contain', 'auto'].includes(value.size) ? value.size : fallback.size
  const repeat = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'].includes(value.repeat)
    ? value.repeat
    : fallback.repeat

  return {
    enabled,
    imageUrl,
    opacity: Number.isFinite(opacity) ? clamp(opacity, 0.2, 1) : fallback.opacity,
    backdropBlur: Number.isFinite(backdropBlur) ? clamp(backdropBlur, 0, 24) : fallback.backdropBlur,
    position: toTrimmedString(value.position) || fallback.position,
    size,
    repeat
  }
}

export const loadBackgroundSettings = (storage = globalThis.localStorage) => {
  const fallback = createDefaultBackgroundSettings()

  try {
    const raw = storage?.getItem?.(BACKGROUND_SETTINGS_KEY)
    if (!raw) {
      return fallback
    }

    return normalizeBackgroundSettings(JSON.parse(raw))
  } catch {
    return fallback
  }
}

export const saveBackgroundSettings = (settings, storage = globalThis.localStorage) => {
  const normalized = normalizeBackgroundSettings(settings)
  storage?.setItem?.(BACKGROUND_SETTINGS_KEY, JSON.stringify(normalized))
  return normalized
}

export const clearBackgroundSettings = (storage = globalThis.localStorage) => {
  storage?.removeItem?.(BACKGROUND_SETTINGS_KEY)
  return createDefaultBackgroundSettings()
}
