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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { Progress } from "@workspace/ui/components/progress";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  queryRevenueStatistics,
  queryServerTotalData,
  queryTicketWaitReply,
  queryUserStatistics,
} from "@workspace/ui/services/admin/console";
import { formatBytes } from "@workspace/ui/utils/formatting";
import { unitConversion } from "@workspace/ui/utils/unit-conversions";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Gauge,
  Headphones,
  RefreshCw,
  Server,
  Settings2,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Display } from "@/components/display";
import { PageHeader } from "@/components/page-header";
import { StatusChip, type StatusChipTone } from "@/components/status-chip";
import SystemLogsDialog from "./system-logs-dialog";
import SystemVersionCard from "./system-version-card";

type DashboardRange = "month" | "total";
type TrafficType = "nodes" | "users";
type TrafficPeriod = "today" | "yesterday";

type MetricCardProps = {
  description: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  title: string;
  value: React.ReactNode;
};

function MetricCard({
  description,
  icon: MetricIcon,
  loading,
  title,
  value,
}: MetricCardProps) {
  return (
    <Card className="dashboard-card dashboard-metric gap-0 py-0 shadow-none">
      <CardContent className="flex min-h-36 items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-muted-foreground text-sm">{title}</p>
          {loading ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <div className="truncate font-semibold text-2xl tabular-nums tracking-tight sm:text-[1.75rem]">
              {value}
            </div>
          )}
          <div className="min-h-5 text-muted-foreground text-xs">
            {description}
          </div>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <MetricIcon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  description,
  title,
}: {
  description: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <h2 className="font-semibold text-base">{title}</h2>
      <div className="text-muted-foreground text-xs">{description}</div>
    </div>
  );
}

function DataUnavailable({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-center">
      <CircleHelp className="size-6 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}

export default function Statistics() {
  const { t, i18n } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DashboardRange>("month");
  const [trafficType, setTrafficType] = useState<TrafficType>("nodes");
  const [trafficPeriod, setTrafficPeriod] = useState<TrafficPeriod>("today");

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
  const userQuery = useQuery({
    queryKey: ["queryUserStatistics"],
    queryFn: async () => {
      const { data } = await queryUserStatistics();
      return data.data;
    },
  });

  const server = serverQuery.data;
  const pendingTickets = ticketQuery.data || 0;
  const offlineServers = server?.offline_servers || 0;
  const onlineServers = server?.online_servers || 0;
  const serverTotal = onlineServers + offlineServers;
  const onlineRate = serverTotal ? (onlineServers / serverTotal) * 100 : 0;
  const selectedRevenue =
    range === "month" ? revenueQuery.data?.monthly : revenueQuery.data?.all;
  const selectedUsers =
    range === "month" ? userQuery.data?.monthly : userQuery.data?.all;
  const isRefreshing = [serverQuery, ticketQuery, revenueQuery, userQuery].some(
    (query) => query.isFetching
  );
  const updatedAt = Math.max(
    serverQuery.dataUpdatedAt,
    ticketQuery.dataUpdatedAt,
    revenueQuery.dataUpdatedAt,
    userQuery.dataUpdatedAt
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

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Tabs
              onValueChange={(value) => setRange(value as DashboardRange)}
              value={range}
            >
              <TabsList className="h-9">
                <TabsTrigger value="month">{t("month", "Month")}</TabsTrigger>
                <TabsTrigger value="total">{t("total", "Total")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <SystemLogsDialog />
            <Button
              disabled={isRefreshing}
              onClick={() => queryClient.invalidateQueries()}
              size="sm"
            >
              <RefreshCw
                className={isRefreshing ? "animate-spin" : undefined}
              />
              {t("overview.refresh", "Refresh")}
            </Button>
          </>
        }
        description={t(
          "overview.description",
          "Monitor users, revenue, traffic, and system health in one place."
        )}
        eyebrow={
          updatedAt > 0
            ? t("overview.updatedAt", "Updated {{time}}", {
                time: new Date(updatedAt).toLocaleTimeString(i18n.language, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            : t("overview.liveOverview", "Operations overview")
        }
        title={t("overview.title", "Dashboard")}
      />

      <section className="dashboard-section grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description={
            revenueQuery.isError
              ? t("overview.unavailable", "Data unavailable")
              : t("overview.incomeBreakdown", "New purchases and renewals")
          }
          icon={WalletCards}
          loading={revenueQuery.isLoading}
          title={
            range === "month"
              ? t("overview.monthIncome", "Month income")
              : t("totalIncome", "Total income")
          }
          value={
            revenueQuery.isError ? (
              "—"
            ) : (
              <Display type="currency" value={selectedRevenue?.amount_total} />
            )
          }
        />
        <MetricCard
          description={t(
            "overview.newUsersHint",
            "Accounts registered in the selected range"
          )}
          icon={Users}
          loading={userQuery.isLoading}
          title={t("overview.newUsers", "New users")}
          value={userQuery.isError ? "—" : selectedUsers?.register || 0}
        />
        <MetricCard
          description={t("currentlyOnline", "Currently online")}
          icon={Activity}
          loading={serverQuery.isLoading}
          title={t("onlineUsersCount", "Online users")}
          value={serverQuery.isError ? "—" : server?.online_users || 0}
        />
        <MetricCard
          description={
            serverQuery.isError ? (
              t("overview.unavailable", "Data unavailable")
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <ArrowUp className="size-3" />
                  {formatBytes(server?.monthly_upload || 0)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ArrowDown className="size-3" />
                  {formatBytes(server?.monthly_download || 0)}
                </span>
              </span>
            )
          }
          icon={Gauge}
          loading={serverQuery.isLoading}
          title={t("monthTraffic", "Month traffic")}
          value={
            serverQuery.isError
              ? "—"
              : formatBytes(
                  (server?.monthly_upload || 0) +
                    (server?.monthly_download || 0)
                )
          }
        />
      </section>

      <BusinessTrends
        range={range}
        revenue={revenueQuery.data}
        revenueError={revenueQuery.isError}
        revenueLoading={revenueQuery.isLoading}
        users={userQuery.data}
        usersError={userQuery.isError}
        usersLoading={userQuery.isLoading}
      />

      <section className="dashboard-section grid items-stretch gap-4 xl:grid-cols-3">
        <SystemHealthCard
          error={serverQuery.isError}
          loading={serverQuery.isLoading}
          offline={offlineServers}
          online={onlineServers}
          onlineRate={onlineRate}
          serverUpdatedAt={serverQuery.dataUpdatedAt}
          total={serverTotal}
        />
        <ServerSummaryCard
          error={serverQuery.isError}
          loading={serverQuery.isLoading}
          server={server}
        />
        <PendingCard
          loading={serverQuery.isLoading || ticketQuery.isLoading}
          offlineServers={offlineServers}
          pendingTickets={pendingTickets}
          serverError={serverQuery.isError}
          ticketError={ticketQuery.isError}
        />
      </section>

      <TrafficRanking
        data={currentTraffic}
        loading={serverQuery.isLoading}
        onPeriodChange={setTrafficPeriod}
        onTypeChange={setTrafficType}
        period={trafficPeriod}
        serverError={serverQuery.isError}
        trafficType={trafficType}
      />

      <section className="dashboard-section grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <SystemVersionCard />
        <SystemOperations />
      </section>
    </div>
  );
}

function BusinessTrends({
  range,
  revenue,
  revenueError,
  revenueLoading,
  users,
  usersError,
  usersLoading,
}: {
  range: DashboardRange;
  revenue?: API.RevenueStatisticsResponse;
  revenueError: boolean;
  revenueLoading: boolean;
  users?: API.UserStatisticsResponse;
  usersError: boolean;
  usersLoading: boolean;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const revenueRange = range === "month" ? revenue?.monthly : revenue?.all;
  const userRange = range === "month" ? users?.monthly : users?.all;
  const dateFormatter = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(
      year || new Date().getFullYear(),
      (month || 1) - 1,
      day || 1
    ).toLocaleDateString(
      i18n.language,
      range === "month"
        ? { month: "short", day: "numeric" }
        : { year: "2-digit", month: "short" }
    );
  };
  const revenueData =
    revenueRange?.list?.map((item) => ({
      date: item.date,
      newPurchase: unitConversion("centsToDollars", item.new_order_amount),
      renewal: unitConversion("centsToDollars", item.renewal_order_amount),
    })) || [];
  const userData =
    userRange?.list?.map((item) => ({
      date: item.date,
      register: item.register,
      paid: item.new_order_users,
    })) || [];

  return (
    <section className="dashboard-section grid items-stretch gap-4 xl:grid-cols-2">
      <Card className="dashboard-card gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4 border-b px-5 py-4">
          <SectionHeading
            description={t(
              "overview.revenueTrendHint",
              "New purchases and renewals over time"
            )}
            title={t("overview.revenueTrend", "Revenue trend")}
          />
          <div className="shrink-0 text-right">
            <div className="text-muted-foreground text-xs">
              {t("totalIncome", "Total income")}
            </div>
            <div className="font-semibold tabular-nums">
              <Display type="currency" value={revenueRange?.amount_total} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-80 p-5">
          {revenueLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : revenueError || revenueData.length === 0 ? (
            <DataUnavailable
              text={t("overview.unavailable", "Data unavailable")}
            />
          ) : (
            <ChartContainer
              className="h-full max-h-none w-full"
              config={{
                newPurchase: {
                  label: t("newPurchase", "New purchase"),
                  color: "var(--chart-1)",
                },
                renewal: {
                  label: t("repurchase", "Renewal"),
                  color: "var(--chart-4)",
                },
              }}
            >
              <AreaChart data={revenueData} margin={{ left: 4, right: 12 }}>
                <defs>
                  <linearGradient id="revenueBlue" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-newPurchase)"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-newPurchase)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  minTickGap={28}
                  tickFormatter={dateFormatter}
                  tickLine={false}
                  tickMargin={10}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={false}
                />
                <Area
                  dataKey="newPurchase"
                  fill="url(#revenueBlue)"
                  stroke="var(--color-newPurchase)"
                  strokeWidth={2}
                  type="monotone"
                />
                <Area
                  dataKey="renewal"
                  fill="transparent"
                  stroke="var(--color-renewal)"
                  strokeWidth={2}
                  type="monotone"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="dashboard-card gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4 border-b px-5 py-4">
          <SectionHeading
            description={t(
              "overview.userTrendHint",
              "Registrations and first-time purchasers"
            )}
            title={t("overview.userTrend", "New user trend")}
          />
          <div className="shrink-0 text-right">
            <div className="text-muted-foreground text-xs">
              {t("register", "Registered")}
            </div>
            <div className="font-semibold tabular-nums">
              {userRange?.register || 0}
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-80 p-5">
          {usersLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : usersError || userData.length === 0 ? (
            <DataUnavailable
              text={t("overview.unavailable", "Data unavailable")}
            />
          ) : (
            <ChartContainer
              className="h-full max-h-none w-full"
              config={{
                register: {
                  label: t("register", "Register"),
                  color: "var(--chart-2)",
                },
                paid: {
                  label: t("overview.firstPurchaseUsers", "First purchase"),
                  color: "var(--chart-3)",
                },
              }}
            >
              <LineChart data={userData} margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  minTickGap={28}
                  tickFormatter={dateFormatter}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={false}
                />
                <Line
                  dataKey="register"
                  dot={false}
                  stroke="var(--color-register)"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="paid"
                  dot={false}
                  stroke="var(--color-paid)"
                  strokeWidth={2}
                  type="monotone"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SystemHealthCard({
  error,
  loading,
  offline,
  online,
  onlineRate,
  serverUpdatedAt,
  total,
}: {
  error: boolean;
  loading: boolean;
  offline: number;
  online: number;
  onlineRate: number;
  serverUpdatedAt?: number;
  total: number;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const tone: StatusChipTone = loading
    ? "neutral"
    : error
      ? "danger"
      : offline > 0
        ? "warning"
        : "success";
  const label = loading
    ? t("overview.checking", "Checking")
    : error
      ? t("overview.unavailable", "Unavailable")
      : offline > 0
        ? t("overview.needsAttention", "Needs attention")
        : t("overview.operational", "Operational");

  return (
    <Card className="dashboard-card gap-0 py-0 shadow-none">
      <CardHeader className="flex-row items-start justify-between border-b px-5 py-4">
        <SectionHeading
          description={t(
            "overview.systemHealthHint",
            "Current service availability"
          )}
          title={t("overview.systemHealth", "System health")}
        />
        <StatusChip tone={tone}>{label}</StatusChip>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  <span className="font-semibold text-2xl tabular-nums">
                    {error ? "—" : Math.round(onlineRate)}%
                  </span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {t("overview.availability", "availability")}
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">
                  {online} / {total}
                </span>
              </div>
              <Progress className="h-2" value={error ? 0 : onlineRate} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <HealthValue
                label={t("online", "Online")}
                tone="success"
                value={online}
              />
              <HealthValue
                label={t("offline", "Offline")}
                tone={offline ? "danger" : "neutral"}
                value={offline}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {serverUpdatedAt
                ? t("overview.telemetryAt", "Telemetry {{time}}", {
                    time: new Date(serverUpdatedAt).toLocaleTimeString(
                      i18n.language,
                      { hour: "2-digit", minute: "2-digit" }
                    ),
                  })
                : t("overview.waitingTelemetry", "Waiting for telemetry")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HealthValue({
  label,
  tone,
  value,
}: {
  label: string;
  tone: StatusChipTone;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <StatusChip dot tone={tone}>
        {label}
      </StatusChip>
      <div className="mt-2 font-semibold text-xl tabular-nums">{value}</div>
    </div>
  );
}

function ServerSummaryCard({
  error,
  loading,
  server,
}: {
  error: boolean;
  loading: boolean;
  server?: API.ServerTotalDataResponse;
}) {
  const { t } = useTranslation("dashboard");
  const todayTotal =
    (server?.today_upload || 0) + (server?.today_download || 0);
  const monthTotal =
    (server?.monthly_upload || 0) + (server?.monthly_download || 0);

  return (
    <Card className="dashboard-card gap-0 py-0 shadow-none">
      <CardHeader className="flex-row items-start justify-between border-b px-5 py-4">
        <SectionHeading
          description={t(
            "overview.serverSummaryHint",
            "Capacity and transfer summary"
          )}
          title={t("overview.serverSummary", "Nodes and servers")}
        />
        <Button
          asChild
          className="size-8 rounded-full"
          size="icon"
          variant="ghost"
        >
          <Link
            aria-label={t("overview.viewServers", "View servers")}
            to="/dashboard/servers"
          >
            <ArrowUpRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 p-3">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <SummaryRow
              icon={Server}
              label={t("totalServers", "Total servers")}
              value={
                error
                  ? "—"
                  : (server?.online_servers || 0) +
                    (server?.offline_servers || 0)
              }
            />
            <SummaryRow
              icon={Activity}
              label={t("todayTraffic", "Today traffic")}
              value={error ? "—" : formatBytes(todayTotal)}
            />
            <SummaryRow
              icon={Gauge}
              label={t("monthTraffic", "Month traffic")}
              value={error ? "—" : formatBytes(monthTotal)}
            />
            <div className="grid grid-cols-2 gap-2 px-2 pt-2">
              <div className="rounded-lg bg-muted/35 p-3">
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <ArrowUp className="size-3" />{" "}
                  {t("overview.upload", "Upload")}
                </div>
                <div className="mt-1 font-medium text-sm tabular-nums">
                  {formatBytes(server?.monthly_upload || 0)}
                </div>
              </div>
              <div className="rounded-lg bg-muted/35 p-3">
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <ArrowDown className="size-3" />{" "}
                  {t("overview.download", "Download")}
                </div>
                <div className="mt-1 font-medium text-sm tabular-nums">
                  {formatBytes(server?.monthly_download || 0)}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  icon: RowIcon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40">
      <RowIcon className="size-4 text-muted-foreground" />
      <span className="flex-1 text-sm">{label}</span>
      <span className="font-medium text-sm tabular-nums">{value}</span>
    </div>
  );
}

function PendingCard({
  loading,
  offlineServers,
  pendingTickets,
  serverError,
  ticketError,
}: {
  loading: boolean;
  offlineServers: number;
  pendingTickets: number;
  serverError: boolean;
  ticketError: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const hasPending =
    offlineServers > 0 || pendingTickets > 0 || serverError || ticketError;

  return (
    <Card className="dashboard-card gap-0 py-0 shadow-none">
      <CardHeader className="border-b px-5 py-4">
        <SectionHeading
          description={t(
            "overview.pendingHint",
            "Items that may need an operator"
          )}
          title={t("overview.pendingTitle", "Pending items")}
        />
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {loading ? (
          <div className="space-y-3 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <PendingRow
              count={serverError ? undefined : offlineServers}
              icon={Server}
              label={t("overview.offlineServers", "Offline servers")}
              to="/dashboard/servers"
              tone={serverError || offlineServers ? "danger" : "success"}
            />
            <PendingRow
              count={ticketError ? undefined : pendingTickets}
              icon={Headphones}
              label={t("pendingTickets", "Pending tickets")}
              to="/dashboard/ticket"
              tone={
                ticketError ? "danger" : pendingTickets ? "warning" : "success"
              }
            />
            <Separator className="my-3" />
            <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
              {hasPending ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-[var(--admin-warning)]" />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-[var(--admin-success)]" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {hasPending
                    ? t("overview.reviewRequired", "Review recommended")
                    : t("overview.allClear", "All clear")}
                </p>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {hasPending
                    ? t(
                        "overview.reviewRequiredHint",
                        "Open an item to investigate its current state."
                      )
                    : t(
                        "overview.allClearHint",
                        "No operational action is currently required."
                      )}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PendingRow({
  count,
  icon: RowIcon,
  label,
  to,
  tone,
}: {
  count?: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: "/dashboard/servers" | "/dashboard/ticket";
  tone: StatusChipTone;
}) {
  return (
    <Link
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
      to={to}
    >
      <RowIcon className="size-4 text-muted-foreground" />
      <span className="flex-1 text-sm">{label}</span>
      <StatusChip dot={false} tone={tone}>
        {count ?? "—"}
      </StatusChip>
      <ArrowUpRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

function TrafficRanking({
  data,
  loading,
  onPeriodChange,
  onTypeChange,
  period,
  serverError,
  trafficType,
}: {
  data: { name: string | number; traffic: number }[];
  loading: boolean;
  onPeriodChange: (period: TrafficPeriod) => void;
  onTypeChange: (type: TrafficType) => void;
  period: TrafficPeriod;
  serverError: boolean;
  trafficType: TrafficType;
}) {
  const { t } = useTranslation("dashboard");

  return (
    <section className="dashboard-section">
      <Card className="dashboard-card gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeading
            description={t(
              "overview.trafficRankingHint",
              "Top eight records by transferred traffic"
            )}
            title={t("trafficRank", "Traffic ranking")}
          />
          <div className="flex flex-wrap gap-2">
            <Tabs
              onValueChange={(value) => onTypeChange(value as TrafficType)}
              value={trafficType}
            >
              <TabsList>
                <TabsTrigger value="nodes">{t("nodes", "Nodes")}</TabsTrigger>
                <TabsTrigger value="users">{t("users", "Users")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs
              onValueChange={(value) => onPeriodChange(value as TrafficPeriod)}
              value={period}
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
        <CardContent className="h-[360px] p-5">
          {loading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : serverError || data.length === 0 ? (
            <DataUnavailable
              text={t("overview.unavailable", "Data unavailable")}
            />
          ) : (
            <ChartContainer
              className="h-full max-h-none w-full"
              config={{
                traffic: {
                  label: t("traffic", "Traffic"),
                  color: "var(--chart-1)",
                },
              }}
            >
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 4, right: 28 }}
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
                  tickMargin={10}
                  type="category"
                  width={96}
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
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SystemOperations() {
  const { t } = useTranslation("dashboard");
  const links = [
    {
      icon: Users,
      label: t("overview.users", "Users"),
      to: "/dashboard/user" as const,
    },
    {
      icon: Server,
      label: t("overview.servers", "Servers"),
      to: "/dashboard/servers" as const,
    },
    {
      icon: WalletCards,
      label: t("overview.orders", "Orders"),
      to: "/dashboard/order" as const,
    },
    {
      icon: Settings2,
      label: t("overview.settings", "System settings"),
      to: "/dashboard/system" as const,
    },
  ];

  return (
    <Card className="dashboard-card gap-0 py-0 shadow-none">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="text-base">
          {t("overview.systemOperations", "System operations")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t(
            "overview.systemOperationsHint",
            "Administration shortcuts and diagnostics"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-4">
        {links.map((item) => (
          <Link
            className="group flex min-h-20 flex-col justify-between rounded-xl border bg-muted/20 p-3 transition-colors hover:border-primary/30 hover:bg-muted/50"
            key={item.to}
            to={item.to}
          >
            <item.icon className="size-4 text-muted-foreground group-hover:text-primary" />
            <div className="flex items-end justify-between gap-2 text-sm">
              <span>{item.label}</span>
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
        <SystemLogsDialog
          size="sm"
          trigger={
            <Button className="col-span-2 mt-1" variant="outline">
              <Activity />
              {t("overview.openSystemLogs", "Open system logs")}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
