// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTemplateObject, useGlobalStore } from "./global";

vi.mock("@workspace/ui/services/admin/admin", () => ({
  getUserCurrent: vi.fn(),
}));

describe("admin global store subscription link helpers", () => {
  beforeEach(() => {
    useGlobalStore.setState((state) => ({
      common: {
        ...state.common,
        site: {
          ...state.common.site,
          site_name: "PPanel",
        },
        subscribe: {
          ...state.common.subscribe,
          pan_domain: false,
          subscribe_domain: "",
          subscribe_path: "/api/v1/client/subscribe",
        },
      },
    }));
  });

  it("returns the raw URL when schema is omitted", () => {
    const url = "https://sub.example.com/api?token=abc";
    expect(useGlobalStore.getState().getAppSubLink(url)).toBe(url);
  });

  it("evaluates supported template expressions without eval", () => {
    const url = "https://sub.example.com/api?token=abc";
    const { getAppSubLink } = useGlobalStore.getState();

    expect(getAppSubLink(url, "app://import?url=${url}&name=${name}")).toBe(
      "app://import?url=https://sub.example.com/api?token=abc&name=PPanel"
    );
    expect(
      getAppSubLink(url, "app://import?url=${encodeURIComponent(url)}")
    ).toBe(`app://import?url=${encodeURIComponent(url)}`);
    expect(getAppSubLink(url, "sub://${window.btoa(url)}")).toBe(
      `sub://${window.btoa(url)}`
    );
    expect(
      getAppSubLink(
        url,
        "qx://install?config=${encodeURIComponent(JSON.stringify({ server_remote: [`${url}, tag=${name}`] }))}"
      )
    ).toBe(
      `qx://install?config=${encodeURIComponent(
        JSON.stringify({ server_remote: [`${url}, tag=PPanel`] })
      )}`
    );
    expect(
      getAppSubLink(url, "app://json?data=${JSON.stringify({ url, name })}")
    ).toBe(`app://json?data=${JSON.stringify({ url, name: "PPanel" })}`);
  });

  it("resists quote and JS expression injection payloads", () => {
    const poisonedUrl = 'https://sub.example.com/";globalThis.__pwned=true;//';
    const result = useGlobalStore
      .getState()
      .getAppSubLink(
        poisonedUrl,
        "app://json?data=${JSON.stringify({ url, name })}"
      );

    expect(result).toBe(
      `app://json?data=${JSON.stringify({ url: poisonedUrl, name: "PPanel" })}`
    );
    expect((globalThis as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(() =>
      parseTemplateObject('(() => "x")()', {
        url: poisonedUrl,
        name: "PPanel",
      })
    ).toThrow();
  });

  it("trims whitespace and skips blank lines in subscribe_domain", () => {
    useGlobalStore.setState((state) => ({
      common: {
        ...state.common,
        subscribe: {
          ...state.common.subscribe,
          pan_domain: false,
          subscribe_domain: "  sub1.example.com \r\n\n sub2.example.com  \r\n",
          subscribe_path: "/sub",
        },
      },
    }));

    expect(
      useGlobalStore.getState().getUserSubscribe("short", "tok123", "clash")
    ).toEqual([
      "https://sub1.example.com/sub?token=tok123&type=clash",
      "https://sub2.example.com/sub?token=tok123&type=clash",
    ]);
  });
});
