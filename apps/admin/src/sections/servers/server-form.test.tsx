// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProtocolDefaultConfig } from "./form-schema";
import ServerForm from "./server-form";

vi.mock("@/stores/node", () => ({
  useNode: () => ({ isProtocolUsedInNodes: () => false }),
}));
vi.mock("@workspace/ui/composed/icon", () => ({ Icon: () => null }));
vi.mock("@workspace/ui/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, unknown>) =>
      Object.entries(values || {}).reduce(
        (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
        fallback
      ),
  }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const reality = {
  ...getProtocolDefaultConfig("vless"),
  type: "vless",
  port: 443,
  security: "reality",
  fingerprint: "chrome",
  sni: "www.example.com",
  reality_server_addr: "www.example.com",
  reality_server_port: 443,
  reality_private_key: "test-private-key",
  reality_public_key: "test-public-key",
  reality_short_id: "a1b2c3d4",
};
async function save() {
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await screen.findByRole("alertdialog");
  fireEvent.click(screen.getByRole("button", { name: "Confirm save" }));
}

describe("server protocol submission", () => {
  it("submits enabled VLESS Reality fields on the first confirmed save", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(
      <ServerForm
        initialValues={{
          name: "HK",
          address: "203.0.113.47",
          protocols: [{ ...reality, enable: true }],
        }}
        onSubmit={submit}
        open
        title="Create Server"
      />
    );
    await save();
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0]![0].protocols).toEqual([
      expect.objectContaining({
        type: "vless",
        enable: true,
        security: "reality",
        port: 443,
        fingerprint: "chrome",
        sni: reality.sni,
        reality_server_addr: reality.reality_server_addr,
        reality_server_port: 443,
        reality_private_key: reality.reality_private_key,
        reality_public_key: reality.reality_public_key,
        reality_short_id: reality.reality_short_id,
      }),
    ]);
  });

  it("does not silently submit an empty protocol list after filling disabled VLESS", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<ServerForm onSubmit={submit} open title="Create Server" />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "HK" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "203.0.113.47" },
    });
    fireEvent.click(screen.getByRole("button", { name: /vless/i }));
    const port = document.querySelector<HTMLInputElement>(
      '[name="protocols.2.port"]'
    );
    expect(port).not.toBeNull();
    fireEvent.change(port!, { target: { value: "443" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText(/VLESS.*not enabled/i);
    expect(document.activeElement).toBe(screen.getByRole("alert"));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("still permits creating a server without any configured protocols", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<ServerForm onSubmit={submit} open title="Create Server" />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Empty server" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "203.0.113.48" },
    });
    await save();
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ protocols: [] })
      )
    );
  });

  it("permits explicitly disabling an existing protocol without changing its settings", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(
      <ServerForm
        initialValues={{
          id: 47,
          name: "HK",
          address: "203.0.113.47",
          protocols: [{ ...reality, enable: true }],
        }}
        onSubmit={submit}
        open
        title="Edit Server"
      />
    );
    fireEvent.click(screen.getByRole("switch", { name: "Enable vless" }));
    await save();
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ protocols: [] })
      )
    );
  });

  it("keeps an unchanged disabled protocol from blocking unrelated edits", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(
      <ServerForm
        initialValues={{
          id: 47,
          name: "HK",
          address: "203.0.113.47",
          protocols: [{ ...reality, enable: false }],
        }}
        onSubmit={submit}
        open
        title="Edit Server"
      />
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "HK renamed" },
    });
    await save();
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ name: "HK renamed" })
      )
    );
  });
});

describe("server editor protocol preservation", () => {
  it("keeps NW3 and an uneditable protocol when submitting a server edit", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    const opaque = {
      type: "future-protocol",
      enable: true,
      port: 8443,
      settings: { custom: "preserved" },
    };
    render(
      <ServerForm
        initialValues={
          {
            id: 7,
            name: "Node",
            address: "node.example",
            protocols: [
              {
                type: "nowhere",
                enable: true,
                port: 443,
                version: 3,
                security: "tls",
                alpn: ["nw3"],
                network: "mix",
                obfs: "none",
                sni: "nw.example",
                cert_mode: "self",
              },
              opaque,
            ],
          } as unknown as API.Server
        }
        onSubmit={submit}
        title="Edit server"
        trigger="Edit server"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit server" }));
    await screen.findByText(/will be preserved when saving: future-protocol/);
    fireEvent.click(screen.getByRole("button", { name: /nowhere/i }));
    expect(await screen.findByText(/NW3 · TLS 1.3/)).toBeTruthy();
    expect(screen.queryByText("Allow Insecure")).toBeNull();
    await save();
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    const payload = submit.mock.calls[0]?.[0];
    expect(payload.protocols).toEqual([
      expect.objectContaining({
        type: "nowhere",
        version: 3,
        security: "tls",
        alpn: ["nw3"],
        network: "mix",
        obfs: "none",
      }),
      opaque,
    ]);
  });
  it("creates an NW3 server with valid defaults after the required fields are filled", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(
      <ServerForm onSubmit={submit} title="Add server" trigger="Add server" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add server" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "NW3 node" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "nw.example" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Enable nowhere" }));
    await screen.findByText(/NW3 · TLS 1.3/);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Nowhere requires a TLS server name.");
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Port/), {
      target: { value: "443" },
    });
    fireEvent.change(screen.getByLabelText(/^SNI/), {
      target: { value: "nw.example" },
    });
    expect(
      screen.getByRole("combobox", { name: /^Network/ }).textContent
    ).toContain("TLS + QUIC");
    await save();
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0]?.[0].protocols).toEqual([
      expect.objectContaining({
        type: "nowhere",
        version: 3,
        security: "tls",
        alpn: ["nw3"],
        network: "mix",
        obfs: "morph",
        sni: "nw.example",
        port: 443,
      }),
    ]);
  });
});
