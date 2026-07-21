import type {
  MaterialCategory,
  MaterialListItem,
} from "@/modules/materials/types";

export const UNCATEGORIZED_NODE_ID = "__uncategorized__";

export type CategoryMaterialNodeKind = "category" | "material" | "uncategorized";

export interface CategoryMaterialTreeNode {
  id: string;
  kind: CategoryMaterialNodeKind;
  label: string;
  code: string;
  is_active: boolean;
  category?: MaterialCategory;
  material?: MaterialListItem;
  children: CategoryMaterialTreeNode[];
  childCount: number;
}

export interface FlatCategoryMaterialRow {
  node: CategoryMaterialTreeNode;
  depth: number;
}

export function buildCategoryMaterialTree(
  categories: MaterialCategory[],
  materials: MaterialListItem[],
): CategoryMaterialTreeNode[] {
  const categoryNodes = new Map<string, CategoryMaterialTreeNode>();

  for (const category of categories) {
    categoryNodes.set(category.id, {
      id: category.id,
      kind: "category",
      label: category.name_ar,
      code: category.category_code,
      is_active: category.is_active,
      category,
      children: [],
      childCount: 0,
    });
  }

  const roots: CategoryMaterialTreeNode[] = [];

  for (const node of categoryNodes.values()) {
    const parentId = node.category?.parent_id ?? null;
    if (parentId && categoryNodes.has(parentId)) {
      categoryNodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const materialsByCategory = new Map<string | null, MaterialListItem[]>();
  for (const material of materials) {
    const key = material.category_id;
    const list = materialsByCategory.get(key) ?? [];
    list.push(material);
    materialsByCategory.set(key, list);
  }

  const attachMaterials = (node: CategoryMaterialTreeNode) => {
    const categoryMaterials = materialsByCategory.get(node.id) ?? [];
    categoryMaterials.sort((a, b) =>
      a.material_code.localeCompare(b.material_code, "ar"),
    );
    for (const material of categoryMaterials) {
      node.children.push({
        id: material.id,
        kind: "material",
        label: material.name_ar,
        code: material.material_code,
        is_active: material.is_active,
        material,
        children: [],
        childCount: 0,
      });
    }
    for (const child of node.children) {
      if (child.kind === "category") attachMaterials(child);
    }
  };

  for (const root of roots) {
    attachMaterials(root);
  }

  const uncategorized = materialsByCategory.get(null) ?? [];
  if (uncategorized.length > 0) {
    uncategorized.sort((a, b) =>
      a.material_code.localeCompare(b.material_code, "ar"),
    );
    roots.push({
      id: UNCATEGORIZED_NODE_ID,
      kind: "uncategorized",
      label: "بدون صنف",
      code: "",
      is_active: true,
      children: uncategorized.map((material) => ({
        id: material.id,
        kind: "material" as const,
        label: material.name_ar,
        code: material.material_code,
        is_active: material.is_active,
        material,
        children: [],
        childCount: 0,
      })),
      childCount: 0,
    });
  }

  const sortNodes = (
    nodes: CategoryMaterialTreeNode[],
  ): CategoryMaterialTreeNode[] =>
    nodes
      .sort((a, b) => {
        if (a.kind === "uncategorized") return 1;
        if (b.kind === "uncategorized") return -1;
        if (a.kind !== b.kind) {
          if (a.kind === "category") return -1;
          if (b.kind === "category") return 1;
        }
        return a.code.localeCompare(b.code, "ar") || a.label.localeCompare(b.label, "ar");
      })
      .map((node) => {
        node.children = sortNodes(node.children);
        node.childCount = node.children.length;
        return node;
      });

  return sortNodes(roots);
}

export function flattenCategoryMaterialTree(
  nodes: CategoryMaterialTreeNode[],
  expandedIds: Set<string>,
  depth = 0,
): FlatCategoryMaterialRow[] {
  const rows: FlatCategoryMaterialRow[] = [];

  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.children.length > 0 && expandedIds.has(node.id)) {
      rows.push(
        ...flattenCategoryMaterialTree(node.children, expandedIds, depth + 1),
      );
    }
  }

  return rows;
}

export function collectExpandableCategoryIds(
  nodes: CategoryMaterialTreeNode[],
): string[] {
  const ids: string[] = [];

  const walk = (items: CategoryMaterialTreeNode[]) => {
    for (const item of items) {
      if (item.children.length > 0) {
        ids.push(item.id);
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return ids;
}

export function toggleExpandedId(
  expandedIds: Set<string>,
  id: string,
): Set<string> {
  const next = new Set(expandedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
