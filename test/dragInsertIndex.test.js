import test from 'node:test'
import assert from 'node:assert/strict'
import { computeInsertIndex } from '../src/utils/dragInsertIndex.js'

const parentId = 'bar'

const makeCurrent = (index) => ({ parentId, index })

test('keeps previous right-side choice when pointer stays near unstable boundary', () => {
  const index = 1
  const clientX = 185

  const first = computeInsertIndex({
    clientX,
    rectLeft: 100,
    rectWidth: 124,
    index,
    currentDropPosition: null,
    currentParentId: parentId,
    listParentId: parentId
  })
  assert.equal(first, 2)

  const second = computeInsertIndex({
    clientX,
    rectLeft: 120,
    rectWidth: 124,
    index,
    currentDropPosition: makeCurrent(first),
    currentParentId: parentId,
    listParentId: parentId
  })

  assert.equal(second, 2)
})

test('switches side only after crossing hysteresis threshold', () => {
  const index = 1
  const currentDropPosition = makeCurrent(2)

  const sticky = computeInsertIndex({
    clientX: 170,
    rectLeft: 100,
    rectWidth: 124,
    index,
    currentDropPosition,
    currentParentId: parentId,
    listParentId: parentId
  })
  assert.equal(sticky, 2)

  const crossed = computeInsertIndex({
    clientX: 130,
    rectLeft: 100,
    rectWidth: 124,
    index,
    currentDropPosition,
    currentParentId: parentId,
    listParentId: parentId
  })
  assert.equal(crossed, 1)
})
