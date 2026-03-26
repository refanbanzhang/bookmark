<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
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
  cardLayout: {
    type: String,
    default: 'stacked'
  },
  canMove: {
    type: Function,
    default: null
  }
})

const emit = defineEmits([
  'drag-end',
  'open-bookmark',
  'open-context-menu'
])

const groupRef = ref(null)
const thumbMap = ref({})
const isLocalDragging = ref(false)
const depthClass = computed(() => `depth-${props.depth || 0}`)
const parentIdValue = computed(() =>
  props.parentId === null || props.parentId === undefined || props.parentId === ''
    ? ''
    : String(props.parentId)
)

const hasChildren = (node) => Array.isArray(node?.children) && node.children.length > 0
const isRootFolder = (node) => props.depth === 0 && hasChildren(node)
const getHost = (url) => {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

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

const getGlobalDragCount = () => {
  if (typeof window === 'undefined') return 0
  return Number(window.__bookmarkDragCount || 0)
}

const setGlobalDragCount = (nextCount) => {
  if (typeof window === 'undefined') return
  const safeCount = Math.max(0, Number(nextCount) || 0)
  window.__bookmarkDragCount = safeCount
  if (safeCount > 0) {
    document.documentElement.dataset.bookmarkDragging = 'true'
    return
  }
  delete document.documentElement.dataset.bookmarkDragging
}

const isAnyDragInProgress = () => document.documentElement.dataset.bookmarkDragging === 'true'

const clearHoverAnimationTargets = () => {
  const targets = groupRef.value?.$el?.querySelectorAll?.('.bookmark-content, .bookmark-thumb-wrap, .folder-thumb, .bookmark-text')
  if (!targets?.length) {
    return
  }
  const items = Array.from(targets)
  gsap.killTweensOf(items)
  gsap.set(items, {
    clearProps: 'transform,opacity,visibility'
  })
}

const onDragStart = () => {
  if (!isLocalDragging.value) {
    isLocalDragging.value = true
    setGlobalDragCount(getGlobalDragCount() + 1)
  }
  clearHoverAnimationTargets()
}

const onDragEnd = (event) => {
  if (isLocalDragging.value) {
    isLocalDragging.value = false
    setGlobalDragCount(getGlobalDragCount() - 1)
  }
  clearHoverAnimationTargets()
  emit('drag-end', event)
}

const getRootCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const omitMotionProps = (vars) => {
  const nextVars = { ...vars }
  delete nextVars.x
  delete nextVars.y
  delete nextVars.scale
  return nextVars
}

const rememberHoverBase = (element) => {
  if (!element) {
    return null
  }

  const styles = window.getComputedStyle(element)
  const base = {
    borderColor: styles.borderColor,
    boxShadow: styles.boxShadow === 'none' ? '0 0 0 rgba(0, 0, 0, 0)' : styles.boxShadow,
    backgroundColor: styles.backgroundColor
  }

  element.__gsapHoverBase = base
  return base
}

const onBookmarkHoverEnter = (event) => {
  const element = event.currentTarget
  if (!element || element.classList.contains('is-minimal') || isAnyDragInProgress()) {
    return
  }

  const thumb = element.querySelector('.bookmark-thumb-wrap, .folder-thumb')
  const text = element.querySelector('.bookmark-text')

  rememberHoverBase(element)

  gsap.killTweensOf([element, thumb, text].filter(Boolean))

  const elementHoverVars = {
    y: -3,
    boxShadow: getRootCssVar('--bookmark-hover-shadow'),
    duration: 0.22,
    ease: 'power2.out',
    overwrite: 'auto'
  }

  if (thumb) {
    const thumbHoverVars = {
      scale: 1.04,
      duration: 0.22,
      ease: 'power2.out',
      overwrite: 'auto'
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(thumb, omitMotionProps(thumbHoverVars))
    } else {
      gsap.to(thumb, thumbHoverVars)
    }
  }

  if (text) {
    const textHoverVars = {
      x: 2,
      duration: 0.22,
      ease: 'power2.out',
      overwrite: 'auto'
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(text, omitMotionProps(textHoverVars))
    } else {
      gsap.to(text, textHoverVars)
    }
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(element, omitMotionProps(elementHoverVars))
    return
  }

  gsap.to(element, elementHoverVars)
}

const onBookmarkHoverLeave = (event) => {
  const element = event.currentTarget
  if (!element || element.classList.contains('is-minimal') || isAnyDragInProgress()) {
    return
  }

  const thumb = element.querySelector('.bookmark-thumb-wrap, .folder-thumb')
  const text = element.querySelector('.bookmark-text')
  const base = element.__gsapHoverBase || rememberHoverBase(element)

  gsap.killTweensOf([element, thumb, text].filter(Boolean))

  const elementLeaveVars = {
    y: 0,
    boxShadow: base?.boxShadow,
    backgroundColor: base?.backgroundColor,
    duration: 0.2,
    ease: 'power2.out',
    overwrite: 'auto'
  }

  if (thumb) {
    const thumbLeaveVars = {
      scale: 1,
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
      clearProps: 'transform'
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(thumb, omitMotionProps(thumbLeaveVars))
    } else {
      gsap.to(thumb, thumbLeaveVars)
    }
  }

  if (text) {
    const textLeaveVars = {
      x: 0,
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
      clearProps: 'transform'
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(text, omitMotionProps(textLeaveVars))
    } else {
      gsap.to(text, textLeaveVars)
    }
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(element, omitMotionProps(elementLeaveVars))
    return
  }

  gsap.to(element, elementLeaveVars)
}

onUnmounted(() => {
  if (isLocalDragging.value) {
    isLocalDragging.value = false
    setGlobalDragCount(getGlobalDragCount() - 1)
  }
  const targets = groupRef.value?.$el?.querySelectorAll?.('.bookmark-content, .bookmark-thumb-wrap, .folder-thumb, .bookmark-text')
  if (!targets?.length) {
    return
  }
  gsap.killTweensOf(Array.from(targets))
})

const forwardOpenContextMenu = (node, point) => emit('open-context-menu', node, point)
const forwardOpenBookmark = (url) => emit('open-bookmark', url)
const forwardDragEnd = (event) => emit('drag-end', event)
</script>

<template>
  <VueDraggable
    ref="groupRef"
    tag="ul"
    class="bookmark-group"
    :class="[depthClass, { 'is-minimal': minimalMode, 'is-media-left-layout': !minimalMode && cardLayout === 'media-left' }]"
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
    @start="onDragStart"
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
            :card-layout="cardLayout"
            :can-move="canMove"
            @drag-end="forwardDragEnd"
            @open-bookmark="forwardOpenBookmark"
            @open-context-menu="forwardOpenContextMenu"
          />
        </div>
      </section>

      <div v-else class="bookmark-row" :class="{ folder: hasChildren(node) }">
        <div
          class="bookmark-content drag-handle"
          :class="{
            'is-minimal': minimalMode,
            'is-media-left': !minimalMode && cardLayout === 'media-left'
          }"
          @click="onContentClick(node, $event)"
          @contextmenu="onContextMenu(node, $event)"
          @pointerenter="onBookmarkHoverEnter"
          @pointerleave="onBookmarkHoverLeave"
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
              class="bookmark-thumb-link bookmark-thumb-wrap thumb-placeholder"
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
            <span v-if="node.url && !minimalMode" class="bookmark-host">{{ getHost(node.url) }}</span>
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
        :card-layout="cardLayout"
        :can-move="canMove"
        @drag-end="forwardDragEnd"
        @open-bookmark="forwardOpenBookmark"
        @open-context-menu="forwardOpenContextMenu"
      />
    </li>
  </VueDraggable>
</template>

<style scoped>
.bookmark-group {
  --bookmark-thumb-size: 42px;
  --bookmark-card-gap: 10px;
  --bookmark-card-width: calc((100% - (var(--bookmark-card-gap) * 4)) / 5);
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  row-gap: 8px;
  column-gap: var(--bookmark-card-gap);
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

.bookmark-item:not(.is-root-folder) {
  flex: 0 0 auto;
  width: var(--bookmark-card-width);
}

.bookmark-group.is-media-left-layout > .bookmark-item:not(.is-root-folder) {
  width: calc((100% - (var(--bookmark-card-gap) * 3)) / 4);
}

.bookmark-row {
  position: relative;
}

.bookmark-content {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 8px;
  background: var(--bookmark-card-bg);
  border: 1px solid var(--bookmark-card-border);
  border-radius: var(--radius-base);
  width: 100%;
  flex-shrink: 0;
  padding: 12px;
  box-shadow: var(--bookmark-card-shadow);
  cursor: grab;
  touch-action: none;
  will-change: transform, box-shadow;
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

.bookmark-content.is-media-left {
  flex-direction: row;
  align-items: center;
  min-height: calc(var(--bookmark-thumb-size) + 20px);
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
  aspect-ratio: 1 / 1;
  object-position: center;
  position: relative;
  z-index: 1;
}

.bookmark-thumb-link {
  display: block;
  text-decoration: none;
}

.bookmark-thumb-wrap {
  width: var(--bookmark-thumb-size);
  height: var(--bookmark-thumb-size);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 0;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    var(--thumb-inset);
  border-radius: 10px;
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
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
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
  border: 0;
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
}

.bookmark-content.is-media-left .bookmark-text {
  display: flex;
  min-height: var(--bookmark-thumb-size);
  flex-direction: column;
  justify-content: center;
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

.bookmark-text > a,
.bookmark-text > span:not(.bookmark-host) {
  display: block;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.2;
  color: var(--bookmark-text);
  text-decoration: none;
  word-break: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.bookmark-text > a + span {
  margin-top: 2px;
}

.bookmark-host {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 400;
  color: color-mix(in srgb, var(--muted) 72%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  .bookmark-group {
    --bookmark-card-gap: 8px;
    --bookmark-card-width: calc((100% - var(--bookmark-card-gap)) / 2);
  }

  .bookmark-group.is-media-left-layout > .bookmark-item:not(.is-root-folder) {
    width: 100%;
  }

  .bookmark-content {
    padding: 10px;
  }

  .bookmark-content.is-media-left {
    width: 100%;
  }

  .bookmark-content.is-minimal {
    width: 100%;
    height: auto;
    min-height: 0;
    padding: 2px 0;
  }

  .bookmark-text > a,
  .bookmark-text > span:not(.bookmark-host) {
    font-size: 12px;
  }
}
</style>
