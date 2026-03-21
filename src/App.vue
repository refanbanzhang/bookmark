<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BookmarkGroup from './components/BookmarkGroup.vue'
import { fallbackTree } from './mock/fallbackTree'
import {
  findNodeById,
  getNodeLocation,
  hasChildren,
  moveNodeToFinalIndexInTree,
  pruneNodesByIds,
  renameNodeInTree,
  replaceNodesAtParent
} from './utils/bookmarkTree'
import {
  clearBackgroundSettings,
  createDefaultBackgroundSettings,
  loadBackgroundSettings,
  saveBackgroundSettings
} from './utils/backgroundSettings'

const bookmarkTree = ref([])
const loading = ref(true)
const status = ref('正在加载书签……')
const warning = ref('')
const theme = ref('light')
const minimalMode = ref(false)
const backgroundSettings = ref(createDefaultBackgroundSettings())
const backgroundDraft = ref(createDefaultBackgroundSettings())
const backgroundSettingsOpen = ref(false)
const backgroundError = ref('')
const backgroundFileInput = ref(null)
const chromeRootFolderId = ref('1')
const editingNode = ref(null)
const editingTitle = ref('')
const editError = ref('')
const editInput = ref(null)
const deletingNode = ref(null)
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null
})

const THEME_KEY = 'bookmark-theme'
const MINIMAL_MODE_KEY = 'bookmark-minimal-mode'

const editingKind = computed(() => {
  if (!editingNode.value) return ''
  return hasChildren(editingNode.value) ? '文件夹' : '书签'
})

const deletingKind = computed(() => {
  if (!deletingNode.value) return ''
  return hasChildren(deletingNode.value) ? '文件夹' : '书签'
})

const contextNode = computed(() => contextMenu.value.node)
const contextKind = computed(() => (contextNode.value ? (hasChildren(contextNode.value) ? '文件夹' : '书签') : ''))
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`
}))
const hasBackgroundImage = computed(
  () => backgroundSettings.value.enabled && Boolean(backgroundSettings.value.imageUrl)
)

const pageBackdropStyle = computed(() => {
  if (!hasBackgroundImage.value) {
    return {}
  }

  return {
    backgroundImage: `url(${JSON.stringify(backgroundSettings.value.imageUrl)})`,
    backgroundPosition: backgroundSettings.value.position,
    backgroundRepeat: backgroundSettings.value.repeat,
    backgroundSize: backgroundSettings.value.size,
    opacity: backgroundSettings.value.opacity
  }
})

const backgroundPreviewStyle = computed(() => {
  if (!backgroundDraft.value.imageUrl) {
    return {}
  }

  return {
    backgroundImage: `url(${JSON.stringify(backgroundDraft.value.imageUrl)})`,
    backgroundPosition: backgroundDraft.value.position,
    backgroundRepeat: backgroundDraft.value.repeat,
    backgroundSize: backgroundDraft.value.size,
    opacity: backgroundDraft.value.opacity
  }
})

const contentStyle = computed(() => {
  if (!hasBackgroundImage.value) {
    return {}
  }

  const blur = backgroundSettings.value.backdropBlur

  return {
    background: 'transparent',
    backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.05)` : 'none'
  }
})

const hasChromeBookmarks = () => typeof window !== 'undefined' && Boolean(window.chrome?.bookmarks)

const wrapChromeCallback = (runner) =>
  new Promise((resolve, reject) => {
    try {
      runner((result) => {
        const error = window.chrome?.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(result)
      })
    } catch (error) {
      reject(error)
    }
  })

const loadBookmarksFromChrome = async () => {
  const tree = await wrapChromeCallback((resolve) => window.chrome.bookmarks.getTree(resolve))
  const root = Array.isArray(tree) ? tree[0] : null
  if (root?.children?.length) {
    const barNode = root.children.find((node) => {
      if (String(node.id) === '1') return true
      const title = (node.title || '').toLowerCase()
      return ['书签栏', 'bookmarks bar', 'bookmark bar'].includes(title)
    })
    return {
      rootFolderId: String(barNode?.id || '1'),
      nodes: barNode?.children || []
    }
  }

  if (Array.isArray(tree)) {
    const barNode = tree.find((node) => String(node.id) === '1')
    return {
      rootFolderId: String(barNode?.id || '1'),
      nodes: barNode?.children || []
    }
  }

  return {
    rootFolderId: '1',
    nodes: []
  }
}

const applyTheme = (value) => {
  theme.value = value === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme.value)
}

const initTheme = () => {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved)
    return
  }

  const preferDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  applyTheme(preferDark ? 'dark' : 'light')
}

const toggleTheme = () => {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  localStorage.setItem(THEME_KEY, next)
}

const initMinimalMode = () => {
  minimalMode.value = localStorage.getItem(MINIMAL_MODE_KEY) === 'true'
}

const toggleMinimalMode = () => {
  minimalMode.value = !minimalMode.value
  localStorage.setItem(MINIMAL_MODE_KEY, String(minimalMode.value))
}

const initBackgroundSettings = () => {
  backgroundSettings.value = loadBackgroundSettings()
}

const openBackgroundSettings = () => {
  closeContextMenu()
  backgroundDraft.value = { ...backgroundSettings.value }
  backgroundError.value = ''
  backgroundSettingsOpen.value = true
}

const closeBackgroundSettings = () => {
  backgroundSettingsOpen.value = false
  backgroundError.value = ''
}

const persistBackgroundSettings = (nextSettings) => {
  const saved = saveBackgroundSettings(nextSettings)
  backgroundSettings.value = saved
  backgroundDraft.value = { ...saved }
  backgroundError.value = ''
  return saved
}

const saveBackgroundSettingsForm = () => {
  const nextImageUrl = backgroundDraft.value.imageUrl.trim()

  if (backgroundDraft.value.enabled && !nextImageUrl) {
    backgroundError.value = '请先填写背景图地址或上传图片。'
    return
  }

  persistBackgroundSettings({
    ...backgroundDraft.value,
    imageUrl: nextImageUrl,
    enabled: backgroundDraft.value.enabled || Boolean(nextImageUrl)
  })
  closeBackgroundSettings()
}

const clearBackgroundImage = () => {
  const cleared = clearBackgroundSettings()
  backgroundSettings.value = cleared
  backgroundDraft.value = { ...cleared }
  backgroundError.value = ''
}

const triggerBackgroundUpload = () => {
  backgroundFileInput.value?.click?.()
}

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('读取图片失败。'))
    reader.readAsDataURL(file)
  })

const handleBackgroundUpload = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''

  if (!file) {
    return
  }

  if (!file.type.startsWith('image/')) {
    backgroundError.value = '请选择图片文件。'
    return
  }

  try {
    const dataUrl = await readFileAsDataUrl(file)
    backgroundDraft.value.imageUrl = dataUrl
    backgroundDraft.value.enabled = true
    backgroundError.value = ''
  } catch (error) {
    backgroundError.value = error instanceof Error ? error.message : '读取图片失败。'
  }
}

const syncStatusForMode = () => {
  if (hasChromeBookmarks()) {
    status.value = '已连接 Chrome 书签。'
    warning.value = ''
    return
  }

  status.value = 'Chrome 书签接口暂不可用，展示演示数据。'
  warning.value = ''
}

const loadBookmarks = async () => {
  loading.value = true

  if (!hasChromeBookmarks()) {
    bookmarkTree.value = JSON.parse(JSON.stringify(fallbackTree))
    chromeRootFolderId.value = ''
    syncStatusForMode()
    loading.value = false
    return
  }

  try {
    const { nodes, rootFolderId } = await loadBookmarksFromChrome()
    bookmarkTree.value = nodes
    chromeRootFolderId.value = rootFolderId
    syncStatusForMode()
  } catch (error) {
    console.error('bookmark fetch failed', error)
    status.value = '读取书签失败，显示演示内容。'
    warning.value = '检查 Chrome 权限后重新打开新标签页即可。'
    bookmarkTree.value = JSON.parse(JSON.stringify(fallbackTree))
    chromeRootFolderId.value = ''
  } finally {
    loading.value = false
  }
}

const getChromeNodeOps = () => {
  const api = window.chrome?.bookmarks
  return {
    update: (id, title) =>
      wrapChromeCallback((resolve) => api.update(id, { title }, resolve)),
    remove: (id) => wrapChromeCallback((resolve) => api.remove(id, resolve)),
    removeTree: (id) => wrapChromeCallback((resolve) => api.removeTree(id, resolve)),
    move: (id, destination = {}) =>
      wrapChromeCallback((resolve) => api.move(id, destination, resolve))
  }
}

const openBookmarkUrl = (url) => {
  if (!url) {
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const deleteNode = async (node) => {
  if (!node?.id) {
    return false
  }

  const targetId = String(node.id)

  try {
    if (hasChromeBookmarks()) {
      const ops = getChromeNodeOps()
      if (hasChildren(node)) {
        await ops.removeTree(targetId)
      } else {
        await ops.remove(targetId)
      }
    }

    bookmarkTree.value = pruneNodesByIds(bookmarkTree.value, [targetId])
    status.value = `已删除${hasChildren(node) ? '文件夹' : '书签'}「${node.title || '未命名'}」。`
    warning.value = hasChromeBookmarks() ? '' : '当前为演示数据，删除仅在页面内生效。'
    if (editingNode.value && String(editingNode.value.id) === targetId) {
      closeEdit()
    }
    closeContextMenu()
    return true
  } catch (error) {
    console.error('delete failed', error)
    status.value = '删除失败。'
    warning.value = error instanceof Error ? error.message : '请检查 Chrome 书签权限。'
    return false
  }
}

const openDeleteConfirm = (node) => {
  if (!node) return
  closeContextMenu()
  deletingNode.value = node
}

const closeDeleteConfirm = () => {
  deletingNode.value = null
}

const confirmDelete = async () => {
  if (!deletingNode.value) {
    return
  }
  const success = await deleteNode(deletingNode.value)
  if (success) {
    closeDeleteConfirm()
  }
}

const openEdit = (node) => {
  closeContextMenu()
  editingNode.value = node
  editingTitle.value = node?.title || ''
  editError.value = ''
}

const closeEdit = () => {
  editingNode.value = null
  editingTitle.value = ''
  editError.value = ''
}

const saveEdit = async () => {
  if (!editingNode.value) {
    return
  }

  const nextTitle = editingTitle.value.trim()
  if (!nextTitle) {
    editError.value = '名称不能为空。'
    return
  }

  const targetId = String(editingNode.value.id)

  try {
    if (hasChromeBookmarks()) {
      const ops = getChromeNodeOps()
      await ops.update(targetId, nextTitle)
    }

    bookmarkTree.value = renameNodeInTree(bookmarkTree.value, targetId, nextTitle)
    status.value = `已重命名为「${nextTitle}」。`
    warning.value = hasChromeBookmarks() ? '' : '当前为演示数据，重命名仅在页面内生效。'
    closeEdit()
  } catch (error) {
    console.error('rename failed', error)
    editError.value = error instanceof Error ? error.message : '重命名失败。'
  }
}

const normalizeParentId = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return String(value)
}

const getChromeMoveParentId = (parentId, fallbackRootId = '') => {
  if (parentId !== null && parentId !== undefined && parentId !== '') {
    return String(parentId)
  }
  return fallbackRootId || undefined
}

const getChromeMoveIndex = (event) => {
  const oldIndex = Number.isInteger(event.oldDraggableIndex) ? event.oldDraggableIndex : event.oldIndex
  const newIndex = Number.isInteger(event.newDraggableIndex) ? event.newDraggableIndex : event.newIndex
  const sourceParentId = normalizeParentId(event.from?.dataset.groupParentId || null)
  const targetParentId = normalizeParentId(event.to?.dataset.groupParentId || null)

  if (!Number.isInteger(newIndex) || newIndex < 0) {
    return null
  }

  if (
    Number.isInteger(oldIndex) &&
    oldIndex >= 0 &&
    sourceParentId === targetParentId &&
    oldIndex < newIndex
  ) {
    return newIndex + 1
  }

  return newIndex
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const nodeContainsId = (node, targetId) => {
  if (!node) {
    return false
  }
  if (String(node.id) === String(targetId)) {
    return true
  }
  if (!hasChildren(node)) {
    return false
  }
  return node.children.some((child) => nodeContainsId(child, targetId))
}

const canMoveNode = (draggedId, targetParentId) => {
  const sourceNode = findNodeById(bookmarkTree.value, draggedId)
  const sourceLocation = getNodeLocation(bookmarkTree.value, draggedId)
  if (!sourceNode) {
    return false
  }
  if (!sourceLocation) {
    return false
  }
  if (!targetParentId) {
    return sourceLocation.parentId === null
  }
  if (String(sourceNode.id) === String(targetParentId)) {
    return false
  }
  return !nodeContainsId(sourceNode, targetParentId)
}

const handleReplaceNodes = ({ parentId, nodes }) => {
  bookmarkTree.value = replaceNodesAtParent(bookmarkTree.value, parentId, nodes)
}

const handleDragEnd = async (event) => {
  closeContextMenu()

  if (!event || !event.item) {
    return
  }

  if (event.from === event.to && event.oldIndex === event.newIndex) {
    return
  }

  const targetId = String(event.item.dataset.nodeId || '')
  if (!targetId) {
    return
  }

  const targetParentId = normalizeParentId(event.to?.dataset.groupParentId || null)
  const nextIndex = Number.isInteger(event.newDraggableIndex) ? event.newDraggableIndex : event.newIndex
  if (!Number.isInteger(nextIndex) || nextIndex < 0) {
    return
  }

  bookmarkTree.value = moveNodeToFinalIndexInTree(bookmarkTree.value, targetId, targetParentId, nextIndex)
  await nextTick()

  try {
    if (hasChromeBookmarks()) {
      const ops = getChromeNodeOps()
      const chromeMoveIndex = getChromeMoveIndex(event)
      if (!Number.isInteger(chromeMoveIndex) || chromeMoveIndex < 0) {
        return
      }
      await ops.move(targetId, {
        parentId: getChromeMoveParentId(targetParentId, chromeRootFolderId.value),
        index: chromeMoveIndex
      })
      await loadBookmarks()
    }

    status.value = '已更新书签顺序。'
    warning.value = hasChromeBookmarks() ? '' : '当前为演示数据，拖拽排序仅在页面内生效。'
  } catch (error) {
    console.error('drag sync failed', error)
    status.value = '同步拖拽结果失败。'
    warning.value = error instanceof Error ? error.message : '请检查 Chrome 书签权限。'
    await loadBookmarks()
  }
}

const openContextMenu = (node, point) => {
  if (!node || !point) {
    return
  }

  const menuWidth = 160
  const menuHeight = 112
  const x = clamp(point.x, 8, window.innerWidth - menuWidth - 8)
  const y = clamp(point.y, 8, window.innerHeight - menuHeight - 8)
  contextMenu.value = { visible: true, x, y, node }
}

const closeContextMenu = () => {
  if (!contextMenu.value.visible) {
    return
  }
  contextMenu.value = { visible: false, x: 0, y: 0, node: null }
}

const handleContextRename = () => {
  if (!contextNode.value) return
  openEdit(contextNode.value)
}

const handleContextDelete = () => {
  if (!contextNode.value) return
  openDeleteConfirm(contextNode.value)
}

watch(editingNode, async (node) => {
  if (!node) {
    return
  }

  await nextTick()
  editInput.value?.focus?.()
  editInput.value?.select?.()
})

onMounted(() => {
  initTheme()
  initMinimalMode()
  initBackgroundSettings()
  void loadBookmarks()
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('scroll', closeContextMenu, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)
})
</script>

<template>
  <main class="page-shell" @click="closeContextMenu">
    <div class="page-backdrop" :class="{ 'is-active': hasBackgroundImage }" :style="pageBackdropStyle"></div>

    <div class="content" :class="{ 'content-with-background': hasBackgroundImage }" :style="contentStyle">
      <header class="topbar">
        <div class="topbar-brand">
          <h1 class="title">书签主页</h1>
        </div>
        <div class="topbar-actions">
          <button class="theme-toggle" type="button" @click="openBackgroundSettings">
            {{ hasBackgroundImage ? '更换背景图' : '设置背景图' }}
          </button>
          <button class="theme-toggle" type="button" @click="toggleMinimalMode">
            {{ minimalMode ? '缩略图模式' : '极简模式' }}
          </button>
          <button class="theme-toggle" type="button" @click="toggleTheme">
            {{ theme === 'dark' ? '浅色模式' : '深色模式' }}
          </button>
        </div>
      </header>

      <div v-if="loading" class="status">
        <span class="pulse"></span>
        {{ status }}
      </div>

      <p v-if="warning" class="warning">{{ warning }}</p>

      <div v-if="!loading && bookmarkTree.length" class="modules">
        <BookmarkGroup
          :nodes="bookmarkTree"
          :parent-id="null"
          :depth="0"
          :minimal-mode="minimalMode"
          :can-move="canMoveNode"
          @drag-end="handleDragEnd"
          @open-bookmark="openBookmarkUrl"
          @open-context-menu="openContextMenu"
          @replace-nodes="handleReplaceNodes"
        />
      </div>

      <p v-else-if="!loading" class="empty">暂无书签，请先在 Chrome 中添加内容。</p>
    </div>

    <div v-if="backgroundSettingsOpen" class="modal-overlay" @click.self="closeBackgroundSettings">
      <div class="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-label="配置背景图">
        <div class="modal-header">
          <h3 class="modal-title">配置背景图</h3>
          <button class="modal-close" type="button" @click="closeBackgroundSettings">×</button>
        </div>

        <p class="modal-meta">支持图片地址或本地上传，保存后会持久化到本地。</p>

        <div class="background-settings-layout">
          <section class="background-settings-panel">
            <label class="modal-field">
              <span>图片地址</span>
              <input
                v-model="backgroundDraft.imageUrl"
                type="url"
                placeholder="https://example.com/background.jpg"
                spellcheck="false"
              />
            </label>

            <div class="background-actions">
              <button class="action-button" type="button" @click="triggerBackgroundUpload">上传本地图片</button>
              <button class="action-button" type="button" @click="clearBackgroundImage">清除背景</button>
            </div>
          </section>

          <section class="background-settings-panel background-settings-panel-controls">
            <label class="modal-field modal-field-range">
              <span>背景显示强度</span>
              <div class="range-row">
                <input v-model.number="backgroundDraft.opacity" type="range" min="0.2" max="1" step="0.01" />
                <strong>{{ Math.round(backgroundDraft.opacity * 100) }}%</strong>
              </div>
            </label>

            <label class="modal-field modal-field-range">
              <span>磨砂强度</span>
              <div class="range-row">
                <input v-model.number="backgroundDraft.backdropBlur" type="range" min="0" max="24" step="1" />
                <strong>{{ Math.round(backgroundDraft.backdropBlur) }}px</strong>
              </div>
            </label>

            <label class="background-switch">
              <input v-model="backgroundDraft.enabled" type="checkbox" />
              <span>启用背景图</span>
            </label>
          </section>
        </div>

        <div v-if="backgroundPreviewStyle.backgroundImage" class="background-preview" :style="backgroundPreviewStyle"></div>

        <p v-if="backgroundError" class="modal-error">{{ backgroundError }}</p>

        <div class="modal-actions">
          <button class="action-button" type="button" @click="closeBackgroundSettings">取消</button>
          <button class="action-button action-button-primary" type="button" @click="saveBackgroundSettingsForm">
            保存
          </button>
        </div>

        <input
          ref="backgroundFileInput"
          class="visually-hidden"
          type="file"
          accept="image/*"
          @change="handleBackgroundUpload"
        />
      </div>
    </div>

    <div v-if="editingNode" class="modal-overlay" @click.self="closeEdit">
      <div class="modal-card" role="dialog" aria-modal="true" :aria-label="`重命名${editingKind}`">
        <div class="modal-header">
          <h3 class="modal-title">重命名{{ editingKind }}</h3>
          <button class="modal-close" type="button" @click="closeEdit">×</button>
        </div>

        <p class="modal-meta">{{ editingNode.title || `未命名${editingKind}` }}</p>

        <label class="modal-field">
          <span>名称</span>
          <input
            ref="editInput"
            v-model="editingTitle"
            type="text"
            spellcheck="false"
            @keydown.enter.prevent="saveEdit"
          />
        </label>

        <p v-if="editError" class="modal-error">{{ editError }}</p>

        <div class="modal-actions">
          <button class="action-button" type="button" @click="closeEdit">取消</button>
          <button class="action-button action-button-primary" type="button" @click="saveEdit">
            保存
          </button>
        </div>
      </div>
    </div>

    <div v-if="deletingNode" class="modal-overlay" @click.self="closeDeleteConfirm">
      <div class="modal-card" role="dialog" aria-modal="true" :aria-label="`删除${deletingKind}`">
        <div class="modal-header">
          <h3 class="modal-title">确认删除{{ deletingKind }}</h3>
          <button class="modal-close" type="button" @click="closeDeleteConfirm">×</button>
        </div>

        <p class="modal-meta">
          将删除{{ deletingKind }}「{{ deletingNode.title || `未命名${deletingKind}` }}」。
          {{ hasChildren(deletingNode) ? '此操作会同时删除其下全部内容。' : '此操作不可撤销。' }}
        </p>

        <div class="modal-actions">
          <button class="action-button" type="button" @click="closeDeleteConfirm">取消</button>
          <button class="action-button action-button-danger" type="button" @click="confirmDelete">
            确认删除
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="contextMenu.visible && contextNode"
      class="context-menu"
      :style="contextMenuStyle"
      @click.stop
    >
      <button class="context-menu-item" type="button" @click="handleContextRename">
        重命名{{ contextKind }}
      </button>
      <button class="context-menu-item context-menu-item-danger" type="button" @click="handleContextDelete">
        删除{{ contextKind }}
      </button>
    </div>
  </main>
</template>
