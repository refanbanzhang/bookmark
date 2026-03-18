const cloneNode = (node) => ({
  ...node,
  children: Array.isArray(node?.children) ? cloneNodes(node.children) : undefined
})

export const cloneNodes = (nodes = []) => nodes.map((node) => cloneNode(node))

export const hasChildren = (node) => Array.isArray(node?.children) && node.children.length > 0

export const collectNodeIds = (nodes = [], output = []) => {
  for (const node of nodes) {
    output.push(String(node.id))
    if (hasChildren(node)) {
      collectNodeIds(node.children, output)
    }
  }
  return output
}

export const collectNodes = (nodes = [], output = []) => {
  for (const node of nodes) {
    output.push(node)
    if (hasChildren(node)) {
      collectNodes(node.children, output)
    }
  }
  return output
}

export const findNodeById = (nodes = [], targetId) => {
  for (const node of nodes) {
    if (String(node.id) === String(targetId)) {
      return node
    }
    if (hasChildren(node)) {
      const match = findNodeById(node.children, targetId)
      if (match) {
        return match
      }
    }
  }
  return null
}

const containsId = (node, targetId) => {
  if (String(node?.id) === String(targetId)) {
    return true
  }
  if (!hasChildren(node)) {
    return false
  }
  return node.children.some((child) => containsId(child, targetId))
}

const removeNodeRecursive = (nodes = [], targetId) => {
  let removedNode = null
  const nextNodes = []

  for (const node of nodes) {
    if (String(node.id) === String(targetId)) {
      removedNode = cloneNode(node)
      continue
    }

    if (hasChildren(node)) {
      const result = removeNodeRecursive(node.children, targetId)
      if (result.removedNode) {
        removedNode = result.removedNode
      }
      nextNodes.push({
        ...node,
        children: result.nodes
      })
      continue
    }

    nextNodes.push({ ...node })
  }

  return { nodes: nextNodes, removedNode }
}

const insertNodeIntoFolder = (nodes = [], targetFolderId, nodeToInsert) =>
  nodes.map((node) => {
    if (String(node.id) === String(targetFolderId)) {
      const children = hasChildren(node) ? cloneNodes(node.children) : []
      children.push(cloneNode(nodeToInsert))
      return {
        ...node,
        children
      }
    }

    if (hasChildren(node)) {
      return {
        ...node,
        children: insertNodeIntoFolder(node.children, targetFolderId, nodeToInsert)
      }
    }

    return { ...node }
  })

export const pruneNodesByIds = (nodes = [], ids = []) => {
  const idSet = new Set(ids.map(String))

  return nodes.flatMap((node) => {
    if (idSet.has(String(node.id))) {
      return []
    }

    if (hasChildren(node)) {
      return [
        {
          ...node,
          children: pruneNodesByIds(node.children, ids)
        }
      ]
    }

    return [{ ...node }]
  })
}

export const renameNodeInTree = (nodes = [], targetId, title) =>
  nodes.map((node) => {
    if (String(node.id) === String(targetId)) {
      return {
        ...node,
        title
      }
    }

    if (hasChildren(node)) {
      return {
        ...node,
        children: renameNodeInTree(node.children, targetId, title)
      }
    }

    return { ...node }
  })

export const moveNodeInTree = (nodes = [], sourceId, targetFolderId) => {
  if (String(sourceId) === String(targetFolderId)) {
    return nodes
  }

  const sourceNode = findNodeById(nodes, sourceId)
  const targetNode = findNodeById(nodes, targetFolderId)

  if (!sourceNode || !targetNode || !hasChildren(targetNode)) {
    return nodes
  }

  if (containsId(sourceNode, targetFolderId)) {
    return nodes
  }

  const removal = removeNodeRecursive(nodes, sourceId)
  if (!removal.removedNode) {
    return nodes
  }

  return insertNodeIntoFolder(removal.nodes, targetFolderId, removal.removedNode)
}

export const isFolderNode = (node) => hasChildren(node)
