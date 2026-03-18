const distance = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0))

export const shouldCommitDragStateChange = ({
  stateChanged,
  lastCommitPoint,
  nextPoint,
  threshold = 6
}) => {
  if (!stateChanged) {
    return true
  }

  if (!lastCommitPoint || !nextPoint) {
    return true
  }

  return distance(lastCommitPoint, nextPoint) >= threshold
}
