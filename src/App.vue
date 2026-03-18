<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BookmarkGroup from './components/BookmarkGroup.vue'
import {
  findNodeById,
  hasChildren,
  moveNodeInTree,
  pruneNodesByIds,
  renameNodeInTree
} from './utils/bookmarkTree'

const fallbackTree = [
  {
    id: 'demo-bookmark-bar',
    title: '书签栏',
    children: [
      { id: 'b1', title: 'Vue 官方', url: 'https://vuejs.org/' },
      { id: 'b2', title: 'Vite 文档', url: 'https://vitejs.dev/guide/' },
      {
        id: 'b3',
        title: '设计灵感',
        children: [
          { id: 'b3-1', title: 'Dribbble', url: 'https://dribbble.com/' },
          { id: 'b3-2', title: 'Behance', url: 'https://www.behance.net/' }
        ]
      }
    ]
  },
  {
    id: 'demo-other',
    title: '其他书签',
    children: [
      { id: 'o1', title: 'Chrome 扩展文档', url: 'https://developer.chrome.com/docs/extensions/' },
      { id: 'o2', title: 'MDN CSS', url: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS' },
      {
        id: 'o3',
        title: '生产力工具',
        children: [
          { id: 'o3-1', title: 'Notion', url: 'https://www.notion.so/' },
          { id: 'o3-2', title: 'Miro', url: 'https://miro.com/' }
        ]
      }
    ]
  },
  {
    id: 'demo-quick',
    title: '快速访问',
    children: [
      { id: 'q1', title: '邮箱', url: 'https://mail.google.com/' },
      { id: 'q2', title: '待办', url: 'https://todoist.com/' }
    ]
  }
]

const bookmarkTree = ref([])
const loading = ref(true)
const status = ref('正在加载书签……')
const warning = ref('')
const theme = ref('light')
const draggingId = ref('')
const dropTargetId = ref('')
const editingNode = ref(null)
const editingTitle = ref('')
const editError = ref('')
const editInput = ref(null)
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null
})
const THEME_KEY = 'bookmark-theme'
const editingKind = computed(() => {
  if (!editingNode.value) return ''
  return hasChildren(editingNode.value) ? '文件夹' : '书签'
})
const contextNode = computed(() => contextMenu.value.node)
const contextKind = computed(() => (contextNode.value ? (hasChildren(contextNode.value) ? '文件夹' : '书签') : ''))
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`
}))

const groupedModules = computed(() => {
  const modules = []
  const loose = []

  for (const node of bookmarkTree.value) {
    if (hasChildren(node)) {
      modules.push({
        id: `module-${node.id}`,
        title: node.title || '未命名目录',
        node,
        nodes: node.children
      })
    } else {
      loose.push(node)
    }
  }

  if (loose.length) {
    modules.push({
      id: 'module-ungrouped',
      title: '未分类',
      node: null,
      nodes: loose
    })
  }

  return modules
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
    return barNode?.children || []
  }

  if (Array.isArray(tree)) {
    const barNode = tree.find((node) => String(node.id) === '1')
    return barNode?.children || []
  }

  return []
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

const syncStatusForMode = () => {
  if (hasChromeBookmarks()) {
    status.value = '已连接 Chrome 书签。'
    warning.value = ''
    return
  }

  status.value = 'Chrome 书签接口暂不可用，展示演示数据。'
  warning.value = '请在 Chrome 新标签页里打开此扩展以读取真实书签。'
}

const loadBookmarks = async () => {
  loading.value = true

  if (!hasChromeBookmarks()) {
    bookmarkTree.value = JSON.parse(JSON.stringify(fallbackTree))
    syncStatusForMode()
    loading.value = false
    return
  }

  try {
    const tree = await loadBookmarksFromChrome()
    bookmarkTree.value = tree
    syncStatusForMode()
  } catch (error) {
    console.error('bookmark fetch failed', error)
    status.value = '读取书签失败，显示演示内容。'
    warning.value = '检查 Chrome 权限后重新打开新标签页即可。'
    bookmarkTree.value = JSON.parse(JSON.stringify(fallbackTree))
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
    move: (id, targetFolderId) =>
      wrapChromeCallback((resolve) => api.move(id, { parentId: targetFolderId }, resolve))
  }
}

const deleteNode = async (node) => {
  if (!node?.id) {
    return
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
  } catch (error) {
    console.error('delete failed', error)
    status.value = '删除失败。'
    warning.value = error instanceof Error ? error.message : '请检查 Chrome 书签权限。'
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

const moveNodeToFolder = async (sourceId, targetFolderId) => {
  const sourceNode = findNodeById(bookmarkTree.value, sourceId)
  const targetNode = findNodeById(bookmarkTree.value, targetFolderId)

  if (!sourceNode || !targetNode || !hasChildren(targetNode)) {
    return
  }

  if (String(sourceId) === String(targetFolderId)) {
    return
  }

  try {
    if (hasChromeBookmarks()) {
      const ops = getChromeNodeOps()
      await ops.move(sourceId, targetFolderId)
    }

    bookmarkTree.value = moveNodeInTree(bookmarkTree.value, sourceId, targetFolderId)
    status.value = '已移动到目标文件夹。'
    warning.value = hasChromeBookmarks() ? '' : '当前为演示数据，拖拽移动仅在页面内生效。'
  } catch (error) {
    console.error('move failed', error)
    status.value = '移动失败。'
    warning.value = error instanceof Error ? error.message : '请检查 Chrome 书签权限。'
  } finally {
    draggingId.value = ''
    dropTargetId.value = ''
  }
}

const onDragStart = (id) => {
  closeContextMenu()
  draggingId.value = String(id)
  dropTargetId.value = ''
}

const onDragEnd = () => {
  draggingId.value = ''
  dropTargetId.value = ''
}

const onDropTarget = (id) => {
  dropTargetId.value = String(id)
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

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
  void deleteNode(contextNode.value)
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
  <main class="content" @click="closeContextMenu">
    <header class="topbar">
      <div class="topbar-brand">
        <h1 class="title">书签主页</h1>
        <p class="title-subtitle">右键书签或文件夹可重命名/删除</p>
      </div>
      <div class="topbar-actions">
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

    <div v-if="!loading && groupedModules.length" class="modules">
      <section
        v-for="module in groupedModules"
        :key="module.id"
        class="module-section"
        :class="{
          folder: Boolean(module.node),
          dragging: module.node && draggingId === String(module.node.id),
          'drop-target': module.node && dropTargetId === String(module.node.id)
        }"
        @dragenter.prevent="module.node && onDropTarget(module.node.id)"
        @dragover.prevent="module.node && onDropTarget(module.node.id)"
        @drop.prevent="module.node && moveNodeToFolder(draggingId, module.node.id)"
      >
        <div class="module-header">
          <div
            v-if="module.node"
            class="module-header-title"
            draggable="true"
            @dragstart="onDragStart(module.node.id)"
            @dragend="onDragEnd"
            @contextmenu.prevent.stop="openContextMenu(module.node, { x: $event.clientX, y: $event.clientY })"
          >
            <span>{{ module.title }}</span>
          </div>
          <h2 v-else class="module-title">{{ module.title }}</h2>
        </div>

        <div v-if="module.node" class="module-drop-hint">可将书签拖入此文件夹</div>

        <div class="module-body">
          <BookmarkGroup
            :nodes="module.nodes"
            :dragging-id="draggingId"
            :drop-target-id="dropTargetId"
            @drag-start="onDragStart"
            @drag-end="onDragEnd"
            @drop-node="moveNodeToFolder"
            @mark-drop-target="onDropTarget"
            @open-context-menu="openContextMenu"
          />
        </div>
      </section>
    </div>

    <p v-else-if="!loading" class="empty">暂无书签，请先在 Chrome 中添加内容。</p>

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
