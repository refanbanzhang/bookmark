<script setup>
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
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
  minimalMode: {
    type: Boolean,
    default: false
  },
  canMove: {
    type: Function,
    default: null
  }
})

const emit = defineEmits([
  'drag-end',
  'open-bookmark',
  'open-context-menu',
  'replace-nodes'
])

const groupRef = ref(null)
const thumbMap = ref({})
const depthClass = computed(() => `depth-${props.depth || 0}`)
const parentIdValue = computed(() =>
  props.parentId === null || props.parentId === undefined || props.parentId === ''
    ? ''
    : String(props.parentId)
)

const hasChildren = (node) => Array.isArray(node?.children) && node.children.length > 0
const isRootFolder = (node) => props.depth === 0 && hasChildren(node)

const loadThumb = async (node) => {
  if (props.minimalMode || !node?.url) return
  const src = await getThumbnailForUrl(node.url)
  if (src) {
    thumbMap.value[node.id] = src
  }
}

watch(
  () => [props.nodes, props.minimalMode],
  ([nodes, minimalMode]) => {
    if (minimalMode) {
      thumbMap.value = {}
      return
    }
    for (const node of nodes || []) {
      loadThumb(node)
    }
  },
  { immediate: true }
)

const onContextMenu = (node, event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('open-context-menu', node, { x: event.clientX, y: event.clientY })
}

const onContentClick = (node, event) => {
  if (!node?.url || event.target.closest('a')) {
    return
  }
  emit('open-bookmark', node.url)
}

const onMove = (event) => {
  const draggedId = String(event.dragged?.dataset.nodeId || '')
  const targetParentId = event.to?.dataset.groupParentId || ''
  if (!draggedId || !props.canMove) {
    return true
  }
  return props.canMove(draggedId, targetParentId || null)
}

const onUpdateNodes = (nextNodes) => {
  emit('replace-nodes', {
    parentId: props.parentId,
    nodes: nextNodes
  })
}

const onDragEnd = (event) => {
  emit('drag-end', event)
}

const forwardOpenContextMenu = (node, point) => emit('open-context-menu', node, point)
const forwardOpenBookmark = (url) => emit('open-bookmark', url)
const forwardReplaceNodes = (payload) => emit('replace-nodes', payload)
const forwardDragEnd = (event) => emit('drag-end', event)
</script>

<template>
  <VueDraggable
    ref="groupRef"
    tag="ul"
    class="bookmark-group"
    :class="[depthClass, { 'is-minimal': minimalMode }]"
    :model-value="nodes"
    :animation="180"
    :data-group-parent-id="parentIdValue"
    draggable="li.bookmark-item"
    ghost-class="bookmark-sort-ghost"
    chosen-class="bookmark-sort-chosen"
    drag-class="bookmark-sort-drag"
    handle=".drag-handle"
    :group="{ name: 'bookmark-tree', pull: true, put: true }"
    :move="onMove"
    @update:modelValue="onUpdateNodes"
    @end="onDragEnd"
  >
    <li
      v-for="node in nodes"
      :key="node.id"
      class="bookmark-item"
      :class="{
        'is-folder': hasChildren(node),
        'is-root-folder': isRootFolder(node)
      }"
      :data-id="String(node.id)"
      :data-node-id="String(node.id)"
    >
      <section v-if="isRootFolder(node)" class="module-section folder">
        <div
          class="module-header-title module-folder-title drag-handle"
          @contextmenu.prevent.stop="onContextMenu(node, $event)"
        >
          <span>{{ node.title || '未命名目录' }}</span>
        </div>
        <div class="module-body">
          <BookmarkGroup
            :nodes="node.children"
            :parent-id="node.id"
            :depth="depth + 1"
            :minimal-mode="minimalMode"
            :can-move="canMove"
            @drag-end="forwardDragEnd"
            @open-bookmark="forwardOpenBookmark"
            @open-context-menu="forwardOpenContextMenu"
            @replace-nodes="forwardReplaceNodes"
          />
        </div>
      </section>

      <div v-else class="bookmark-row" :class="{ folder: hasChildren(node) }">
        <div
          class="bookmark-content drag-handle"
          :class="{ 'is-minimal': minimalMode }"
          @click="onContentClick(node, $event)"
          @contextmenu="onContextMenu(node, $event)"
        >
          <template v-if="!minimalMode">
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
          </template>

          <div class="bookmark-text" :class="{ 'is-minimal': minimalMode }">
            <a v-if="node.url" :href="node.url" target="_blank" rel="noreferrer" draggable="false" @click.stop>
              {{ node.title || '未命名书签' }}
            </a>
            <span v-else>{{ node.title || '未命名目录' }}</span>
          </div>
        </div>
      </div>

      <BookmarkGroup
        v-if="!isRootFolder(node) && hasChildren(node)"
        :nodes="node.children"
        :parent-id="node.id"
        :depth="depth + 1"
        :minimal-mode="minimalMode"
        :can-move="canMove"
        @drag-end="forwardDragEnd"
        @open-bookmark="forwardOpenBookmark"
        @open-context-menu="forwardOpenContextMenu"
        @replace-nodes="forwardReplaceNodes"
      />
    </li>
  </VueDraggable>
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

.bookmark-group.is-minimal {
  display: grid;
  gap: 6px;
}

.bookmark-group.is-minimal.depth-1 {
  padding-left: 12px;
}

.bookmark-group.is-minimal.depth-2 {
  padding-left: 24px;
}

.bookmark-group.is-minimal.depth-3 {
  padding-left: 36px;
}

.bookmark-group.is-minimal.depth-4 {
  padding-left: 48px;
}

.bookmark-item {
  list-style: none;
}

.bookmark-group.is-minimal > .bookmark-item {
  width: 100%;
}

.bookmark-item.is-root-folder {
  width: 100%;
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
  border-radius: var(--radius-base);
  width: 124px;
  height: 124px;
  padding: 10px;
  box-shadow: var(--bookmark-card-shadow);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.12s ease,
    opacity 0.12s ease;
  cursor: grab;
  touch-action: none;
}

.bookmark-content.is-minimal {
  display: flex;
  width: 100%;
  max-width: none;
  height: auto;
  min-height: 0;
  justify-content: flex-start;
  gap: 0;
  padding: 2px 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  border-radius: 0;
}

.bookmark-content:hover {
  border-color: var(--bookmark-hover-border);
  box-shadow: var(--bookmark-hover-shadow);
  transform: translateY(-2px);
}

.bookmark-row.folder .bookmark-content {
  background: var(--folder-card-bg);
  border-color: var(--folder-card-border);
}

.bookmark-row.folder .bookmark-content.is-minimal {
  background: transparent;
  border-color: transparent;
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
  border-radius: var(--radius-base);
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
  border-radius: var(--radius-base);
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
  border-radius: var(--radius-base);
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

.bookmark-text.is-minimal {
  flex: initial;
  width: 100%;
}

.bookmark-text.is-minimal a,
.bookmark-text.is-minimal span {
  overflow: visible;
  display: block;
  white-space: nowrap;
  -webkit-line-clamp: unset;
}

.bookmark-content.is-minimal:hover {
  border-color: transparent;
  box-shadow: none;
  transform: none;
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

.bookmark-sort-ghost {
  opacity: 0.22;
}

.bookmark-sort-chosen .bookmark-content,
.bookmark-sort-chosen.module-section {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18), var(--bookmark-hover-shadow);
}

.bookmark-sort-drag {
  opacity: 0.92;
}

@media (max-width: 768px) {
  .bookmark-content {
    width: 104px;
    height: 104px;
    padding: 8px;
  }

  .bookmark-content.is-minimal {
    width: 100%;
    height: auto;
    min-height: 0;
    padding: 2px 0;
  }

  .bookmark-text a,
  .bookmark-text span {
    font-size: 12px;
  }
}
</style>
