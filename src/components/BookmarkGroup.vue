<script setup>
import { computed, ref, watch } from 'vue'
import { getThumbnailForUrl } from '../utils/thumbnailCache'

defineOptions({ name: 'BookmarkGroup' })

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  depth: {
    type: Number,
    default: 0
  },
  draggingId: {
    type: [String, Number],
    default: ''
  },
  dropTargetId: {
    type: [String, Number],
    default: ''
  }
})

const emit = defineEmits(['drag-start', 'drag-end', 'drop-node', 'mark-drop-target', 'open-context-menu'])

const depth = computed(() => props.depth || 0)
const indent = computed(() => `${depth.value * 12}px`)
const thumbMap = ref({})
const dragId = computed(() => String(props.draggingId || ''))
const dropId = computed(() => String(props.dropTargetId || ''))

const hasChildren = (node) => Boolean(node?.children?.length)
const isDragging = (id) => dragId.value === String(id)
const isDropTarget = (id) => dropId.value === String(id)
const dragIndex = computed(() => props.nodes.findIndex((node) => String(node.id) === dragId.value))
const dropIndex = computed(() => props.nodes.findIndex((node) => String(node.id) === dropId.value))
const hasDropPreview = computed(() => dragId.value && dropId.value && dropIndex.value >= 0)

const previewClass = (index) => {
  if (
    !hasDropPreview.value ||
    index === dropIndex.value ||
    index === dragIndex.value
  ) {
    return ''
  }

  if (index < dropIndex.value) {
    return 'shift-before-drop'
  }

  return 'shift-after-drop'
}

const previewStyle = (index) => {
  if (
    !hasDropPreview.value ||
    index === dropIndex.value ||
    index === dragIndex.value
  ) {
    return null
  }

  const distance = Math.max(1, Math.min(4, Math.abs(index - dropIndex.value)))
  const direction = index < dropIndex.value ? -1 : 1
  return {
    '--preview-x': `${direction * distance * 4}px`,
    '--preview-y': `${direction * distance * 2}px`
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

const onDragStart = (node, event) => {
  event.dataTransfer?.setData('text/plain', String(node.id))
  event.dataTransfer?.setDragImage?.(event.currentTarget, 20, 20)
  emit('drag-start', node.id)
}

const onDragEnd = () => {
  emit('drag-end')
}

const onDragEnter = (node) => {
  emit('mark-drop-target', node.id)
}

const onDrop = (node, event) => {
  if (!hasChildren(node)) {
    return
  }

  event.preventDefault()
  emit('drop-node', event.dataTransfer?.getData('text/plain') || '', node.id)
}

const onContextMenu = (node, event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('open-context-menu', node, { x: event.clientX, y: event.clientY })
}

const forwardDragStart = (id) => emit('drag-start', id)
const forwardDragEnd = () => emit('drag-end')
const forwardDropNode = (sourceId, targetId) => emit('drop-node', sourceId, targetId)
const forwardMarkDropTarget = (id) => emit('mark-drop-target', id)
const forwardOpenContextMenu = (node, point) => emit('open-context-menu', node, point)
</script>

<template>
  <ul class="bookmark-group" :style="{ marginLeft: indent }">
    <template v-for="(node, index) in nodes" :key="node.id">
      <li>
      <div
        class="bookmark-row"
        :class="[
          {
            folder: hasChildren(node),
            dragging: isDragging(node.id),
            'drop-target': isDropTarget(node.id)
          },
          previewClass(index)
        ]"
        :style="previewStyle(index)"
      >
        <div
          class="bookmark-content"
          draggable="true"
          @dragstart="onDragStart(node, $event)"
          @dragend="onDragEnd"
          @dragenter.prevent.stop="onDragEnter(node)"
          @dragover.prevent.stop="onDragEnter(node)"
          @drop.stop="onDrop(node, $event)"
          @contextmenu="onContextMenu(node, $event)"
        >
          <a
            v-if="node.url && thumbMap[node.id]"
            class="bookmark-thumb-link bookmark-thumb-wrap"
            :href="node.url"
            target="_blank"
            rel="noreferrer"
            :style="{ '--thumb-bg': `url('${thumbMap[node.id]}')` }"
            @click.stop
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
            @click.stop
          >
            ...
          </a>
          <div v-else class="bookmark-thumb folder-thumb">DIR</div>

          <div class="bookmark-text">
            <a v-if="node.url" :href="node.url" target="_blank" rel="noreferrer" @click.stop>
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
        :dragging-id="draggingId"
        :drop-target-id="dropTargetId"
        @drag-start="forwardDragStart"
        @drag-end="forwardDragEnd"
        @drop-node="forwardDropNode"
        @mark-drop-target="forwardMarkDropTarget"
        @open-context-menu="forwardOpenContextMenu"
      />
      </li>
      <li
        v-if="hasDropPreview && dropIndex === index"
        class="bookmark-drop-spacer"
        aria-hidden="true"
      />
    </template>
  </ul>
</template>

<style scoped>
.bookmark-group {
  --bookmark-thumb-height: 70px;
  list-style: none;
  margin: 0;
  padding: 0;
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
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    outline-color 0.16s ease;
  cursor: grab;
  will-change: transform;
}

.bookmark-row.dragging .bookmark-content {
  opacity: 0.28;
  transform: scale(0.94);
}

.bookmark-row.drop-target .bookmark-content {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2), var(--bookmark-hover-shadow);
  transform: translateY(-4px) scale(1.03);
}

.bookmark-content:hover {
  transform: translateY(-2px);
  border-color: var(--bookmark-hover-border);
  box-shadow: var(--bookmark-hover-shadow);
}

.bookmark-row.shift-before-drop .bookmark-content {
  transform: translate(var(--preview-x), var(--preview-y));
}

.bookmark-row.shift-after-drop .bookmark-content {
  transform: translate(var(--preview-x), var(--preview-y));
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

.bookmark-drop-spacer {
  width: 124px;
  height: 124px;
  border-radius: 3px;
  border: 1px dashed rgba(37, 99, 235, 0.32);
  background: rgba(37, 99, 235, 0.06);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.06);
  opacity: 0.85;
  transform: scale(0.98);
  transition:
    transform 0.16s ease,
    opacity 0.16s ease,
    background-color 0.16s ease;
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
