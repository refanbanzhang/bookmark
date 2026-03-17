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

const summarizeTree = (nodes) => {
  return nodes.reduce(
    (acc, node) => {
      if (node?.children?.length) {
        acc.folders += 1
        const childSummary = summarizeTree(node.children)
        acc.folders += childSummary.folders
        acc.bookmarks += childSummary.bookmarks
      } else if (node?.url) {
        acc.bookmarks += 1
      }
      return acc
    },
    { folders: 0, bookmarks: 0 }
  )
}

const summary = computed(() => summarizeTree(bookmarkTree.value))

const hasChromeBookmarks = () => typeof window !== 'undefined' && Boolean(window.chrome?.bookmarks)

const loadBookmarks = () => {
  if (!hasChromeBookmarks()) {
    status.value = 'Chrome 书签接口暂不可用，展示演示数据。'
    warning.value = '请在 Chrome 新标签页里打开此扩展以读取真实书签。'
    bookmarkTree.value = fallbackTree
    loading.value = false
    return
  }

  try {
    window.chrome.bookmarks.getTree((tree) => {
      const root = Array.isArray(tree) ? tree[0] : null
      if (root?.children?.length) {
        bookmarkTree.value = root.children
      } else if (Array.isArray(tree)) {
        bookmarkTree.value = tree
      }
      loading.value = false
    })
  } catch (error) {
    console.error('bookmark fetch failed', error)
    status.value = '读取书签失败，显示演示内容。'
    warning.value = '检查 Chrome 权限后重新打开新标签页即可。'
    bookmarkTree.value = fallbackTree
    loading.value = false
  }
}

onMounted(loadBookmarks)
</script>

<template>
  <div class="page-shell">
    <header class="hero">
      <p class="eyebrow">Chrome 启动页 · 书签</p>
      <h1>按目录结构浏览你的书签</h1>
      <p class="lead">
        这一页会读取 Chrome 书签树，并以文件夹为单位分组，让你在新标签页里快速找到想看的链接。
      </p>
      <div class="hero-stats">
        <span class="chip">
          <strong>{{ summary.folders }}</strong>
          <small>个目录</small>
        </span>
        <span class="chip secondary">
          <strong>{{ summary.bookmarks }}</strong>
          <small>个书签</small>
        </span>
      </div>
    </header>
    <main class="content">
      <div v-if="loading" class="status">
        <span class="pulse"></span>
        {{ status }}
      </div>
      <p v-if="warning" class="warning">{{ warning }}</p>
      <BookmarkGroup v-if="!loading && bookmarkTree.length" :nodes="bookmarkTree" />
      <p v-else-if="!loading" class="empty">暂无书签，请先在 Chrome 中添加内容。</p>
      <div v-if="!loading" class="footer-note">
        点击书签会在新标签页里打开，文件夹左侧的圆点会帮助你分辨图标。
      </div>
    </main>
  </div>
</template>
