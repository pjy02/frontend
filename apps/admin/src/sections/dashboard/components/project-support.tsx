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
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ArrowUpRight, HeartHandshake } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ProjectSupportItem = {
  logo: string;
  title: string;
  description: string;
  expiryDate: string;
  href: string;
};

const FALLBACK_BILLING_URL =
  "https://cdn.jsdmirror.com/gh/perfect-panel/ppanel-assets/billing/index.json";

function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return;
  }
}

async function getBillingUrl() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/perfect-panel/ppanel-assets/commits"
    );
    if (!response.ok) return FALLBACK_BILLING_URL;
    const json = (await response.json()) as Array<{ sha?: string }>;
    const version = json[0]?.sha;
    if (!version) return FALLBACK_BILLING_URL;
    return `https://cdn.jsdmirror.com/gh/perfect-panel/ppanel-assets@${version}/billing/index.json`;
  } catch {
    return FALLBACK_BILLING_URL;
  }
}

export async function fetchProjectSupport(): Promise<ProjectSupportItem[]> {
  const response = await fetch(await getBillingUrl(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Unable to load project support data");

  const data = (await response.json()) as { dashboard?: unknown };
  const list = Array.isArray(data.dashboard) ? data.dashboard : [];
  const now = Date.now();

  return list.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<ProjectSupportItem>;
    const href = safeHttpUrl(item.href);
    const expiryDate = Date.parse(item.expiryDate || "");
    if (
      !href ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      Number.isNaN(expiryDate) ||
      expiryDate <= now
    ) {
      return [];
    }
    return [
      {
        description:
          typeof item.description === "string" ? item.description : "",
        expiryDate: item.expiryDate || "",
        href,
        logo: safeHttpUrl(item.logo) || "",
        title: item.title.trim(),
      },
    ];
  });
}

export function ProjectSupport() {
  const { t } = useTranslation("dashboard");
  const { data: list, isFetching } = useQuery<ProjectSupportItem[]>({
    gcTime: 6 * 60 * 60 * 1000,
    placeholderData: [],
    queryFn: fetchProjectSupport,
    queryKey: ["projectSupport", "dashboard"],
    retry: 1,
    staleTime: 60 * 60 * 1000,
  });

  if (!(isFetching || list?.length)) return null;

  return (
    <section className="dashboard-section" data-testid="project-support">
      <Card className="dashboard-card gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="border-b px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HeartHandshake className="size-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">
                {t("projectSupport.title", "Project support")}
              </CardTitle>
              <CardDescription>
                {t(
                  "projectSupport.description",
                  "Organizations and services currently supporting PPanel."
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {isFetching && !list?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <Skeleton className="h-20 rounded-xl" key={item} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list?.map((item) => (
                <a
                  className="group flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={item.href}
                  key={`${item.title}-${item.href}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Avatar className="size-10 shrink-0 rounded-lg">
                    <AvatarImage alt="" src={item.logo} />
                    <AvatarFallback className="rounded-lg">
                      {item.title.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">
                      {item.title}
                    </div>
                    <div className="line-clamp-2 text-muted-foreground text-xs">
                      {item.description}
                    </div>
                  </div>
                  <ArrowUpRight className="group-hover:-translate-y-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
