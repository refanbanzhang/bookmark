import test from 'node:test'
import assert from 'node:assert/strict'
import { isFolderCenterDrop } from '../src/utils/folderDropZone.js'

test('keeps folder center target when pointer is near boundary after layout shift', () => {
  const point = { x: 140, y: 150 }

  const entersCenter = isFolderCenterDrop({
    clientX: point.x,
    clientY: point.y,
    rectLeft: 100,
    rectTop: 100,
    rectWidth: 124,
    rectHeight: 124,
    isCurrentTarget: false
  })
  assert.equal(entersCenter, true)

  const staysCenter = isFolderCenterDrop({
    clientX: point.x,
    clientY: point.y,
    rectLeft: 120,
    rectTop: 100,
    rectWidth: 124,
    rectHeight: 124,
    isCurrentTarget: true
  })
  assert.equal(staysCenter, true)
})

test('does not enter folder center when pointer is only in outer edge band', () => {
  const inEdgeBand = isFolderCenterDrop({
    clientX: 124,
    clientY: 150,
    rectLeft: 100,
    rectTop: 100,
    rectWidth: 124,
    rectHeight: 124,
    isCurrentTarget: false
  })
  assert.equal(inEdgeBand, false)
})
