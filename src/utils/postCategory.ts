export interface PostCategory {
  id: number
  parent_id: number | null
  name: Record<string, string>
  slug?: string
  icon?: string
  is_active?: boolean
  sort_order?: number
  created_at?: string
  children?: PostCategory[]
}

export interface PostCategoryHierarchyItem {
  category: PostCategory
  depth: number
  parent: PostCategory | null
}

export const createPostCategoryMap = (categories: PostCategory[]) => {
  return new Map(categories.map((c) => [c.id, c]))
}

export const createPostCategoryChildCountMap = (categories: PostCategory[]) => {
  const childCountMap = new Map<number, number>()
  for (const c of categories) {
    if (c.parent_id) {
      childCountMap.set(c.parent_id, (childCountMap.get(c.parent_id) || 0) + 1)
    }
  }
  return childCountMap
}

export const flattenPostCategories = (categories: PostCategory[]): PostCategoryHierarchyItem[] => {
  const map = createPostCategoryMap(categories)
  const orderMap = new Map(categories.map((c, i) => [c.id, i]))
  const childrenMap = new Map<number, PostCategory[]>()

  for (const c of categories) {
    const pid = c.parent_id && map.has(c.parent_id) ? c.parent_id : 0
    const list = childrenMap.get(pid) || []
    list.push(c)
    childrenMap.set(pid, list)
  }

  for (const list of childrenMap.values()) {
    list.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0))
  }

  const result: PostCategoryHierarchyItem[] = []
  const visited = new Set<number>()

  const walk = (c: PostCategory, depth: number, parent: PostCategory | null) => {
    if (visited.has(c.id)) return
    visited.add(c.id)
    result.push({ category: c, depth: Math.min(depth, 1), parent })
    for (const child of childrenMap.get(c.id) || []) {
      walk(child, depth + 1, c)
    }
  }

  const roots = categories.filter((c) => !c.parent_id || (c.parent_id && !map.has(c.parent_id)))
  roots.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0))
  for (const root of roots) walk(root, 0, null)
  for (const c of categories) {
    if (!visited.has(c.id)) walk(c, c.parent_id ? 1 : 0, c.parent_id ? map.get(c.parent_id) || null : null)
  }
  return result
}

export const buildPostCategoryPath = (
  category: PostCategory | null | undefined,
  map: Map<number, PostCategory>,
  getLabel: (c: PostCategory) => string,
): string => {
  if (!category) return ''
  const current = getLabel(category)
  if (!category.parent_id) return current
  const parent = map.get(category.parent_id)
  return parent ? `${getLabel(parent)} / ${current}` : current
}

export const isPostCategorySelectable = (c: PostCategory, childCountMap: Map<number, number>) => {
  return (childCountMap.get(c.id) || 0) === 0
}
