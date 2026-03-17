const DB_NAME = 'bookmark-thumbnail-cache'
const STORE_NAME = 'thumbs'
const DB_VERSION = 1

const FRESH_MS = 1000 * 60 * 60 * 24 * 3
const EXPIRE_MS = 1000 * 60 * 60 * 24 * 30

let dbPromise = null
const inflight = new Map()

const getScreenshotUrl = (url) =>
  `https://image.thum.io/get/width/320/crop/200/noanimate/${encodeURIComponent(url)}`

const getFaviconUrl = (url) =>
  `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(url)}`

const getCacheKey = (url) => `thumb:${url}`

const openDb = () => {
  if (!('indexedDB' in window)) return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })

  return dbPromise
}

const withStore = async (mode, run) => {
  const db = await openDb()
  if (!db) return null

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    run(store, resolve)
    tx.onerror = () => resolve(null)
  })
}

const getEntry = async (key) => {
  return withStore('readonly', (store, resolve) => {
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

const setEntry = async (entry) => {
  return withStore('readwrite', (store, resolve) => {
    const req = store.put(entry)
    req.onsuccess = () => resolve(true)
    req.onerror = () => resolve(false)
  })
}

const canLoadImage = (src) =>
  new Promise((resolve) => {
    const image = new Image()
    image.loading = 'eager'
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = src
  })

const fetchBestThumbnail = async (url) => {
  const candidates = [getScreenshotUrl(url), getFaviconUrl(url)]
  for (const src of candidates) {
    const ok = await canLoadImage(src)
    if (ok) {
      return src
    }
  }
  return ''
}

const refreshEntry = async (key, url) => {
  const running = inflight.get(key)
  if (running) return running

  const task = (async () => {
    const thumbnailUrl = await fetchBestThumbnail(url)
    if (!thumbnailUrl) return ''

    const now = Date.now()
    await setEntry({
      key,
      url,
      thumbnailUrl,
      updatedAt: now
    })

    return thumbnailUrl
  })()

  inflight.set(key, task)
  try {
    return await task
  } finally {
    inflight.delete(key)
  }
}

const shouldRefresh = (updatedAt) => Date.now() - updatedAt > FRESH_MS
const isExpired = (updatedAt) => Date.now() - updatedAt > EXPIRE_MS

export const getThumbnailForUrl = async (url) => {
  if (!url) return ''
  const key = getCacheKey(url)
  const entry = await getEntry(key)
  const cachedUrl = entry?.thumbnailUrl || entry?.dataUrl || ''

  if (cachedUrl && !isExpired(entry.updatedAt || 0)) {
    if (shouldRefresh(entry.updatedAt || 0)) {
      refreshEntry(key, url).catch(() => {})
    }
    return cachedUrl
  }

  return refreshEntry(key, url)
}
