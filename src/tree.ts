import type { FolderNode, RequestNode, TreeNode } from "./types";
import { TRASH_NAME, uid } from "./types";

export const nodeById = (nodes: TreeNode[], id: string): TreeNode | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.kind === "folder") {
      const r = nodeById(n.children, id);
      if (r) return r;
    }
  }
  return undefined;
};

export const parentOf = (nodes: TreeNode[], id: string): string | null | undefined => {
  for (const n of nodes) {
    if (n.id === id) return null;
    if (n.kind === "folder") {
      if (n.children.some((c) => c.id === id)) return n.id;
      const r = parentOf(n.children, id);
      if (r !== undefined) return r;
    }
  }
  return undefined;
};

export const childrenOf = (tree: TreeNode[], parentId: string | null): TreeNode[] => {
  if (parentId === null) return tree;
  const p = nodeById(tree, parentId);
  return p && p.kind === "folder" ? p.children : [];
};

export const isDescendant = (tree: TreeNode[], ancestorId: string, nodeId: string): boolean => {
  const a = nodeById(tree, ancestorId);
  return !!(a && a.kind === "folder" && nodeById(a.children, nodeId));
};

export const insertNode = (tree: TreeNode[], parentId: string | null, index: number, node: TreeNode): TreeNode[] => {
  if (parentId === null) {
    const next = [...tree];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node);
    return next;
  }
  return tree.map((n) => {
    if (n.kind !== "folder") return n;
    if (n.id === parentId) {
      const ch = [...n.children];
      ch.splice(Math.max(0, Math.min(index, ch.length)), 0, node);
      return { ...n, children: ch };
    }
    return { ...n, children: insertNode(n.children, parentId, index, node) };
  });
};

export const removeNode = (tree: TreeNode[], id: string): { next: TreeNode[]; removed?: TreeNode } => {
  let removed: TreeNode | undefined;
  const walk = (ns: TreeNode[]): TreeNode[] =>
    ns.reduce<TreeNode[]>((acc, n) => {
      if (n.id === id) { removed = n; return acc; }
      if (n.kind === "folder") acc.push({ ...n, children: walk(n.children) });
      else acc.push(n);
      return acc;
    }, []);
  return { next: walk(tree), removed };
};

export const updateNodeInTree = (
  tree: TreeNode[],
  id: string,
  patch: Partial<Pick<RequestNode, "name" | "method" | "path">>,
): TreeNode[] =>
  tree.map((n) => {
    if (n.id === id) {
      if (n.kind === "request")
        return { ...n, name: patch.name ?? n.name, method: patch.method ?? n.method, path: patch.path ?? n.path };
      return { ...n, name: patch.name ?? n.name };
    }
    if (n.kind === "folder") return { ...n, children: updateNodeInTree(n.children, id, patch) };
    return n;
  });

export const treeStats = (nodes: TreeNode[]): { folders: number; requests: number } => {
  let folders = 0;
  let requests = 0;
  const walk = (ns: TreeNode[]) =>
    ns.forEach((n) => {
      if (n.kind === "folder") {
        if (n.isTrash) return;
        folders++;
        walk(n.children);
      } else requests++;
    });
  walk(nodes);
  return { folders, requests };
};

/* ---------- служебная папка «Корзина» ---------- */

export const getTrash = (nodes: TreeNode[]): FolderNode | undefined =>
  nodes.find((n): n is FolderNode => n.kind === "folder" && !!n.isTrash);

export const makeTrash = (): FolderNode => ({ id: uid(), kind: "folder", name: TRASH_NAME, children: [], isTrash: true });

export const ensureTrash = (nodes: TreeNode[]): TreeNode[] => {
  if (nodes.some((n) => n.kind === "folder" && n.isTrash)) return nodes;
  const idx = nodes.findIndex((n) => n.kind === "folder" && n.name === TRASH_NAME);
  if (idx >= 0) {
    const next = [...nodes];
    next[idx] = { ...next[idx], isTrash: true } as FolderNode;
    return next;
  }
  return [...nodes, makeTrash()];
};

export const isInsideTrash = (tree: TreeNode[], id: string): boolean => {
  const trash = getTrash(tree);
  if (!trash) return false;
  return trash.children.some((c) => c.id === id || (c.kind === "folder" && !!nodeById(c.children, id)));
};

export const moveToTrash = (tree: TreeNode[], id: string): TreeNode[] => {
  const trash = getTrash(tree);
  if (!trash || trash.id === id || isInsideTrash(tree, id)) return tree;
  const { next, removed } = removeNode(tree, id);
  if (!removed) return tree;
  return next.map((n) => (n.kind === "folder" && n.isTrash ? { ...n, children: [removed, ...n.children] } : n));
};

export const restoreFromTrash = (tree: TreeNode[], id: string): TreeNode[] => {
  const parent = parentOf(tree, id);
  const trash = getTrash(tree);
  if (!trash || parent !== trash.id) return tree;
  const { next, removed } = removeNode(tree, id);
  if (!removed) return tree;
  return [...next, removed];
};

export const removeLinkedNodes = (
  nodes: TreeNode[],
  links: Array<{ requestId?: string; name: string; path: string }>,
): TreeNode[] =>
  nodes.reduce<TreeNode[]>((acc, n) => {
    if (n.kind === "request") {
      const hit = links.some((l) => (l.requestId ? n.id === l.requestId : n.name === l.name && n.path === l.path));
      if (!hit) acc.push(n);
      return acc;
    }
    acc.push({ ...n, children: removeLinkedNodes(n.children, links) });
    return acc;
  }, []);
