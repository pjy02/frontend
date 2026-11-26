import { getServerList as filterServerList } from "@workspace/ui/services/admin/admin";
import { useEffect } from "react";
import { create } from "zustand";
import { createInventoryCache } from "./inventory-cache";
import { fetchAllPaginated } from "./pagination";

interface ServerState {
  // Data
  servers: API.Server[];

  // Loading states
  loading: boolean;
  loaded: boolean;
  loadFailed: boolean;

  // Actions
  fetchServers: () => Promise<void>;

  // Getters
  getServerById: (serverId: number) => API.Server | undefined;
  getServerName: (serverId?: number) => string;
  getServerAddress: (serverId?: number) => string;
  getServerEnabledProtocols: (serverId: number) => API.Protocol[];
  getProtocolPort: (serverId?: number, protocol?: string) => string;
  getAvailableProtocols: (
    serverId?: number
  ) => Array<{ protocol: string; port: number }>;
}

export const readServerInventory = createInventoryCache<API.Server>(
  (signal) => fetchAllPaginated(filterServerList, signal),
  {
    loading: () =>
      useServerStore.setState({ loading: true, loadFailed: false }),
    success: (servers) =>
      useServerStore.setState({ servers, loaded: true, loading: false }),
    failure: () =>
      useServerStore.setState({
        loaded: true,
        loading: false,
        loadFailed: true,
      }),
  }
);

export async function refreshServerInventory() {
  await readServerInventory({ refresh: true }).catch(() => {
    // The cache has already exposed the failure through the store.
  });
}

export const useServerStore = create<ServerState>((_set, get) => ({
  // Initial state
  servers: [],
  loading: false,
  loaded: false,
  loadFailed: false,

  // Actions
  fetchServers: async () => {
    await readServerInventory().catch(() => {
      // The store retains the last successful inventory.
    });
  },

  // Getters
  getServerById: (serverId: number) =>
    get().servers.find((s) => s.id === serverId),

  getServerName: (serverId?: number) => {
    if (!serverId) return "—";
    const server = get().servers.find((s) => s.id === serverId);
    return server?.name ?? `#${serverId}`;
  },

  getServerAddress: (serverId?: number) => {
    if (!serverId) return "—";
    const server = get().servers.find((s) => s.id === serverId);
    return server?.address ?? "—";
  },

  getServerEnabledProtocols: (serverId: number) => {
    const server = get().servers.find((s) => s.id === serverId);
    return server?.protocols?.filter((p) => p.enable) || [];
  },

  getProtocolPort: (serverId?: number, protocol?: string) => {
    if (!(serverId && protocol)) return "—";
    const enabledProtocols = get().getServerEnabledProtocols(serverId);
    const protocolConfig = enabledProtocols.find((p) => p.type === protocol);
    return protocolConfig?.port ? String(protocolConfig.port) : "—";
  },

  getAvailableProtocols: (serverId?: number) => {
    if (!serverId) return [];
    return get()
      .getServerEnabledProtocols(serverId)
      .map((p) => ({
        protocol: p.type,
        port: p.port,
      }));
  },
}));

export const useServer = () => {
  const store = useServerStore();

  // Auto-fetch servers
  useEffect(() => {
    if (!(store.loaded || store.loading)) {
      store.fetchServers();
    }
  }, [store.loaded, store.loading, store.fetchServers]);

  return {
    servers: store.servers,
    loading: store.loading,
    loaded: store.loaded,
    loadFailed: store.loadFailed,
    fetchServers: store.fetchServers,
    getServerById: store.getServerById,
    getServerName: store.getServerName,
    getServerAddress: store.getServerAddress,
    getServerEnabledProtocols: store.getServerEnabledProtocols,
    getProtocolPort: store.getProtocolPort,
    getAvailableProtocols: store.getAvailableProtocols,
  };
};

export default useServerStore;
