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
const indent = computed(() => `${depth.value * 12}px`)

const hasChildren = (node) => Boolean(node.children && node.children.length)
const getScreenshot = (url) => {
  if (!url) return ''
  return `https://image.thum.io/get/width/320/crop/200/noanimate/${encodeURIComponent(url)}`
}

const getFavicon = (url) => {
  if (!url) return ''
  return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(url)}`
}

const onThumbError = (event, url) => {
  const img = event.target
  if (!img || !url) return
  if (img.dataset.fallback === '1') {
    img.style.display = 'none'
    return
  }
  img.dataset.fallback = '1'
  img.src = getFavicon(url)
}
</script>

<template>
  <ul class="bookmark-group" :style="{ marginLeft: indent }">
    <li v-for="node in nodes" :key="node.id">
      <div class="bookmark-row" :class="{ folder: hasChildren(node) }">
        <div class="bookmark-content">
          <img
            v-if="node.url"
            class="bookmark-thumb"
            :src="getScreenshot(node.url)"
            :alt="node.title || '缩略图'"
            loading="lazy"
            decoding="async"
            @error="(event) => onThumbError(event, node.url)"
          />
          <div v-else class="bookmark-thumb folder-thumb">DIR</div>
          <span class="bookmark-dot" :class="{ folder: hasChildren(node) }"></span>
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
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.11);
  border-radius: 0;
  width: 124px;
  height: 124px;
  padding: 10px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07);
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.bookmark-thumb {
  width: 100%;
  height: 62px;
  object-fit: cover;
  object-position: top center;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: #f8fafc;
}

.folder-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
  background: linear-gradient(180deg, #eaf3ff 0%, #f8fbff 100%);
}

.bookmark-content:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.42);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.16);
}

.bookmark-row.folder .bookmark-content {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.95) 0%, rgba(255, 255, 255, 0.98) 100%);
  border-color: rgba(37, 99, 235, 0.24);
}

.bookmark-dot {
  width: 8px;
  height: 8px;
  border-radius: 0;
  background: rgba(37, 99, 235, 0.5);
  flex-shrink: 0;
}

.bookmark-dot.folder {
  background: #2563eb;
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
  color: #0f172a;
  text-decoration: none;
  word-break: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bookmark-text span {
  color: #0f172a;
}

.bookmark-text a:hover {
  color: #2563eb;
}

.bookmark-row.folder .bookmark-text > span:first-child {
  color: #1d4ed8;
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

  .bookmark-text a,
  .bookmark-text span {
    display: block;
  }

}
</style>
