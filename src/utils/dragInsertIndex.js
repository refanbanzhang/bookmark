const normalizeParentId = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return String(value)
}

const getCurrentIndex = (currentDropPosition, currentParentId, listParentId) => {
  const position = currentDropPosition || null
  if (!position) {
    return null
  }

  const activeParent = normalizeParentId(currentParentId ?? position.parentId)
  if (activeParent !== normalizeParentId(listParentId)) {
    return null
  }

  const rawIndex = Number(position.index)
  if (!Number.isFinite(rawIndex)) {
    return null
  }

  return Math.trunc(rawIndex)
}

export const computeInsertIndex = ({
  clientX,
  rectLeft,
  rectWidth,
  index,
  currentDropPosition,
  currentParentId,
  listParentId
}) => {
  const middle = rectLeft + rectWidth / 2
  const deadZone = Math.min(20, rectWidth * 0.16)
  const leftThreshold = middle - deadZone
  const rightThreshold = middle + deadZone
  const hysteresis = Math.min(10, rectWidth * 0.08)
  const currentIndex = getCurrentIndex(currentDropPosition, currentParentId, listParentId)

  if (currentIndex === index && clientX <= rightThreshold + hysteresis) {
    return index
  }

  if (currentIndex === index + 1 && clientX >= leftThreshold - hysteresis) {
    return index + 1
  }

  if (clientX <= leftThreshold) {
    return index
  }

  if (clientX >= rightThreshold) {
    return index + 1
  }

  if (currentIndex === index || currentIndex === index + 1) {
    return currentIndex
  }

  return index
}
