import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldCommitDragStateChange } from '../src/utils/dragStability.js'

test('blocks state change when pointer movement is below threshold', () => {
  const allow = shouldCommitDragStateChange({
    stateChanged: true,
    lastCommitPoint: { x: 100, y: 100 },
    nextPoint: { x: 103, y: 102 },
    threshold: 6
  })

  assert.equal(allow, false)
})

test('allows state change when pointer movement reaches threshold', () => {
  const allow = shouldCommitDragStateChange({
    stateChanged: true,
    lastCommitPoint: { x: 100, y: 100 },
    nextPoint: { x: 107, y: 100 },
    threshold: 6
  })

  assert.equal(allow, true)
})

test('always allows when there is no state change', () => {
  const allow = shouldCommitDragStateChange({
    stateChanged: false,
    lastCommitPoint: { x: 100, y: 100 },
    nextPoint: { x: 100, y: 100 },
    threshold: 6
  })

  assert.equal(allow, true)
})
