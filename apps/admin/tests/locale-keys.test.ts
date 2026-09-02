/// <reference types="node" />

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getInitialI18nNamespaces,
  i18nNamespaces,
  supportedLngs,
} from "../src/config/i18n";

const localeRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/assets/locales"
);

function flattenKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      return flattenKeys(child as Record<string, unknown>, path);
    }
    return path;
  });
}

function normalizePluralKey(key: string) {
  return key.replace(/_(zero|one|two|few|many|other)$/, "");
}

function readNamespace(language: string, namespace: string) {
  return JSON.parse(
    readFileSync(join(localeRoot, language, `${namespace}.json`), "utf8")
  ) as Record<string, unknown>;
}

describe("admin locale keys", () => {
  it("has the same namespace files for every supported language", () => {
    const expectedFiles = i18nNamespaces
      .map((namespace) => `${namespace}.json`)
      .sort();

    for (const language of supportedLngs) {
      const actualFiles = readdirSync(join(localeRoot, language))
        .filter((file) => file.endsWith(".json"))
        .sort();
      expect(actualFiles).toEqual(expectedFiles);
    }
  });

  it("keeps normalized English and Chinese keys aligned", () => {
    const [referenceLanguage, ...otherLanguages] = supportedLngs;
    expect(referenceLanguage).toBeTruthy();

    for (const namespace of i18nNamespaces) {
      const referenceKeys = new Set(
        flattenKeys(readNamespace(referenceLanguage!, namespace)).map(
          normalizePluralKey
        )
      );

      for (const language of otherLanguages) {
        const actualKeys = new Set(
          flattenKeys(readNamespace(language, namespace)).map(
            normalizePluralKey
          )
        );
        expect([...actualKeys].sort(), `${language}/${namespace}`).toEqual(
          [...referenceKeys].sort()
        );
      }
    }
  });

  it("loads the dashboard shell before route-specific namespaces", () => {
    expect(getInitialI18nNamespaces("/dashboard/withdrawal")).toEqual([
      "components",
      "menu",
      "auth",
      "withdrawal",
    ]);
    expect(getInitialI18nNamespaces("/dashboard/log/order")).toEqual([
      "components",
      "menu",
      "auth",
      "log",
    ]);
  });

  it("does not retain the removed plugin namespace", () => {
    expect(i18nNamespaces).not.toContain("plugin");
  });
});
