import { useLayoutEffect, useRef } from "react";

/** A portal's container never changes. Only its DOM parent moves between row
 * outlets, so responsive presentation can unmount without destroying editors. */
export function useRowActionWorkspaces(ids: string[], enabled: boolean) {
  const hosts = useRef(new Map<string, HTMLDivElement>());
  const getHost = (id: string) => {
    if (!enabled || typeof document === "undefined") return null;
    let host = hosts.current.get(id);
    if (!host) {
      host = document.createElement("div");
      host.className = "contents";
      host.dataset.rowActionWorkspace = id;
      hosts.current.set(id, host);
    }
    return host;
  };
  useLayoutEffect(() => {
    const current = new Set(ids);
    for (const [id, host] of hosts.current) {
      if (!(enabled && current.has(id))) {
        host.remove();
        hosts.current.delete(id);
      }
    }
  });
  return getHost;
}

export function RowActionOutlet({ host }: { host: HTMLDivElement | null }) {
  return (
    <div
      className="contents"
      ref={(element) => {
        if (element && host && host.parentNode !== element)
          element.appendChild(host);
      }}
    />
  );
}
