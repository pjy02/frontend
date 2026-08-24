import type { ProTableActions } from "@workspace/ui/composed/pro-table/pro-table";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
} from "react";

const ServerListActionContext =
  createContext<RefObject<ProTableActions | null> | null>(null);

export function ServerListActionProvider({
  actionRef,
  children,
}: {
  actionRef: RefObject<ProTableActions | null>;
  children: ReactNode;
}) {
  return (
    <ServerListActionContext.Provider value={actionRef}>
      {children}
    </ServerListActionContext.Provider>
  );
}

export function useServerListAction() {
  return useContext(ServerListActionContext);
}
