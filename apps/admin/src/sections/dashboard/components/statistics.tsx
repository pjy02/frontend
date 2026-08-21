"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import Empty from "@workspace/ui/composed/empty";
import { Icon } from "@workspace/ui/composed/icon";
import {
  queryRevenueStatistics,
  queryServerTotalData,
  queryTicketWaitReply,
} from "@workspace/ui/services/admin/console";
import { formatBytes } from "@workspace/ui/utils/formatting";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Display } from "@/components/display";
import { RevenueStatisticsCard } from "./revenue-statistics-card";
import SystemLogsDialog from "./system-logs-dialog";
import SystemVersionCard from "./system-version-card";
import { UserStatisticsCard } from "./user-statistics-card";

type MetricCardProps = {
  description: string;
  icon: string;
  loading?: boolean;
  title: string;
  tone?: "default" | "danger";
  value: React.ReactNode;
};

function MetricCard({
  description,
  icon,
  loading,
  title,
  tone = "default",
  value,
}: MetricCardProps) {
  const toneClass =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : "bg-primary/10 text-primary";

  return (
    <Card className="dashboard-card gap-0 border-border/70 py-0 shadow-none">
      <CardContent className="flex min-h-32 items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-muted-foreground text-sm">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <div className="truncate font-semibold text-2xl tabular-nums tracking-tight sm:text-3xl">
              {value}
            </div>
          )}
          <p className="truncate text-muted-foreground text-xs">
            {description}
          </p>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
        >
          <Icon className="size-5" icon={icon} />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="font-semibold text-base">{title}</h2>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
}

function QuickLink({
  label,
  to,
}: {
  label: string;
  to:
    | "/dashboard/order"
    | "/dashboard/product"
    | "/dashboard/servers"
    | "/dashboard/user";
}) {
  return (
    <Link
      className="flex items-center justify-between rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      to={to}
    >
      {label}
      <Icon className="size-4" icon="uil:arrow-up-right" />
    </Link>
  );
}

export default function Statistics() {
  const { t, i18n } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const [trafficType, setTrafficType] = useState<"nodes" | "users">("nodes");
  const [trafficPeriod, setTrafficPeriod] = useState<"today" | "yesterday">(
    "today"
  );

  const serverQuery = useQuery({
    queryKey: ["queryServerTotalData"],
    queryFn: async () => {
      const { data } = await queryServerTotalData();
      return data.data;
    },
  });
  const ticketQuery = useQuery({
    queryKey: ["queryTicketWaitReply"],
    queryFn: async () => {
      const { data } = await queryTicketWaitReply();
      return data.data?.count;
    },
  });
  const revenueQuery = useQuery({
    queryKey: ["queryRevenueStatistics"],
    queryFn: async () => {
      const { data } = await queryRevenueStatistics();
      return data.data;
    },
  });

  const server = serverQuery.data;
  const pendingTickets = ticketQuery.data || 0;
  const offlineServers = server?.offline_servers || 0;
  const onlineServers = server?.online_servers || 0;
  const serverTotal = onlineServers + offlineServers;
  const isRefreshing =
    serverQuery.isFetching || ticketQuery.isFetching || revenueQuery.isFetching;
  const updatedAt = Math.max(
    serverQuery.dataUpdatedAt,
    ticketQuery.dataUpdatedAt,
    revenueQuery.dataUpdatedAt
  );

  const trafficData = {
    nodes: {
      today:
        server?.server_traffic_ranking_today?.map((item) => ({
          name: item.name,
          traffic: item.download + item.upload,
        })) || [],
      yesterday:
        server?.server_traffic_ranking_yesterday?.map((item) => ({
          name: item.name,
          traffic: item.download + item.upload,
        })) || [],
    },
    users: {
      today:
        server?.user_traffic_ranking_today?.map((item) => ({
          name: item.sid,
          traffic: item.download + item.upload,
        })) || [],
      yesterday:
        server?.user_traffic_ranking_yesterday?.map((item) => ({
          name: item.sid,
          traffic: item.download + item.upload,
        })) || [],
    },
  };
  const currentTraffic = trafficData[trafficType][trafficPeriod].slice(0, 8);
  const hasOperationalNotice = offlineServers > 0 || pendingTickets > 0;
  const operationalNotice =
    offlineServers > 0 && pendingTickets > 0
      ? t(
          "overview.notice",
          "{{offline}} servers are offline and {{tickets}} tickets need attention.",
          { offline: offlineServers, tickets: pendingTickets }
        )
      : offlineServers > 0
        ? t(
            "overview.noticeServers",
            "{{offline}} servers are currently offline.",
            { offline: offlineServers }
          )
        : t(
            "overview.noticeTickets",
            "{{tickets}} tickets need attention.",
            { tickets: pendingTickets }
          );

  return (
    <div className="space-y-5">
      <header className="dashboard-section flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("overview.title", "Dashboard")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t(
              "overview.description",
              "Monitor users, revenue, traffic, and system health."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {updatedAt > 0 && (
            <span className="mr-1 text-muted-foreground text-xs">
              {t("overview.updatedAt", "Updated {{time}}", {
                time: new Date(updatedAt).toLocaleTimeString(i18n.language, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </span>
          )}
          <SystemLogsDialog />
          <Button
            disabled={isRefreshing}
            onClick={() => queryClient.invalidateQueries()}
            size="sm"
          >
            <Icon
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              icon="uil:refresh"
            />
            {t("overview.refresh", "Refresh")}
          </Button>
        </div>
      </header>

      {hasOperationalNotice && (
        <div className="dashboard-section flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Icon
              className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
              icon="uil:exclamation-triangle"
            />
            <span>{operationalNotice}</span>
          </div>
          <div className="flex shrink-0 gap-3 font-medium text-xs">
            {offlineServers > 0 && (
              <Link className="hover:underline" to="/dashboard/servers">
                {t("overview.viewServers", "View servers")}
              </Link>
            )}
            {pendingTickets > 0 && (
              <Link className="hover:underline" to="/dashboard/ticket">
                {t("overview.viewTickets", "View tickets")}
              </Link>
            )}
          </div>
        </div>
      )}

      <section className="dashboard-section grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description={
            revenueQuery.isError
              ? t("overview.unavailable", "Data unavailable")
              : t(
                  "overview.todayIncomeHint",
                  "New purchases and renewals"
                )
          }
          icon="uil:chart-growth"
          loading={revenueQuery.isLoading}
          title={t("overview.todayIncome", "Today's income")}
          value={
            revenueQuery.isError ? (
              "—"
            ) : (
              <Display
                type="currency"
                value={revenueQuery.data?.today.amount_total}
              />
            )
          }
        />
        <MetricCard
          description={
            serverQuery.isError
              ? t("overview.unavailable", "Data unavailable")
              : t("currentlyOnline", "Currently Online")
          }
          icon="uil:users-alt"
          loading={serverQuery.isLoading}
          title={t("onlineUsersCount", "Online Users")}
          value={serverQuery.isError ? "—" : server?.online_users || 0}
        />
        <MetricCard
          description={
            serverQuery.isError
              ? t("overview.unavailable", "Data unavailable")
              : `↑ ${formatBytes(server?.today_upload || 0)}  ↓ ${formatBytes(server?.today_download || 0)}`
          }
          icon="uil:exchange-alt"
          loading={serverQuery.isLoading}
          title={t("todayTraffic", "Today Traffic")}
          value={
            serverQuery.isError
              ? "—"
              : formatBytes(
                  (server?.today_upload || 0) +
                    (server?.today_download || 0)
                )
          }
        />
        <MetricCard
          description={
            serverQuery.isError
              ? t("overview.unavailable", "Data unavailable")
              : `${t("online", "Online")} ${onlineServers} · ${t("offline", "Offline")} ${offlineServers}`
          }
          icon="uil:server-network"
          loading={serverQuery.isLoading}
          title={t("overview.systemHealth", "System health")}
          tone={offlineServers > 0 ? "danger" : "default"}
          value={serverQuery.isError ? "—" : `${onlineServers} / ${serverTotal}`}
        />
      </section>

      <section className="dashboard-section grid items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <RevenueStatisticsCard />
        <div className="grid min-w-0 gap-4">
          <SystemVersionCard />
          <Card className="dashboard-card gap-0 border-border/70 py-0 shadow-none">
            <CardHeader className="gap-1 border-b px-5 py-4">
              <CardTitle className="text-base">
                {t("overview.operations", "Operations")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "overview.operationsHint",
                  "Current workload and quick access"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Link
                  className="rounded-lg border bg-muted/25 p-3 transition-colors hover:border-primary/30 hover:bg-muted/50"
                  to="/dashboard/servers"
                >
                  <p className="text-muted-foreground text-xs">
                    {t("totalServers", "Total Servers")}
                  </p>
                  <p className="mt-1 font-semibold text-xl tabular-nums">
                    {serverQuery.isError ? "—" : serverTotal}
                  </p>
                </Link>
                <Link
                  className="rounded-lg border bg-muted/25 p-3 transition-colors hover:border-primary/30 hover:bg-muted/50"
                  to="/dashboard/ticket"
                >
                  <p className="text-muted-foreground text-xs">
                    {t("pendingTickets", "Pending Tickets")}
                  </p>
                  <p className="mt-1 font-semibold text-xl tabular-nums">
                    {ticketQuery.isError ? "—" : pendingTickets}
                  </p>
                </Link>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <QuickLink
                  label={t("overview.users", "Users")}
                  to="/dashboard/user"
                />
                <QuickLink
                  label={t("overview.servers", "Servers")}
                  to="/dashboard/servers"
                />
                <QuickLink
                  label={t("overview.products", "Products")}
                  to="/dashboard/product"
                />
                <QuickLink
                  label={t("overview.orders", "Orders")}
                  to="/dashboard/order"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="dashboard-section grid items-stretch gap-4 xl:grid-cols-2">
        <UserStatisticsCard />
        <Card className="dashboard-card gap-0 overflow-hidden border-border/70 py-0 shadow-none">
          <CardHeader className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeading
              description={
                serverQuery.isError
                  ? t("overview.unavailable", "Data unavailable")
                  : `${t(
                      "overview.trafficRankingHint",
                      "Top eight records by transferred traffic"
                    )} · ${t("monthTraffic", "Month Traffic")} ${formatBytes(
                      (server?.monthly_upload || 0) +
                        (server?.monthly_download || 0)
                    )}`
              }
              title={t("trafficRank", "Traffic Rank")}
            />
            <div className="flex flex-wrap gap-2">
              <Tabs
                onValueChange={(value) =>
                  setTrafficType(value as "nodes" | "users")
                }
                value={trafficType}
              >
                <TabsList>
                  <TabsTrigger value="nodes">{t("nodes", "Nodes")}</TabsTrigger>
                  <TabsTrigger value="users">{t("users", "Users")}</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs
                onValueChange={(value) =>
                  setTrafficPeriod(value as "today" | "yesterday")
                }
                value={trafficPeriod}
              >
                <TabsList>
                  <TabsTrigger value="today">{t("today", "Today")}</TabsTrigger>
                  <TabsTrigger value="yesterday">
                    {t("yesterday", "Yesterday")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="h-[408px] p-5">
            {serverQuery.isLoading ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton className="h-8 w-full" key={index} />
                ))}
              </div>
            ) : currentTraffic.length > 0 ? (
              <ChartContainer
                className="h-full max-h-none w-full"
                config={{
                  traffic: {
                    label: t("traffic", "Traffic"),
                    color: "var(--primary)",
                  },
                }}
              >
                <BarChart
                  accessibilityLayer
                  data={currentTraffic}
                  layout="vertical"
                  margin={{ left: 4, right: 24 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    tickFormatter={(value) => formatBytes(value || 0)}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="name"
                    tickLine={false}
                    tickMargin={8}
                    type="category"
                    width={84}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatBytes(Number(value) || 0)}
                      />
                    }
                    cursor={false}
                  />
                  <Bar
                    dataKey="traffic"
                    fill="var(--color-traffic)"
                    isAnimationActive
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Empty />
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
