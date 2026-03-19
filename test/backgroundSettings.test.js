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

test('normalizes background settings and keeps image-enabled state', () => {
  const settings = normalizeBackgroundSettings({
    imageUrl: '  https://example.com/bg.jpg  ',
    opacity: 2,
    backdropBlur: 30,
    size: 'contain',
    repeat: 'repeat-x'
  })

  assert.deepEqual(settings, {
    enabled: true,
    imageUrl: 'https://example.com/bg.jpg',
    opacity: 1,
    backdropBlur: 24,
    position: 'center center',
    size: 'contain',
    repeat: 'repeat-x'
  })
})

test('loads defaults for missing or invalid data', () => {
  const storage = createMemoryStorage({
    [BACKGROUND_SETTINGS_KEY]: '{"imageUrl":123,"opacity":"oops"}'
  })

  assert.deepEqual(loadBackgroundSettings(storage), {
    enabled: false,
    imageUrl: '',
    opacity: 0.72,
    backdropBlur: 6,
    position: 'center center',
    size: 'cover',
    repeat: 'no-repeat'
  })
})

test('saves normalized settings and clears them', () => {
  const storage = createMemoryStorage()
  const saved = saveBackgroundSettings({ imageUrl: 'https://example.com/bg.png', enabled: false }, storage)

  assert.equal(saved.enabled, true)
  assert.equal(storage.dump()[BACKGROUND_SETTINGS_KEY], JSON.stringify(saved))

  const cleared = clearBackgroundSettings(storage)
  assert.deepEqual(cleared, createDefaultBackgroundSettings())
  assert.equal(storage.dump()[BACKGROUND_SETTINGS_KEY], undefined)
})
