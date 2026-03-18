<script setup>
import { computed, ref, watch } from 'vue'
import { getThumbnailForUrl } from '../utils/thumbnailCache'

defineOptions({ name: 'BookmarkGroup' })

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  parentId: {
    type: [String, Number],
    default: null
  },
  depth: {
    type: Number,
    default: 0
  },
  draggingId: {
    type: [String, Number],
    default: ''
  },
  dropPosition: {
    type: Object,
    default: null
  },
  dropTargetId: {
    type: [String, Number],
    default: ''
  }
})

const emit = defineEmits(['open-context-menu'])

const depth = computed(() => props.depth || 0)
const indent = computed(() => `${depth.value * 12}px`)
const groupRef = ref(null)
const thumbMap = ref({})
const previewStyle = ref(null)
const dragId = computed(() => String(props.draggingId || ''))
const dropId = computed(() => String(props.dropTargetId || ''))
const hasActiveDrag = computed(() => Boolean(dragId.value))
const parentId = computed(() =>
  props.parentId === null || props.parentId === undefined || props.parentId === ''
    ? null
    : String(props.parentId)
)

const hasChildren = (node) => Boolean(node?.children?.length)
const isDragging = (id) => dragId.value === String(id)
const isDropTarget = (id) => dropId.value === String(id)
const previewIndex = computed(() => {
  const position = props.dropPosition
  if (!position || !dragId.value) {
    return -1
  }

  const positionParent =
    position.parentId === null || position.parentId === undefined || position.parentId === ''
      ? null
      : String(position.parentId)
  if (positionParent !== parentId.value) {
    return -1
  }

  const nextIndex = Number.isFinite(Number(position.index)) ? Number(position.index) : -1
  if (nextIndex < 0) {
    return -1
  }

  return Math.max(0, Math.min(props.nodes.length, Math.trunc(nextIndex)))
})
const hasDropPreview = computed(() => previewIndex.value >= 0)

const clearPreviewStyle = () => {
  previewStyle.value = null
}

const getDefaultPreviewSize = () => {
  if (typeof window === 'undefined') {
    return 124
  }
  return window.innerWidth <= 768 ? 104 : 124
}

const buildPreviewStyle = (index) => {
  const container = groupRef.value
  if (!container) {
    return null
  }

  const containerRect = container.getBoundingClientRect()
  const cards = Array.from(container.querySelectorAll(':scope > li > .bookmark-row > .bookmark-content'))
  if (!cards.length) {
    const size = getDefaultPreviewSize()
    return {
      left: '0px',
      top: '0px',
      width: `${size}px`,
      height: `${size}px`
    }
  }

  const gap = 8
  const firstRect = cards[0].getBoundingClientRect()
  const previewWidth = cards[0].offsetWidth || firstRect.width
  const previewHeight = cards[0].offsetHeight || firstRect.height
  const maxLeft = Math.max(0, container.clientWidth - previewWidth)

  if (index < cards.length) {
    const rect = cards[index].getBoundingClientRect()
    return {
      left: `${Math.max(0, Math.min(maxLeft, rect.left - containerRect.left))}px`,
      top: `${rect.top - containerRect.top}px`,
      width: `${previewWidth}px`,
      height: `${previewHeight}px`
    }
  }

  const lastRect = cards[cards.length - 1].getBoundingClientRect()
  const candidateLeft = lastRect.right - containerRect.left + gap
  const fitsSameRow = candidateLeft + previewWidth <= container.clientWidth

  return {
    left: `${fitsSameRow ? Math.max(0, Math.min(maxLeft, candidateLeft)) : 0}px`,
    top: `${fitsSameRow ? lastRect.top - containerRect.top : lastRect.bottom - containerRect.top + gap}px`,
    width: `${previewWidth}px`,
    height: `${previewHeight}px`
  }
}

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

watch(
  () => dragId.value,
  (id) => {
    if (!id) {
      clearPreviewStyle()
    }
  }
)

watch(
  () => previewIndex.value,
  (index) => {
    if (index < 0) {
      clearPreviewStyle()
      return
    }
    previewStyle.value = buildPreviewStyle(index)
  }
)

const onContextMenu = (node, event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('open-context-menu', node, { x: event.clientX, y: event.clientY })
}
const forwardOpenContextMenu = (node, point) => emit('open-context-menu', node, point)
</script>

<template>
  <ul
    ref="groupRef"
    class="bookmark-group"
    :class="{ 'drag-active': hasActiveDrag }"
    :style="{ marginLeft: indent }"
    :data-group-parent-id="parentId ?? ''"
  >
    <li
      v-if="hasDropPreview && previewStyle"
      class="bookmark-drop-preview"
      :style="previewStyle"
      aria-hidden="true"
    />
    <template v-for="(node, index) in nodes" :key="node.id">
      <li>
        <div
          class="bookmark-row"
          :class="{
            folder: hasChildren(node),
            dragging: isDragging(node.id),
            'drop-target': isDropTarget(node.id)
          }"
        >
          <div
            class="bookmark-content"
            :data-drag-id="String(node.id)"
            :data-drop-node-id="String(node.id)"
            :data-parent-id="parentId ?? ''"
            :data-index="String(index)"
            :data-has-children="hasChildren(node) ? 'true' : 'false'"
            @contextmenu="onContextMenu(node, $event)"
          >
            <a
              v-if="node.url && thumbMap[node.id]"
              class="bookmark-thumb-link bookmark-thumb-wrap"
              :href="node.url"
              target="_blank"
              rel="noreferrer"
              draggable="false"
              :style="{ '--thumb-bg': `url('${thumbMap[node.id]}')` }"
              @click.stop
            >
              <img
                class="bookmark-thumb"
                :src="thumbMap[node.id]"
                :alt="node.title || '缩略图'"
                draggable="false"
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
              draggable="false"
              @click.stop
            >
              ...
            </a>
            <div v-else class="bookmark-thumb folder-thumb">DIR</div>

            <div class="bookmark-text">
              <a v-if="node.url" :href="node.url" target="_blank" rel="noreferrer" draggable="false" @click.stop>
                {{ node.title || '未命名书签' }}
              </a>
              <span v-else>{{ node.title || '未命名目录' }}</span>
            </div>
          </div>
        </div>
        <BookmarkGroup
          v-if="hasChildren(node)"
          :nodes="node.children"
          :parent-id="node.id"
          :depth="depth + 1"
          :dragging-id="draggingId"
          :drop-position="dropPosition"
          :drop-target-id="dropTargetId"
          @open-context-menu="forwardOpenContextMenu"
        />
      </li>
    </template>
  </ul>
</template>

<style scoped>
.bookmark-group {
  --bookmark-thumb-height: 70px;
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.bookmark-group :deep(li) {
  list-style: none;
}

.bookmark-group > li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.bookmark-row {
  position: relative;
  z-index: 1;
  transform: scale(1);
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
}

.bookmark-row.dragging {
  transform: scale(0.93);
  z-index: 4;
}

.bookmark-row.drop-target {
  z-index: 3;
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
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    outline-color 0.16s ease,
    transform 0.12s ease;
  cursor: grab;
  touch-action: none;
}

.bookmark-row.dragging .bookmark-content {
  opacity: 0.24;
  transform: none;
}

.bookmark-row.drop-target .bookmark-content {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2), var(--bookmark-hover-shadow);
}

.bookmark-content:hover {
  border-color: var(--bookmark-hover-border);
  box-shadow: var(--bookmark-hover-shadow);
  transform: translateY(-2px);
}

.bookmark-group.drag-active .bookmark-content:hover {
  border-color: var(--bookmark-card-border);
  box-shadow: var(--bookmark-card-shadow);
  transform: none;
}

.bookmark-row.folder .bookmark-content {
  background: var(--folder-card-bg);
  border-color: var(--folder-card-border);
}

.bookmark-thumb {
  width: 100%;
  height: 100%;
  display: block;
  max-width: 100%;
  max-height: 100%;
  margin: 0;
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
  height: var(--bookmark-thumb-height);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: 1px solid var(--thumb-border);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    var(--thumb-inset);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  background: var(--thumb-surface);
  contain: paint;
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

.bookmark-text a:hover {
  color: var(--bookmark-link-hover);
}

.bookmark-row.folder .bookmark-text > span:first-child {
  color: var(--folder-title-text);
}

.bookmark-drop-preview {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  list-style: none;
  border-radius: 3px;
  border: 1px dashed rgba(37, 99, 235, 0.36);
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.04) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(37, 99, 235, 0.08),
    0 8px 18px rgba(37, 99, 235, 0.08);
  backdrop-filter: blur(4px);
}

.bookmark-group.drag-active .bookmark-thumb-wrap {
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.bookmark-group.drag-active .bookmark-thumb-wrap::before,
.bookmark-group.drag-active .bookmark-thumb-wrap::after {
  display: none;
}

@media (max-width: 768px) {
  .bookmark-content {
    width: 104px;
    height: 104px;
    padding: 8px;
  }

  .bookmark-text a,
  .bookmark-text span {
    font-size: 12px;
  }

}
</style>
