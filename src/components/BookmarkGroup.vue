<script setup>
import { computed, ref, watch } from 'vue'
import { getThumbnailForUrl } from '../utils/thumbnailCache'

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
const indent = computed(() => `${depth.value * 12}px`)

const hasChildren = (node) => Boolean(node.children && node.children.length)
const thumbMap = ref({})

const loadThumb = async (node) => {
  if (!node?.url) return
  const src = await getThumbnailForUrl(node.url)
  if (src) {
    thumbMap.value[node.id] = src
  }
}

watch(
  () => props.nodes,
  (nodes) => {
    for (const node of nodes || []) {
      loadThumb(node)
    }
  },
  { immediate: true }
)
</script>

<template>
  <ul class="bookmark-group" :style="{ marginLeft: indent }">
    <li v-for="node in nodes" :key="node.id">
      <div class="bookmark-row" :class="{ folder: hasChildren(node) }">
        <div class="bookmark-content">
          <a
            v-if="node.url && thumbMap[node.id]"
            class="bookmark-thumb-link bookmark-thumb-wrap"
            :href="node.url"
            target="_blank"
            rel="noreferrer"
            :style="{ '--thumb-bg': `url('${thumbMap[node.id]}')` }"
          >
            <img
              class="bookmark-thumb"
              :src="thumbMap[node.id]"
              :alt="node.title || '缩略图'"
              loading="lazy"
              decoding="async"
            />
          </a>
          <a
            v-else-if="node.url"
            class="bookmark-thumb-link bookmark-thumb thumb-placeholder"
            :href="node.url"
            target="_blank"
            rel="noreferrer"
          >
            ...
          </a>
          <div v-else class="bookmark-thumb folder-thumb">DIR</div>
          <div class="bookmark-text">
            <a v-if="node.url" :href="node.url" target="_blank" rel="noreferrer">
              {{ node.title || '未命名书签' }}
            </a>
            <span v-else>{{ node.title || '未命名目录' }}</span>
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
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.bookmark-group > li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.bookmark-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 8px;
  background: var(--bookmark-card-bg);
  border: 1px solid var(--bookmark-card-border);
  border-radius: 3px;
  width: 124px;
  height: 124px;
  padding: 10px;
  box-shadow: var(--bookmark-card-shadow);
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.bookmark-thumb {
  width: 100%;
  height: 62px;
  padding: 6px;
  object-fit: contain;
  object-position: center;
  position: relative;
  z-index: 1;
}

.bookmark-thumb-link {
  display: block;
  text-decoration: none;
}

.bookmark-thumb-wrap {
  width: 100%;
  height: 62px;
  border: 1px solid var(--thumb-border);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    var(--thumb-inset);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  background: var(--thumb-surface);
}

.bookmark-thumb-wrap::before {
  content: '';
  position: absolute;
  inset: -20%;
  background-image: var(--thumb-bg);
  background-size: cover;
  background-position: center;
  filter: blur(12px) saturate(1.1);
  transform: scale(1.2);
  opacity: 0.75;
}

.bookmark-thumb-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.06) 100%);
}

.folder-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--thumb-border);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    var(--thumb-inset);
  border-radius: 3px;
  font-size: 12px;
  font-weight: 700;
  color: var(--folder-thumb-text);
  background: var(--folder-thumb-bg);
}

.thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--thumb-border);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    var(--thumb-inset);
  border-radius: 3px;
  color: var(--thumb-placeholder-text);
  font-size: 12px;
  font-weight: 600;
  background: var(--thumb-placeholder-bg);
}

.bookmark-content:hover {
  transform: translateY(-2px);
  border-color: var(--bookmark-hover-border);
  box-shadow: var(--bookmark-hover-shadow);
}

.bookmark-row.folder .bookmark-content {
  background: var(--folder-card-bg);
  border-color: var(--folder-card-border);
}

.bookmark-text {
  min-width: 0;
  width: 100%;
  flex: 1;
}

.bookmark-text a,
.bookmark-text span {
  display: block;
  font-weight: 600;
  font-size: 13px;
  line-height: 1.2;
  color: var(--bookmark-text);
  text-decoration: none;
  word-break: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bookmark-text span {
  color: var(--bookmark-text);
}

.bookmark-text a:hover {
  color: var(--bookmark-link-hover);
}

.bookmark-row.folder .bookmark-text > span:first-child {
  color: var(--folder-title-text);
}

@media (max-width: 768px) {
  .bookmark-content {
    width: 104px;
    height: 104px;
    padding: 8px;
  }

  .bookmark-thumb {
    height: 48px;
  }

  .bookmark-thumb-wrap {
    height: 48px;
  }

  .bookmark-text a,
  .bookmark-text span {
    display: block;
  }

}
</style>
