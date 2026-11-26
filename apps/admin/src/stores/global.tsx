import { getUserCurrent as currentUser } from "@workspace/ui/services/admin/admin";
import { isBrowser } from "@workspace/ui/utils/index";
import { create } from "zustand";

export interface GlobalStore {
  common: API.GetGlobalConfigResponse;
  user?: API.User;
  setCommon: (common: Partial<API.GetGlobalConfigResponse>) => void;
  setUser: (user?: API.User) => void;
  getUserInfo: () => Promise<void>;
  getUserSubscribe: (short: string, token: string, type?: string) => string[];
  getAppSubLink: (url: string, schema?: string) => string;
}

/**
 * Extracts the full domain or root domain from a URL.
 *
 * @param url - The URL to extract the domain from.
 * @param extractRoot - If true, extracts the root domain (e.g., example.com). If false, extracts the full domain (e.g., sub.example.com).
 * @returns The extracted domain or root domain, or null if the URL is invalid.
 */
export function extractDomain(url: string, extractRoot = true): string | null {
  try {
    const { hostname } = new URL(url);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return hostname;
    }
    const domainParts = hostname.split(".").filter(Boolean);
    if (extractRoot && domainParts.length > 2) {
      return domainParts.slice(-2).join(".");
    }
    return hostname;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

export function parseTemplateObject(
  expr: string,
  variables: { url: string; name: string }
): unknown {
  if (expr.includes("server_remote")) {
    const serverRemoteValue = `${variables.url}, tag=${variables.name}`;
    return { server_remote: [serverRemoteValue] };
  }

  let pos = 0;
  const input = expr;

  function skipWhitespace() {
    while (pos < input.length && /\s/.test(input[pos]!)) {
      pos++;
    }
  }

  function interpolateBacktick(raw: string) {
    return raw
      .replaceAll("${url}", variables.url)
      .replaceAll("${name}", variables.name);
  }

  function parseString(quote: string): string {
    pos++;
    let out = "";
    while (pos < input.length) {
      const ch = input[pos]!;
      if (ch === quote) {
        pos++;
        return quote === "`" ? interpolateBacktick(out) : out;
      }
      if (ch === "\\") {
        pos++;
        if (pos >= input.length) {
          throw new Error("Unterminated escape sequence");
        }
        const esc = input[pos]!;
        pos++;
        switch (esc) {
          case "n":
            out += "\n";
            break;
          case "r":
            out += "\r";
            break;
          case "t":
            out += "\t";
            break;
          default:
            out += esc;
            break;
        }
        continue;
      }
      out += ch;
      pos++;
    }
    throw new Error("Unterminated string literal");
  }

  function parseNumber(): number {
    const remaining = input.slice(pos);
    const match = /^-?\d+(?:\.\d+)?/.exec(remaining);
    if (!match) {
      throw new Error("Invalid number literal");
    }
    pos += match[0].length;
    return Number(match[0]);
  }

  function parseIdentifier(): string {
    const remaining = input.slice(pos);
    const match = /^[A-Za-z_$][A-Za-z0-9_$-]*/.exec(remaining);
    if (!match) {
      throw new Error("Invalid identifier");
    }
    pos += match[0].length;
    return match[0];
  }

  function parseArray(): unknown[] {
    pos++;
    const items: unknown[] = [];
    skipWhitespace();
    if (input[pos] === "]") {
      pos++;
      return items;
    }
    while (pos < input.length) {
      items.push(parseValue());
      skipWhitespace();
      if (input[pos] === ",") {
        pos++;
        skipWhitespace();
        if (input[pos] === "]") {
          pos++;
          return items;
        }
        continue;
      }
      if (input[pos] === "]") {
        pos++;
        return items;
      }
      throw new Error("Expected ',' or ']' in array literal");
    }
    throw new Error("Unterminated array literal");
  }

  function resolveIdentifier(ident: string): unknown {
    switch (ident) {
      case "true":
        return true;
      case "false":
        return false;
      case "null":
        return null;
      case "url":
        return variables.url;
      case "name":
        return variables.name;
      default:
        throw new Error(`Unsupported identifier: ${ident}`);
    }
  }

  function parseObject(): Record<string, unknown> {
    pos++;
    const obj: Record<string, unknown> = {};
    skipWhitespace();
    if (input[pos] === "}") {
      pos++;
      return obj;
    }
    while (pos < input.length) {
      skipWhitespace();
      const ch = input[pos];
      let key: string;
      let isIdentifierKey = false;
      if (ch === '"' || ch === "'" || ch === "`") {
        key = parseString(ch);
      } else if (ch && /[A-Za-z_$]/.test(ch)) {
        key = parseIdentifier();
        isIdentifierKey = true;
      } else if (ch && /[-\d]/.test(ch)) {
        key = String(parseNumber());
      } else {
        throw new Error("Expected property key");
      }
      skipWhitespace();
      let value: unknown;
      if (input[pos] === ":") {
        pos++;
        value = parseValue();
      } else if (
        isIdentifierKey &&
        (input[pos] === "," || input[pos] === "}")
      ) {
        value = resolveIdentifier(key);
      } else {
        throw new Error("Expected ':' after property key");
      }
      Object.defineProperty(obj, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      skipWhitespace();
      if (input[pos] === ",") {
        pos++;
        skipWhitespace();
        if (input[pos] === "}") {
          pos++;
          return obj;
        }
        continue;
      }
      if (input[pos] === "}") {
        pos++;
        return obj;
      }
      throw new Error("Expected ',' or '}' in object literal");
    }
    throw new Error("Unterminated object literal");
  }

  function parseValue(): unknown {
    skipWhitespace();
    const ch = input[pos];
    if (!ch) {
      throw new Error("Unexpected end of expression");
    }
    if (ch === "{") return parseObject();
    if (ch === "[") return parseArray();
    if (ch === '"' || ch === "'" || ch === "`") return parseString(ch);
    if (ch === "-" || (ch >= "0" && ch <= "9")) return parseNumber();
    return resolveIdentifier(parseIdentifier());
  }

  const parsed = parseValue();
  skipWhitespace();
  if (pos !== input.length) {
    throw new Error("Unexpected trailing tokens in template expression");
  }
  return parsed;
}

export const useGlobalStore = create<GlobalStore>((set, get) => ({
  common: {
    site: {
      host: "",
      site_name: "",
      site_desc: "",
      site_logo: "",
      keywords: "",
      custom_html: "",
      custom_data: "",
    },
    verify: {
      turnstile_site_key: "",
      enable_login_verify: false,
      enable_register_verify: false,
      enable_reset_password_verify: false,
    },
    auth: {
      mobile: {
        enable: false,
        enable_whitelist: false,
        whitelist: [],
      },
      email: {
        enable: false,
        enable_verify: false,
        enable_domain_suffix: false,
        domain_suffix_list: "",
      },
      register: {
        stop_register: false,
        enable_ip_register_limit: false,
        ip_register_limit: 0,
        ip_register_limit_duration: 0,
      },
      device: {
        enable: false,
        show_ads: false,
        enable_security: false,
        only_real_device: false,
      },
    },
    invite: {
      forced_invite: false,
      referral_percentage: 0,
      only_first_purchase: false,
      withdrawal_method: "",
    },
    currency: {
      currency_unit: "USD",
      currency_symbol: "$",
    },
    subscribe: {
      single_model: false,
      subscribe_path: "",
      subscribe_domain: "",
      pan_domain: false,
      user_agent_limit: false,
      user_agent_list: "",
      profile_update_interval: 0,
      profile_web_page_url: "",
      show_tutorial: false,
    },
    verify_code: {
      verify_code_expire_time: 5,
      verify_code_limit: 15,
      verify_code_interval: 60,
    },
    oauth_methods: [],
    web_ad: false,
  },
  user: undefined,
  setCommon: (common) =>
    set((state) => ({
      common: {
        ...state.common,
        ...common,
      },
    })),
  setUser: (user) => set({ user }),
  getUserInfo: async () => {
    try {
      const { data } = await currentUser();
      set({ user: data.data });
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  },
  getUserSubscribe: (short: string, token: string, type?: string) => {
    const { pan_domain, subscribe_domain, subscribe_path } =
      get().common.subscribe || {};
    const configuredDomains = subscribe_domain
      ?.split("\n")
      .map((domain) => domain.trim())
      .filter(Boolean);
    const fallbackDomain = extractDomain(window.location.origin, pan_domain);
    const domains = configuredDomains?.length
      ? configuredDomains
      : fallbackDomain
        ? [fallbackDomain]
        : [];

    return domains.map((domain) => {
      if (pan_domain) {
        if (type)
          return `https://${short}.${type}.${domain}${subscribe_path}?token=${token}&type=${type}`;
        return `https://${short}.${domain}${subscribe_path}?token=${token}`;
      }
      if (type)
        return `https://${domain}${subscribe_path}?token=${token}&type=${type}`;
      return `https://${domain}${subscribe_path}?token=${token}`;
    });
  },
  getAppSubLink: (url: string, schema?: string) => {
    const name = get().common?.site?.site_name || "";

    if (!schema) return url;
    try {
      let result = schema
        .replaceAll("${url}", url)
        .replaceAll("${name}", name);

      const maxLoop = 10;
      let prev: string;
      let loop = 0;
      do {
        prev = result;
        result = result.replace(
          /\${encodeURIComponent\(JSON\.stringify\(([^)]+)\)\)}/g,
          (match, expr) => {
            try {
              const obj = parseTemplateObject(expr, { url, name });
              return encodeURIComponent(JSON.stringify(obj));
            } catch {
              return match;
            }
          }
        );

        result = result.replace(
          /\${encodeURIComponent\(([^)]+)\)}/g,
          (match, expr) => {
            if (expr === "url") return encodeURIComponent(url);
            if (expr === "name") return encodeURIComponent(name);
            try {
              return encodeURIComponent(expr);
            } catch {
              return match;
            }
          }
        );

        result = result.replace(
          /\${window\.btoa\(([^)]+)\)}/g,
          (match, expr) => {
            const btoa = isBrowser() ? window.btoa : (str: string) => str;
            if (expr === "url") return btoa(url);
            if (expr === "name") return btoa(name);
            try {
              return btoa(expr);
            } catch {
              return match;
            }
          }
        );

        result = result.replace(
          /\${JSON\.stringify\(([^)]+)\)}/g,
          (match, expr) => {
            try {
              const parsed = parseTemplateObject(expr, { url, name });
              return JSON.stringify(parsed);
            } catch {
              return match;
            }
          }
        );
        loop++;
      } while (result !== prev && loop < maxLoop);
      return result;
    } catch (_error) {
      return "";
    }
  },
}));
