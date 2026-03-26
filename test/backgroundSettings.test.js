import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKGROUND_SETTINGS_KEY,
  clearBackgroundSettings,
  createDefaultBackgroundSettings,
  loadBackgroundSettings,
  normalizeBackgroundSettings,
  saveBackgroundSettings
} from '../src/utils/backgroundSettings.js'

const createMemoryStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    dump: () => Object.fromEntries(store.entries())
  }
}

const createImageStore = (initial = '') => {
  let imageUrl = initial
  return {
    getImageUrl: async () => imageUrl,
    setImageUrl: async (nextImageUrl) => {
      imageUrl = nextImageUrl
      return true
    },
    clearImageUrl: async () => {
      imageUrl = ''
      return true
    },
    peek: () => imageUrl
  }
}

test('normalizes background settings and keeps image-enabled state', () => {
  const settings = normalizeBackgroundSettings({
    imageUrl: '  https://example.com/bg.jpg  ',
    opacity: 2,
    backdropBlur: 30,
    cardRadius: 99,
    size: 'contain',
    repeat: 'repeat-x'
  })

  assert.deepEqual(settings, {
    enabled: true,
    imageUrl: 'https://example.com/bg.jpg',
    opacity: 1,
    backdropBlur: 24,
    cardRadius: 28,
    position: 'center center',
    size: 'contain',
    repeat: 'repeat-x'
  })
})

test('loads defaults for missing or invalid data', async () => {
  const storage = createMemoryStorage({
    [BACKGROUND_SETTINGS_KEY]: '{"imageUrl":123,"opacity":"oops"}'
  })

  assert.deepEqual(await loadBackgroundSettings(storage), {
    enabled: false,
    imageUrl: '',
    opacity: 0.72,
    backdropBlur: 6,
    cardRadius: 12,
    position: 'center center',
    size: 'cover',
    repeat: 'no-repeat'
  })
})

test('saves normalized settings and clears them', async () => {
  const storage = createMemoryStorage()
  const imageStore = createImageStore()
  const saved = await saveBackgroundSettings({ imageUrl: 'https://example.com/bg.png', enabled: false }, storage, imageStore)

  assert.equal(saved.enabled, true)
  assert.equal(storage.dump()[BACKGROUND_SETTINGS_KEY], JSON.stringify({ ...saved, imageStorage: '' }))

  const cleared = await clearBackgroundSettings(storage, imageStore)
  assert.deepEqual(cleared, createDefaultBackgroundSettings())
  assert.equal(storage.dump()[BACKGROUND_SETTINGS_KEY], undefined)
  assert.equal(imageStore.peek(), '')
})

test('stores uploaded background image outside localStorage', async () => {
  const storage = createMemoryStorage()
  const imageStore = createImageStore()
  const dataUrl = 'data:image/png;base64,abc123'

  const saved = await saveBackgroundSettings({ imageUrl: dataUrl, enabled: true }, storage, imageStore)
  const persisted = JSON.parse(storage.dump()[BACKGROUND_SETTINGS_KEY])
  const loaded = await loadBackgroundSettings(storage, imageStore)

  assert.equal(saved.imageUrl, dataUrl)
  assert.equal(persisted.imageUrl, '__indexeddb_background_image__')
  assert.equal(persisted.imageStorage, 'indexeddb')
  assert.equal(imageStore.peek(), dataUrl)
  assert.equal(loaded.imageUrl, dataUrl)
})
