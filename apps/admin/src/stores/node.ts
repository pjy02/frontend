import {
  getServerNodeList as filterNodeList,
  getServerNodeTags as queryNodeTag,
} from "@workspace/ui/services/admin/admin";
import { useEffect } from "react";
import { create } from "zustand";
import { createInventoryCache } from "./inventory-cache";
import { fetchAllPaginated } from "./pagination";

interface NodeState {
  // Data
  nodes: API.Node[];
  tags: string[];

  // Loading states
  loading: boolean;
  loadingTags: boolean;
  loaded: boolean;
  loadedTags: boolean;
  loadFailed: boolean;

  // Actions
  fetchNodes: () => Promise<void>;
  fetchTags: () => Promise<void>;

  // Getters
  getNodeById: (nodeId: number) => API.Node | undefined;
  isProtocolUsedInNodes: (serverId: number, protocolType: string) => boolean;
  isServerReferencedByNodes: (serverId: number) => boolean;
  nodeReferencesReady: () => boolean;
  getNodesByTag: (tag: string) => API.Node[];
  getNodesWithoutTags: () => API.Node[];
  getNodeTags: () => string[];
  getAllAvailableTags: () => string[];
}

export const readNodeInventory = createInventoryCache<API.Node>(
  (signal) => fetchAllPaginated(filterNodeList, signal),
  {
    loading: () => useNodeStore.setState({ loading: true, loadFailed: false }),
    success: (nodes) =>
      useNodeStore.setState({ nodes, loaded: true, loading: false }),
    failure: () =>
      useNodeStore.setState({ loaded: true, loading: false, loadFailed: true }),
  }
);

export async function refreshNodeInventory() {
  await readNodeInventory({ refresh: true }).catch(() => {
    // The cache has already exposed the failure through the store.
  });
}

export const useNodeStore = create<NodeState>((set, get) => ({
  // Initial state
  nodes: [],
  tags: [],
  loading: false,
  loadingTags: false,
  loaded: false,
  loadedTags: false,
  loadFailed: false,

  // Actions
  fetchNodes: async () => {
    await readNodeInventory().catch(() => {
      // The store retains the last successful inventory.
    });
  },

  fetchTags: async () => {
    if (get().loadingTags) return;

    set({ loadingTags: true });
    try {
      const { data } = await queryNodeTag();
      set({
        tags: data?.data?.tags || [],
        loadedTags: true,
      });
    } catch (_error) {
      // Handle error silently
      set({ loadedTags: true });
    } finally {
      set({ loadingTags: false });
    }
  },

  // Getters
  getNodeById: (nodeId: number) => get().nodes.find((n) => n.id === nodeId),

  isProtocolUsedInNodes: (serverId: number, protocolType: string) =>
    get().nodes.some(
      (node) =>
        node.server_id === serverId &&
        (node.protocol === protocolType ||
          (protocolType === "hysteria2" && node.protocol === "hysteria"))
    ),

  isServerReferencedByNodes: (serverId: number) =>
    get().nodes.some((node) => node.server_id === serverId),

  nodeReferencesReady: () => {
    const { loaded, loading, loadFailed } = get();
    return loaded && !loading && !loadFailed;
  },

  getNodesByTag: (tag: string) =>
    get().nodes.filter((node) => (node.tags || []).includes(tag)),

  getNodesWithoutTags: () =>
    get().nodes.filter((node) => (node.tags || []).length === 0),

  getNodeTags: () =>
    Array.from(
      new Set(
        get()
          .nodes.flatMap((node) => (Array.isArray(node.tags) ? node.tags : []))
          .filter(Boolean)
      )
    ) as string[],

  getAllAvailableTags: () => {
    const nodeExtractedTags = get().getNodeTags();
    const allApiTags = get().tags;
    return Array.from(new Set([...allApiTags, ...nodeExtractedTags])).filter(
      Boolean
    );
  },
}));

export const useNode = () => {
  const store = useNodeStore();

  // Auto-fetch nodes and tags
  useEffect(() => {
    if (!(store.loaded || store.loading)) {
      store.fetchNodes();
    }
    if (!(store.loadedTags || store.loadingTags)) {
      store.fetchTags();
    }
  }, [
    store.loaded,
    store.loading,
    store.loadedTags,
    store.loadingTags,
    store.fetchNodes,
    store.fetchTags,
  ]);

  return {
    nodes: store.nodes,
    tags: store.tags,
    loading: store.loading,
    loadingTags: store.loadingTags,
    loaded: store.loaded,
    loadedTags: store.loadedTags,
    loadFailed: store.loadFailed,
    fetchNodes: store.fetchNodes,
    fetchTags: store.fetchTags,
    getNodeById: store.getNodeById,
    isProtocolUsedInNodes: store.isProtocolUsedInNodes,
    isServerReferencedByNodes: store.isServerReferencedByNodes,
    nodeReferencesReady: store.nodeReferencesReady,
    getNodesByTag: store.getNodesByTag,
    getNodesWithoutTags: store.getNodesWithoutTags,
    getNodeTags: store.getNodeTags,
    getAllAvailableTags: store.getAllAvailableTags,
  };
};

export default useNodeStore;
