import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../styles/admin-theme.css", import.meta.url),
  "utf8"
);

function declarations(selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing selector: ${selector}`);
  return Object.fromEntries(
    Array.from(
      css
        .slice(start, css.indexOf("}", start))
        .matchAll(/(--[\w-]+):\s*([^;]+);/g),
      ([, name = "", value = ""]) => [name, value.trim()]
    )
  );
}

const light = declarations(":root.admin-console");
const dark = { ...light, ...declarations(":root.admin-console.dark") };

function resolve(tokens: Record<string, string>, name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Missing token: ${name}`);
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  return alias?.[1] ? resolve(tokens, alias[1]) : value;
}

function rgb(hex: string) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Expected RGB hex: ${hex}`);
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16)
  );
}

function contrast(foreground: number[], background: number[]) {
  const luminance = (color: number[]) =>
    color
      .map((byte) => {
        const channel = byte / 255;
        return channel <= 0.040_45
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (sum, channel, index) =>
          sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
        0
      );
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Admin visual foundation", () => {
  it("scopes solid action fills to real Buttons, not ordinary menu items", () => {
    expect(css).toContain('[data-ui-button][data-variant="default"]');
    expect(css).toContain('[data-ui-button][data-variant="destructive"]');
    expect(css).not.toContain(
      ':where(button, a, [role="button"])[data-variant="default"]'
    );
    expect(css).not.toContain(
      ':where(button, a, [role="button"])[data-variant="destructive"]'
    );
  });
  for (const [mode, tokens] of Object.entries({ light, dark })) {
    it(`${mode}: action labels remain readable through hover and press state layers`, () => {
      for (const [base, on] of [
        ["--admin-action", "--admin-on-action"],
        ["--admin-danger-action", "--admin-on-danger"],
      ] as const) {
        const foreground = rgb(resolve(tokens, on));
        for (const [suffix, opacity] of [
          ["", 0],
          ["-hover", 0.06],
          ["-pressed", 0.1],
        ] as const) {
          const background = rgb(resolve(tokens, `${base}${suffix}`));
          const composed = background.map(
            (channel, index) =>
              channel * (1 - opacity) + (foreground[index] ?? 0) * opacity
          );
          expect(
            contrast(foreground, composed),
            `${base}${suffix}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(resolve(tokens, "--primary")).toBe(
        resolve(tokens, "--admin-action")
      );
      expect(resolve(tokens, "--primary-foreground")).toBe(
        resolve(tokens, "--admin-on-action")
      );
    });

    it(`${mode}: status, links, chart text and metadata have readable surface pairs`, () => {
      const pairs = [
        ...["success", "warning", "danger", "info"].map(
          (status) =>
            [`--admin-${status}`, `--admin-${status}-surface`] as const
        ),
        ...["--card", "--popover", "--background"].flatMap((surface) => [
          ["--admin-link", surface] as const,
          ["--admin-link-hover", surface] as const,
          ["--admin-text-secondary", surface] as const,
          ["--admin-text-tertiary", surface] as const,
          ...[1, 2, 3, 4, 5].map(
            (index) => [`--admin-chart-text-${index}`, surface] as const
          ),
        ]),
      ];
      for (const [text, surface] of pairs) {
        expect(
          contrast(rgb(resolve(tokens, text)), rgb(resolve(tokens, surface))),
          `${text} on ${surface}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("retains brand and chart marks separately from readable text", () => {
    expect(resolve(light, "--admin-brand")).toBe("#4285f4");
    expect(
      [1, 2, 3, 4, 5].map((index) => resolve(light, `--chart-${index}`))
    ).toEqual(["#4285f4", "#ea4335", "#fbbc04", "#34a853", "#6f42c1"]);
    expect(resolve(light, "--admin-action")).not.toBe(
      resolve(light, "--admin-brand")
    );
  });

  it("defines distinct type roles and explicit CJK sans fallbacks without flattening h2/h3", () => {
    expect(
      [
        "page",
        "workspace",
        "section",
        "subsection",
        "label",
        "description",
        "meta",
      ].map((role) => resolve(light, `--admin-type-${role}`))
    ).toEqual([
      "1.5rem",
      "1.125rem",
      "1rem",
      "0.875rem",
      "0.875rem",
      "0.8125rem",
      "0.75rem",
    ]);
    for (const font of [
      "Noto Sans SC",
      "PingFang SC",
      "Microsoft YaHei",
      "Hiragino Sans GB",
    ]) {
      expect(resolve(light, "--admin-font-sans")).toContain(`"${font}"`);
    }
    expect(css).not.toMatch(/:where\(h2,\s*h3/);
    expect(css).toContain("html.admin-console .admin-subsection-title");
  });
});
