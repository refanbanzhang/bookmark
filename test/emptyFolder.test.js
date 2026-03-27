import test from 'node:test'
import assert from 'node:assert/strict'
import { hasChildren, renameNodeInTree } from '../src/utils/bookmarkTree.js'

test('hasChildren treats empty folder nodes as folders', () => {
  assert.equal(hasChildren({ id: 'folder-1', title: '空目录', children: [] }), true)
  assert.equal(hasChildren({ id: 'bookmark-1', title: '链接', url: 'https://example.com' }), false)
})

test('renameNodeInTree updates empty folder title', () => {
  const renamed = renameNodeInTree(
    [
      {
        id: 'folder-1',
        title: '旧目录名',
        children: []
      }
    ],
    'folder-1',
    '新目录名'
  )

  assert.equal(renamed[0].title, '新目录名')
  assert.deepEqual(renamed[0].children, [])
})
