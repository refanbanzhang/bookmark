const getCenterPaddingRatio = (isCurrentTarget) => {
  // Harder to enter, easier to stay: prevents boundary flicker.
  return isCurrentTarget ? 0.14 : 0.24
}

export const isFolderCenterDrop = ({
  clientX,
  clientY,
  rectLeft,
  rectTop,
  rectWidth,
  rectHeight,
  isCurrentTarget
}) => {
  const paddingRatio = getCenterPaddingRatio(Boolean(isCurrentTarget))
  const horizontalPadding = rectWidth * paddingRatio
  const verticalPadding = rectHeight * paddingRatio

  const inHorizontalCenter =
    clientX > rectLeft + horizontalPadding && clientX < rectLeft + rectWidth - horizontalPadding
  const inVerticalCenter =
    clientY > rectTop + verticalPadding && clientY < rectTop + rectHeight - verticalPadding

  return inHorizontalCenter && inVerticalCenter
}
