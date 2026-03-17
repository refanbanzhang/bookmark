<script setup>
import { computed } from 'vue'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  depth: {
    type: Number,
    default: 0
  }
})

const depth = computed(() => props.depth || 0)
const indent = computed(() => `${depth.value * 16}px`)

const hasChildren = (node) => Boolean(node.children && node.children.length)

const formatHost = (url) => {
  if (!url) return '目录'
  try {
    return new URL(url).hostname.replace(/^www\\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <ul class="bookmark-group" :style="{ marginLeft: indent }">
    <li v-for="node in nodes" :key="node.id">
      <div class="bookmark-row" :class="{ folder: hasChildren(node) }">
        <div class="bookmark-content">
          <span class="bookmark-dot" :class="{ folder: hasChildren(node) }"></span>
          <div class="bookmark-text">
            <a v-if="node.url" :href="node.url" target="_blank" rel="noreferrer">
              {{ node.title || '未命名书签' }}
            </a>
            <span v-else>{{ node.title || '未命名目录' }}</span>
            <span class="bookmark-meta">{{ formatHost(node.url) }}</span>
          </div>
        </div>
      </div>
      <BookmarkGroup
        v-if="hasChildren(node)"
        :nodes="node.children"
        :depth="depth + 1"
      />
    </li>
  </ul>
</template>

<style scoped>
.bookmark-group {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bookmark-row {
  margin-bottom: 10px;
}

.bookmark-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 16px;
  padding: 14px 18px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.bookmark-row:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.35);
}

.bookmark-row.folder {
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.25);
}

.bookmark-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.6);
  margin-top: 4px;
}

.bookmark-dot.folder {
  background: #2563eb;
}

.bookmark-text a,
.bookmark-text span {
  display: block;
  font-weight: 600;
  font-size: 17px;
  color: #0f172a;
  text-decoration: none;
}

.bookmark-text span {
  color: #0f172a;
}

.bookmark-text a:hover {
  color: #2563eb;
}

.bookmark-meta {
  display: inline-flex;
  margin-top: 6px;
  font-size: 13px;
  color: #475569;
}

.bookmark-row.folder .bookmark-meta {
  color: #1d4ed8;
}

@media (max-width: 768px) {
  .bookmark-content {
    flex-direction: column;
    gap: 6px;
  }

  .bookmark-row {
    padding: 10px 12px;
  }
}
</style>
