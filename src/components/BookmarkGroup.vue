<script setup>
import { computed, ref, watch } from 'vue'
import { motion } from 'motion-v'
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

const emit = defineEmits([
  'drag-start',
  'drag-end',
  'drop-node',
  'drop-at-position',
  'mark-drop-target',
  'mark-drop-position',
  'open-context-menu'
])

const depth = computed(() => props.depth || 0)
const indent = computed(() => `${depth.value * 12}px`)
const thumbMap = ref({})
const dragId = computed(() => String(props.draggingId || ''))
const dropId = computed(() => String(props.dropTargetId || ''))
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
const rowTransition = {
  type: 'spring',
  stiffness: 440,
  damping: 34,
  mass: 0.58
}
const rowAnimation = (id) => {
  if (isDragging(id)) {
    return {
      x: 0,
      y: 0,
      scale: 0.93,
      opacity: 0.24,
      zIndex: 4
    }
  }

  if (isDropTarget(id)) {
    return {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      zIndex: 3
    }
  }

  return {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 1
  }
}

const rowHover = (id) => (isDragging(id) ? undefined : { y: -2, transition: { duration: 0.12 } })

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

const getSourceId = (event) => {
  const source = event.dataTransfer?.getData('text/plain') || dragId.value
  return String(source || '')
}

const getInsertIndex = (event, index) => {
  const rect = event.currentTarget.getBoundingClientRect()
  const middle = rect.left + rect.width / 2
  const deadZone = Math.min(20, rect.width * 0.16)
  if (event.clientX <= middle - deadZone) {
    return index
  }
  if (event.clientX >= middle + deadZone) {
    return index + 1
  }

  const current = props.dropPosition
  const currentParent =
    current?.parentId === null || current?.parentId === undefined || current?.parentId === ''
      ? null
      : String(current.parentId)
  const currentIndex = Number.isFinite(Number(current?.index)) ? Number(current.index) : null
  if (currentParent === parentId.value && (currentIndex === index || currentIndex === index + 1)) {
    return currentIndex
  }

  return index
}

const isFolderCenterDrop = (node, event) => {
  if (!hasChildren(node)) {
    return false
  }

  const rect = event.currentTarget.getBoundingClientRect()
  const horizontalPadding = rect.width * 0.22
  const verticalPadding = rect.height * 0.22
  const inHorizontalCenter =
    event.clientX > rect.left + horizontalPadding && event.clientX < rect.right - horizontalPadding
  const inVerticalCenter =
    event.clientY > rect.top + verticalPadding && event.clientY < rect.bottom - verticalPadding

  return inHorizontalCenter && inVerticalCenter
}

const emitDropPosition = (index) => {
  const nextIndex = Math.max(0, Math.min(props.nodes.length, index))
  const current = props.dropPosition
  const currentParent =
    current?.parentId === null || current?.parentId === undefined || current?.parentId === ''
      ? null
      : String(current.parentId)
  const currentIndex = Number.isFinite(Number(current?.index)) ? Number(current.index) : null
  if (currentParent === parentId.value && currentIndex === nextIndex) {
    return
  }
  emit('mark-drop-position', parentId.value, nextIndex)
}

const onNodeDragFeedback = (node, index, event) => {
  const sourceId = getSourceId(event)
  if (!sourceId || String(sourceId) === String(node.id)) {
    return
  }

  if (isFolderCenterDrop(node, event)) {
    if (isDropTarget(node.id)) {
      return
    }
    emit('mark-drop-target', node.id)
    return
  }

  emitDropPosition(getInsertIndex(event, index))
}

const onDragEnter = (node, index, event) => {
  onNodeDragFeedback(node, index, event)
}

const onDragOverNode = (node, index, event) => {
  onNodeDragFeedback(node, index, event)
}

const getGroupInsertIndex = (event) => {
  const container = event.currentTarget
  const cards = Array.from(container.querySelectorAll(':scope > li > .bookmark-row > .bookmark-content'))

  if (!cards.length) {
    return 0
  }

  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect()
    if (event.clientY < rect.top) {
      return index
    }
    if (event.clientY <= rect.bottom) {
      return event.clientX < rect.left + rect.width / 2 ? index : index + 1
    }
  }

  return cards.length
}

const onGroupDragOver = (event) => {
  const sourceId = getSourceId(event)
  if (!sourceId) {
    return
  }
  emitDropPosition(getGroupInsertIndex(event))
}

const onGroupDrop = (event) => {
  const sourceId = getSourceId(event)
  if (!sourceId) {
    return
  }
  emit('drop-at-position', sourceId, parentId.value, getGroupInsertIndex(event))
}

const onDrop = (node, index, event) => {
  event.preventDefault()

  const sourceId = getSourceId(event)
  if (!sourceId || String(sourceId) === String(node.id)) {
    return
  }

  if (isFolderCenterDrop(node, event)) {
    emit('drop-node', sourceId, node.id)
    return
  }

  emit('drop-at-position', sourceId, parentId.value, getInsertIndex(event, index))
}

const onContextMenu = (node, event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('open-context-menu', node, { x: event.clientX, y: event.clientY })
}

const forwardDragStart = (id) => emit('drag-start', id)
const forwardDragEnd = () => emit('drag-end')
const forwardDropNode = (sourceId, targetId) => emit('drop-node', sourceId, targetId)
const forwardDropAtPosition = (sourceId, targetParentId, targetIndex) =>
  emit('drop-at-position', sourceId, targetParentId, targetIndex)
const forwardMarkDropTarget = (id) => emit('mark-drop-target', id)
const forwardMarkDropPosition = (targetParentId, targetIndex) =>
  emit('mark-drop-position', targetParentId, targetIndex)
const forwardOpenContextMenu = (node, point) => emit('open-context-menu', node, point)
</script>

<template>
  <ul class="bookmark-group" :style="{ marginLeft: indent }" @dragover.stop.prevent="onGroupDragOver" @drop.stop.prevent="onGroupDrop">
    <template v-for="(node, index) in nodes" :key="node.id">
      <li
        v-if="hasDropPreview && previewIndex === index"
        class="bookmark-drop-spacer"
        aria-hidden="true"
      />
      <li>
        <motion.div
          class="bookmark-row"
          :layout="true"
          :class="{
            folder: hasChildren(node),
            dragging: isDragging(node.id),
            'drop-target': isDropTarget(node.id)
          }"
          :animate="rowAnimation(node.id)"
          :transition="rowTransition"
          :while-hover="rowHover(node.id)"
        >
          <div
            class="bookmark-content"
            draggable="true"
            @dragstart="onDragStart(node, $event)"
            @dragend="onDragEnd"
            @dragenter.prevent.stop="onDragEnter(node, index, $event)"
            @dragover.prevent.stop="onDragOverNode(node, index, $event)"
            @drop.stop="onDrop(node, index, $event)"
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
        </motion.div>
        <BookmarkGroup
          v-if="hasChildren(node)"
          :nodes="node.children"
          :parent-id="node.id"
          :depth="depth + 1"
          :dragging-id="draggingId"
          :drop-position="dropPosition"
          :drop-target-id="dropTargetId"
          @drag-start="forwardDragStart"
          @drag-end="forwardDragEnd"
          @drop-node="forwardDropNode"
          @drop-at-position="forwardDropAtPosition"
          @mark-drop-target="forwardMarkDropTarget"
          @mark-drop-position="forwardMarkDropPosition"
          @open-context-menu="forwardOpenContextMenu"
        />
      </li>
    </template>
    <li v-if="hasDropPreview && previewIndex === nodes.length" class="bookmark-drop-spacer" aria-hidden="true" />
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
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    outline-color 0.16s ease;
  cursor: grab;
}

.bookmark-row.dragging .bookmark-content {
  opacity: 0.32;
}

.bookmark-row.drop-target .bookmark-content {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2), var(--bookmark-hover-shadow);
}

.bookmark-content:hover {
  border-color: var(--bookmark-hover-border);
  box-shadow: var(--bookmark-hover-shadow);
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
