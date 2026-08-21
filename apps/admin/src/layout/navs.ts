import {
  Activity,
  BadgeDollarSign,
  BellRing,
  Boxes,
  ChartColumnBig,
  ChartNoAxesCombined,
  CreditCard,
  FileText,
  Gauge,
  Gift,
  LayoutDashboard,
  LogIn,
  type LucideIcon,
  Mail,
  Megaphone,
  MessagesSquare,
  Network,
  PackageOpen,
  PanelsTopLeft,
  PlugZap,
  Radio,
  ReceiptText,
  RotateCcw,
  Server,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  TicketPercent,
  UserPlus,
  UsersRound,
  WalletCards,
  Waypoints,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export interface NavItem {
  title: string;
  url?: string;
  icon?: LucideIcon;
  items?: NavItem[];
  defaultOpen?: boolean;
}

export function useNavs() {
  const { t } = useTranslation("menu");

  return useMemo<NavItem[]>(
    () => [
      {
        title: t("Dashboard", "Dashboard"),
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: t("Infrastructure", "Infrastructure"),
        icon: Server,
        items: [
          {
            title: t("Server Management", "Server Management"),
            url: "/dashboard/servers",
            icon: ServerCog,
          },
          {
            title: t("Node Management", "Node Management"),
            url: "/dashboard/nodes",
            icon: Network,
          },
          {
            title: t("Subscribe Config", "Subscribe Config"),
            url: "/dashboard/subscribe",
            icon: SlidersHorizontal,
          },
        ],
      },
      {
        title: t("Products & Billing", "Products & Billing"),
        icon: PackageOpen,
        items: [
          {
            title: t("Product Management", "Product Management"),
            url: "/dashboard/product",
            icon: Boxes,
          },
          {
            title: t("Order Management", "Order Management"),
            url: "/dashboard/order",
            icon: ReceiptText,
          },
          {
            title: t("Coupon Management", "Coupon Management"),
            url: "/dashboard/coupon",
            icon: TicketPercent,
          },
          {
            title: t("Payment Config", "Payment Config"),
            url: "/dashboard/payment",
            icon: CreditCard,
          },
        ],
      },
      {
        title: t("Customers & Support", "Customers & Support"),
        icon: UsersRound,
        items: [
          {
            title: t("User Management", "User Management"),
            url: "/dashboard/user",
            icon: UsersRound,
          },
          {
            title: t("Ticket Management", "Ticket Management"),
            url: "/dashboard/ticket",
            icon: MessagesSquare,
          },
          {
            title: t("Document Management", "Document Management"),
            url: "/dashboard/document",
            icon: FileText,
          },
        ],
      },
      {
        title: t("Operations", "Operations"),
        icon: Megaphone,
        items: [
          {
            title: t("Marketing Management", "Marketing Management"),
            url: "/dashboard/marketing",
            icon: ChartNoAxesCombined,
          },
          {
            title: t("Announcement Management", "Announcement Management"),
            url: "/dashboard/announcement",
            icon: BellRing,
          },
          {
            title: t("ADS Config", "ADS Config"),
            url: "/dashboard/ads",
            icon: PanelsTopLeft,
          },
        ],
      },
      {
        defaultOpen: false,
        title: t("Platform", "Platform"),
        icon: Settings2,
        items: [
          {
            title: t("System Config", "System Config"),
            url: "/dashboard/system",
            icon: Settings2,
          },
          {
            title: t("Auth Control", "Auth Control"),
            url: "/dashboard/auth-control",
            icon: ShieldCheck,
          },
          {
            title: t("Plugin Management", "Plugin Management"),
            url: "/dashboard/plugin",
            icon: PlugZap,
          },
        ],
      },
      {
        defaultOpen: false,
        title: t("Logs & Analytics", "Logs & Analytics"),
        icon: Activity,
        items: [
          {
            title: t("Login", "Login"),
            url: "/dashboard/log/login",
            icon: LogIn,
          },
          {
            title: t("Register", "Register"),
            url: "/dashboard/log/register",
            icon: UserPlus,
          },
          {
            title: t("Email", "Email"),
            url: "/dashboard/log/email",
            icon: Mail,
          },
          {
            title: t("Mobile", "Mobile"),
            url: "/dashboard/log/mobile",
            icon: Smartphone,
          },
          {
            title: t("Subscribe", "Subscribe"),
            url: "/dashboard/log/subscribe",
            icon: Radio,
          },
          {
            title: t("Reset Subscribe", "Reset Subscribe"),
            url: "/dashboard/log/reset-subscribe",
            icon: RotateCcw,
          },
          {
            title: t("Subscribe Traffic", "Subscribe Traffic"),
            url: "/dashboard/log/subscribe-traffic",
            icon: Gauge,
          },
          {
            title: t("Server Traffic", "Server Traffic"),
            url: "/dashboard/log/server-traffic",
            icon: Waypoints,
          },
          {
            title: t("Traffic Details", "Traffic Details"),
            url: "/dashboard/log/traffic-details",
            icon: ChartColumnBig,
          },
          {
            title: t("Balance", "Balance"),
            url: "/dashboard/log/balance",
            icon: WalletCards,
          },
          {
            title: t("Commission", "Commission"),
            url: "/dashboard/log/commission",
            icon: BadgeDollarSign,
          },
          {
            title: t("Gift", "Gift"),
            url: "/dashboard/log/gift",
            icon: Gift,
          },
        ],
      },
    ],
    [t]
  );
}

export function findNavByUrl(navs: NavItem[], url: string) {
  function matchDynamicRoute(pattern: string, path: string): boolean {
    const regexPattern = pattern
      .replace(/:[^/]+/g, "[^/]+")
      .replace(/\//g, "\\/");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  function findNav(
    items: NavItem[],
    currentUrl: string,
    path: NavItem[] = []
  ): NavItem[] {
    for (const item of items) {
      const normalizedItemUrl = item.url?.replace(/\/+$/, "");
      if (
        item.url === currentUrl ||
        (item.url && matchDynamicRoute(item.url, currentUrl)) ||
        (normalizedItemUrl && currentUrl.startsWith(`${normalizedItemUrl}/`))
      ) {
        return [...path, item];
      }
      if (item.items) {
        const result = findNav(item.items, currentUrl, [...path, item]);
        if (result.length) return result;
      }
    }
    return [];
  }

  return findNav(navs, url);
}
