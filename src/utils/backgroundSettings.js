export const BACKGROUND_SETTINGS_KEY = 'bookmark-background-settings'

const BACKGROUND_IMAGE_DB_NAME = 'bookmark-background-settings-db'
const BACKGROUND_IMAGE_STORE_NAME = 'background-assets'
const BACKGROUND_IMAGE_KEY = 'active-background-image'
const BACKGROUND_IMAGE_FLAG = '__indexeddb_background_image__'
const QUOTA_ERROR_NAMES = new Set([
  'QuotaExceededError',
  'NS_ERROR_DOM_QUOTA_REACHED'
])

let dbPromise = null

export const createDefaultBackgroundSettings = () => ({
  enabled: false,
  imageUrl: '',
  opacity: 0.72,
  backdropBlur: 6,
  cardRadius: 12,
  position: 'center center',
  size: 'cover',
  repeat: 'no-repeat'
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '')

const isEmbeddedImageUrl = (value) => /^data:image\//.test(toTrimmedString(value))

const isQuotaError = (error) =>
  error instanceof Error && (QUOTA_ERROR_NAMES.has(error.name) || error.message.includes('quota'))

const openDb = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(BACKGROUND_IMAGE_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BACKGROUND_IMAGE_STORE_NAME)) {
        db.createObjectStore(BACKGROUND_IMAGE_STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })

  return dbPromise
}

const withStore = async (mode, run) => {
  const db = await openDb()
  if (!db) {
    return null
  }

  return new Promise((resolve) => {
    const tx = db.transaction(BACKGROUND_IMAGE_STORE_NAME, mode)
    const store = tx.objectStore(BACKGROUND_IMAGE_STORE_NAME)
    run(store, resolve)
    tx.onerror = () => resolve(null)
  })
}

const backgroundImageStore = {
  async getImageUrl() {
    const entry = await withStore('readonly', (store, resolve) => {
      const req = store.get(BACKGROUND_IMAGE_KEY)
      req.onsuccess = () => resolve(req.result?.value || '')
      req.onerror = () => resolve('')
    })

    return typeof entry === 'string' ? entry : ''
  },

  async setImageUrl(imageUrl) {
    const saved = await withStore('readwrite', (store, resolve) => {
      const req = store.put({
        key: BACKGROUND_IMAGE_KEY,
        value: imageUrl,
        updatedAt: Date.now()
      })
      req.onsuccess = () => resolve(true)
      req.onerror = () => resolve(false)
    })

    return saved === true
  },

  async clearImageUrl() {
    const cleared = await withStore('readwrite', (store, resolve) => {
      const req = store.delete(BACKGROUND_IMAGE_KEY)
      req.onsuccess = () => resolve(true)
      req.onerror = () => resolve(false)
    })

    return cleared !== false
  }
}

const buildPersistedPayload = async (normalized, imageStore) => {
  if (!isEmbeddedImageUrl(normalized.imageUrl)) {
    await imageStore.clearImageUrl()
    return {
      ...normalized,
      imageUrl: normalized.imageUrl,
      imageStorage: ''
    }
  }

  const stored = await imageStore.setImageUrl(normalized.imageUrl)
  if (!stored) {
    throw new Error('本地图片保存失败，请重试或改用图片地址。')
  }

  return {
    ...normalized,
    imageUrl: BACKGROUND_IMAGE_FLAG,
    imageStorage: 'indexeddb'
  }
}

const resolvePersistedImageUrl = async (parsed, imageStore) => {
  const imageStorage = toTrimmedString(parsed?.imageStorage)
  const imageUrl = toTrimmedString(parsed?.imageUrl ?? parsed?.url ?? '')

  if (imageStorage === 'indexeddb' || imageUrl === BACKGROUND_IMAGE_FLAG) {
    return imageStore.getImageUrl()
  }

  return imageUrl
}

export const normalizeBackgroundSettings = (value = {}) => {
  const fallback = createDefaultBackgroundSettings()
  const imageUrl = toTrimmedString(value.imageUrl ?? value.url ?? '')
  const enabled = Boolean(value.enabled) || Boolean(imageUrl)
  const opacity = Number(value.opacity)
  const backdropBlur = Number(value.backdropBlur)
  const cardRadius = Number(value.cardRadius)
  const size = ['cover', 'contain', 'auto'].includes(value.size) ? value.size : fallback.size
  const repeat = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'].includes(value.repeat)
    ? value.repeat
    : fallback.repeat

  return {
    enabled,
    imageUrl,
    opacity: Number.isFinite(opacity) ? clamp(opacity, 0.2, 1) : fallback.opacity,
    backdropBlur: Number.isFinite(backdropBlur) ? clamp(backdropBlur, 0, 24) : fallback.backdropBlur,
    cardRadius: Number.isFinite(cardRadius) ? clamp(cardRadius, 0, 28) : fallback.cardRadius,
    position: toTrimmedString(value.position) || fallback.position,
    size,
    repeat
  }
}

export const loadBackgroundSettings = async (
  storage = globalThis.localStorage,
  imageStore = backgroundImageStore
) => {
  const fallback = createDefaultBackgroundSettings()

  try {
    const raw = storage?.getItem?.(BACKGROUND_SETTINGS_KEY)
    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw)
    const imageUrl = await resolvePersistedImageUrl(parsed, imageStore)
    return normalizeBackgroundSettings({
      ...parsed,
      imageUrl
    })
  } catch {
    return fallback
  }
}

export const saveBackgroundSettings = async (
  settings,
  storage = globalThis.localStorage,
  imageStore = backgroundImageStore
) => {
  const normalized = normalizeBackgroundSettings(settings)
  const persisted = await buildPersistedPayload(normalized, imageStore)

  try {
    storage?.setItem?.(BACKGROUND_SETTINGS_KEY, JSON.stringify(persisted))
    return normalized
  } catch (error) {
    if (persisted.imageStorage === 'indexeddb') {
      await imageStore.clearImageUrl()
    }

    if (isQuotaError(error)) {
      throw new Error('背景设置保存失败，存储空间不足。请改用图片地址或换一张更小的图片。')
    }

    throw error
  }
}

export const clearBackgroundSettings = async (
  storage = globalThis.localStorage,
  imageStore = backgroundImageStore
) => {
  storage?.removeItem?.(BACKGROUND_SETTINGS_KEY)
  await imageStore.clearImageUrl()
  return createDefaultBackgroundSettings()
}
