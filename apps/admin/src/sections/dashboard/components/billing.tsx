import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@workspace/ui/components/card";
import { useTranslation } from "react-i18next";

interface BillingProps {
  type: "dashboard" | "payment";
}

interface ItemType {
  logo: string;
  title: string;
  description: string;
  expiryDate: string;
  href: string;
}

async function getBillingURL() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/perfect-panel/ppanel-assets/commits"
    );
    const json = await response.json();
    const version = json[0]?.sha || "latest";
    const url = new URL(
      "https://cdn.jsdmirror.com/gh/perfect-panel/ppanel-assets"
    );
    url.pathname += `@${version}/billing/index.json`;
    return url.toString();
  } catch (_error) {
    return "https://cdn.jsdmirror.com/gh/perfect-panel/ppanel-assets/billing/index.json";
  }
}

export default function Billing({ type }: BillingProps) {
  const { t } = useTranslation("dashboard");

  const { data: list } = useQuery({
    queryKey: ["billing", type],
    queryFn: async () => {
      const url = await getBillingURL();
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });
      const data = await response.json();
      const now = Date.now();

      return Array.isArray(data[type])
        ? data[type].filter((item: { expiryDate: string }) => {
            const expiryDate = Date.parse(item.expiryDate);
            return !Number.isNaN(expiryDate) && expiryDate > now;
          })
        : [];
    },
    initialData: [],
  });

  if (!list?.length) return null;

  return (
    <section className="dashboard-section border-t pt-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="font-semibold text-sm">
          {t("billing.title", "Project Support")}
        </h2>
        <span className="text-muted-foreground text-xs">
          {t(
            "billing.description",
            "Sponsoring helps PPanel to continue releasing updates!"
          )}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {list.map((item: ItemType, index: number) => (
          <a
            href={item.href}
            key={index}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Card className="h-full cursor-pointer gap-0 border-border/60 py-0 shadow-none transition-colors hover:border-primary/25 hover:bg-muted/20">
              <CardContent className="flex flex-row items-center gap-3 p-3">
                <Avatar className="size-9">
                  <AvatarImage src={item.logo} />
                  <AvatarFallback>{item.title}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-1 text-xs">
                    {item.description}
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}
