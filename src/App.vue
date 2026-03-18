<script setup>
import { computed, onMounted, ref } from 'vue'
import BookmarkGroup from './components/BookmarkGroup.vue'

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
const THEME_KEY = 'bookmark-theme'

const hasChildren = (node) => Boolean(node?.children?.length)
const groupedModules = computed(() => {
  const modules = []
  const loose = []

  for (const node of bookmarkTree.value) {
    if (hasChildren(node)) {
      modules.push({
        id: `module-${node.id}`,
        title: node.title || '未命名目录',
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
      nodes: loose
    })
  }

  if (!modules.length && bookmarkTree.value.length) {
    modules.push({
      id: 'module-all',
      title: '全部书签',
      nodes: bookmarkTree.value
    })
  }

  return modules
})

const hasChromeBookmarks = () => typeof window !== 'undefined' && Boolean(window.chrome?.bookmarks)
const isBookmarkBar = (node) => {
  if (!node) return false
  if (String(node.id) === '1') return true
  const title = (node.title || '').toLowerCase()
  return ['书签栏', 'bookmarks bar', 'bookmark bar'].includes(title)
}

const loadBookmarks = () => {
  if (!hasChromeBookmarks()) {
    status.value = 'Chrome 书签接口暂不可用，展示演示数据。'
    warning.value = '请在 Chrome 新标签页里打开此扩展以读取真实书签。'
    bookmarkTree.value = fallbackTree[0]?.children || []
    loading.value = false
    return
  }

  try {
    window.chrome.bookmarks.getTree((tree) => {
      const root = Array.isArray(tree) ? tree[0] : null
      if (root?.children?.length) {
        const barNode = root.children.find(isBookmarkBar)
        bookmarkTree.value = barNode?.children || []
      } else if (Array.isArray(tree)) {
        const barNode = tree.find(isBookmarkBar)
        bookmarkTree.value = barNode?.children || []
      }
      loading.value = false
    })
  } catch (error) {
    console.error('bookmark fetch failed', error)
    status.value = '读取书签失败，显示演示内容。'
    warning.value = '检查 Chrome 权限后重新打开新标签页即可。'
    bookmarkTree.value = fallbackTree[0]?.children || []
    loading.value = false
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

onMounted(() => {
  initTheme()
  loadBookmarks()
})
</script>

<template>
  <main class="content">
    <header class="topbar">
      <h1 class="title">书签主页</h1>
      <button class="theme-toggle" type="button" @click="toggleTheme">
        {{ theme === 'dark' ? '浅色模式' : '深色模式' }}
      </button>
    </header>
    <div v-if="loading" class="status">
      <span class="pulse"></span>
      {{ status }}
    </div>
    <p v-if="warning" class="warning">{{ warning }}</p>
    <div v-if="!loading && groupedModules.length" class="modules">
      <section v-for="module in groupedModules" :key="module.id" class="module-section">
        <h2 class="module-title">{{ module.title }}</h2>
        <div class="module-body">
          <BookmarkGroup :nodes="module.nodes" />
        </div>
      </section>
    </div>
    <p v-else-if="!loading" class="empty">暂无书签，请先在 Chrome 中添加内容。</p>
  </main>
</template>
