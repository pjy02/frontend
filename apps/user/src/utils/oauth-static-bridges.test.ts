import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const providers = ["apple", "google", "github", "facebook", "telegram"];

const readBridge = (flow: "bind" | "oauth", provider: string) =>
  readFileSync(
    fileURLToPath(
      new URL(`../../public/${flow}/${provider}/index.html`, import.meta.url)
    ),
    "utf8"
  );

describe("OAuth static callback bridges", () => {
  it.each(
    providers
  )("bridges the %s login callback into the hash router", (provider) => {
    const markup = readBridge("oauth", provider);

    expect(markup).toContain("window.location.pathname");
    expect(markup).toContain("window.location.search");
    expect(markup).toContain("window.location.hash");
    expect(markup).toContain("window.location.replace(`/#${path}");
  });

  it.each(
    providers
  )("keeps the %s binding bridge aligned with the login bridge", (provider) => {
    expect(readBridge("bind", provider)).toBe(readBridge("oauth", provider));
  });
});
