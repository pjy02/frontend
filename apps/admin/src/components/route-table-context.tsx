import type { ProTableActions } from "@workspace/ui/composed/pro-table/pro-table";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
} from "react";

const RouteTableActionContext =
  createContext<RefObject<ProTableActions | null> | null>(null);

export function RouteTableActionProvider({
  actionRef,
  children,
}: {
  actionRef: RefObject<ProTableActions | null>;
  children: ReactNode;
}) {
  return (
    <RouteTableActionContext.Provider value={actionRef}>
      {children}
    </RouteTableActionContext.Provider>
  );
}

export function useRouteTableAction() {
  return useContext(RouteTableActionContext);
}
