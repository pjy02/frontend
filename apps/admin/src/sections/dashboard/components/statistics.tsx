"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import {
  queryRevenueStatistics,
  queryServerTotalData,
  queryTicketWaitReply,
  queryUserStatistics,
} from "@workspace/ui/services/admin/console";
import { getUserDetail } from "@workspace/ui/services/admin/user";
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
  Maximize2,
  RefreshCw,
  Server,
  Settings2,
  Users,
  WalletCards,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminMotion } from "@/components/motion-provider";
import { PageHeader } from "@/components/page-header";
import { StatusChip, type StatusChipTone } from "@/components/status-chip";
import {
  WorkspaceDialog,
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";
import { useGlobalStore } from "@/stores/global";
import { AnimatedNumber, DashboardDataTransition } from "./dashboard-motion";
import SystemLogsDialog from "./system-logs-dialog";
import SystemVersionCard from "./system-version-card";
import { getTrafficRankWidth, getUserEmail } from "./traffic-ranking-utils";

type DashboardRange = "month" | "total";
type TrafficType = "nodes" | "users";
type TrafficPeriod = "today" | "yesterday";
type TrafficLimit = 5 | 8 | 10 | 20;

type TrafficSourceItem = {
  id: number;
  name?: string;
  uid?: number;
  sid: number;
  upload: number;
  download: number;
};

type TrafficRankingItem = {
  id: number;
  name: string;
  uid?: number;
  sid: number;
  upload: number;
  download: number;
  total: number;
  previousUpload: number;
  previousDownload: number;
  previousTotal: number;
  absoluteChange: number;
  growth: number;
  share: number;
  rankChange?: number;
  isNew: boolean;
};

type TrafficRankingDataset = {
  items: TrafficRankingItem[];
  currentTotal: number;
  previousTotal: number;
};

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateKey(value: string, offset: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1, 12);
  date.setDate(date.getDate() + offset);
  return getDateKey(date);
}

function AnimatedCurrency({
  className,
  value = 0,
}: {
  className?: string;
  value?: number;
}) {
  const currencySymbol = useGlobalStore(
    (state) => state.common.currency?.currency_symbol || ""
  );
  return (
    <AnimatedNumber
      className={className}
      format={(latest) =>
        `${currencySymbol}${unitConversion("centsToDollars", latest).toFixed(2)}`
      }
      value={value}
    />
  );
}

function DashboardChartTooltipContent(
  props: React.ComponentProps<typeof ChartTooltipContent>
) {
  const { reducedMotion } = useAdminMotion();
  const tooltipKey = String(
    props.label ?? props.payload?.[0]?.payload?.date ?? "dashboard-tooltip"
  );

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="dashboard-chart-tooltip-transition"
        data-tooltip-key={tooltipKey}
        exit={reducedMotion ? undefined : { opacity: 0, y: -2 }}
        initial={reducedMotion ? false : { opacity: 0, y: 2 }}
        key={tooltipKey}
        transition={{ duration: reducedMotion ? 0 : 0.1 }}
      >
        <ChartTooltipContent {...props} />
      </motion.div>
    </AnimatePresence>
  );
}

function createTrafficRanking(
  server: API.ServerTotalDataResponse | undefined,
  type: TrafficType,
  period: TrafficPeriod
): TrafficRankingDataset {
  if (type === "nodes") {
    const today = (server?.server_traffic_ranking_today || []).map((item) => ({
      id: item.server_id,
      name: item.name,
      sid: item.server_id,
      upload: item.upload,
      download: item.download,
    }));
    const yesterday = (server?.server_traffic_ranking_yesterday || []).map(
      (item) => ({
        id: item.server_id,
        name: item.name,
        sid: item.server_id,
        upload: item.upload,
        download: item.download,
      })
    );
    return createTrafficRankingDataset(
      period === "today" ? today : yesterday,
      period === "today" ? yesterday : today
    );
  }

  const today = (server?.user_traffic_ranking_today || []).map((item) => ({
    id: item.sid,
    name: `UID ${item.uid}`,
    sid: item.sid,
    uid: item.uid,
    upload: item.upload,
    download: item.download,
  }));
  const yesterday = (server?.user_traffic_ranking_yesterday || []).map(
    (item) => ({
      id: item.sid,
      name: `UID ${item.uid}`,
      sid: item.sid,
      uid: item.uid,
      upload: item.upload,
      download: item.download,
    })
  );
  return createTrafficRankingDataset(
    period === "today" ? today : yesterday,
    period === "today" ? yesterday : today
  );
}

function createTrafficRankingDataset(
  current: TrafficSourceItem[],
  previous: TrafficSourceItem[]
): TrafficRankingDataset {
  const sortedCurrent = [...current].sort(
    (left, right) =>
      right.upload + right.download - (left.upload + left.download)
  );
  const sortedPrevious = [...previous].sort(
    (left, right) =>
      right.upload + right.download - (left.upload + left.download)
  );
  const previousById = new Map(sortedPrevious.map((item) => [item.id, item]));
  const previousRankById = new Map(
    sortedPrevious.map((item, index) => [item.id, index + 1])
  );
  const currentTotal = sortedCurrent.reduce(
    (sum, item) => sum + item.upload + item.download,
    0
  );
  const previousTotal = sortedPrevious.reduce(
    (sum, item) => sum + item.upload + item.download,
    0
  );

  return {
    currentTotal,
    previousTotal,
    items: sortedCurrent.map((item, index) => {
      const previousItem = previousById.get(item.id);
      const total = item.upload + item.download;
      const previousItemTotal = previousItem
        ? previousItem.upload + previousItem.download
        : 0;
      const absoluteChange = total - previousItemTotal;
      const previousRank = previousRankById.get(item.id);
      return {
        ...item,
        name: item.name || `#${item.id}`,
        total,
        previousUpload: previousItem?.upload || 0,
        previousDownload: previousItem?.download || 0,
        previousTotal: previousItemTotal,
        absoluteChange,
        growth: previousItemTotal
          ? (absoluteChange / previousItemTotal) * 100
          : total
            ? 100
            : 0,
        share: currentTotal ? (total / currentTotal) * 100 : 0,
        rankChange:
          previousRank === undefined ? undefined : previousRank - (index + 1),
        isNew: previousRank === undefined,
      };
    }),
  };
}

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
      <CardContent className="dashboard-metric__content flex min-h-36 items-start justify-between gap-4 p-5">
        <div className="dashboard-metric__body min-w-0 space-y-2">
          <p className="font-medium text-muted-foreground text-sm">{title}</p>
          {loading ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <div className="dashboard-metric__value truncate font-semibold text-2xl tabular-nums tracking-tight sm:text-[1.75rem]">
              {value}
            </div>
          )}
          <div className="dashboard-metric__description min-h-5 text-muted-foreground text-xs">
            {description}
          </div>
        </div>
        <div className="dashboard-metric__icon grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
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
  const [trafficLimit, setTrafficLimit] = useState<TrafficLimit>(8);

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
  const rankedUserIds = Array.from(
    new Set(
      [
        ...(server?.user_traffic_ranking_today || []).slice(0, 20),
        ...(server?.user_traffic_ranking_yesterday || []).slice(0, 20),
      ].map((item) => item.uid)
    )
  );
  const rankedUserQueries = useQueries({
    queries: rankedUserIds.map((uid) => ({
      gcTime: 30 * 60 * 1000,
      queryFn: async () => {
        const { data: response } = await getUserDetail(
          { id: uid },
          { skipErrorHandler: true }
        );
        return response.data ?? null;
      },
      queryKey: ["getUserDetail", uid],
      retry: 1,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const rankedUserEmailById = new Map(
    rankedUserIds.map((uid, index) => [
      uid,
      getUserEmail(rankedUserQueries[index]?.data),
    ])
  );
  const pendingRankedUserIds = new Set(
    rankedUserIds.filter((_, index) => rankedUserQueries[index]?.isPending)
  );
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

  const currentTraffic = createTrafficRanking(
    server,
    trafficType,
    trafficPeriod
  );

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Tabs
              className="dashboard-range-tabs"
              onValueChange={(value) => setRange(value as DashboardRange)}
              value={range}
            >
              <TabsList className="dashboard-range-tabs__list h-9">
                <TabsTrigger
                  className="dashboard-range-tabs__trigger"
                  value="month"
                >
                  {t("month", "Month")}
                </TabsTrigger>
                <TabsTrigger
                  className="dashboard-range-tabs__trigger"
                  value="total"
                >
                  {t("total", "Total")}
                </TabsTrigger>
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

      <section className="dashboard-metrics dashboard-section grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
              <AnimatedCurrency value={selectedRevenue?.amount_total} />
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
          value={
            userQuery.isError ? (
              "—"
            ) : (
              <AnimatedNumber value={selectedUsers?.register || 0} />
            )
          }
        />
        <MetricCard
          description={t("currentlyOnline", "Currently online")}
          icon={Activity}
          loading={serverQuery.isLoading}
          title={t("onlineUsersCount", "Online users")}
          value={
            serverQuery.isError ? (
              "—"
            ) : (
              <AnimatedNumber value={server?.online_users || 0} />
            )
          }
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
            serverQuery.isError ? (
              "—"
            ) : (
              <AnimatedNumber
                format={formatBytes}
                value={
                  (server?.monthly_upload || 0) +
                  (server?.monthly_download || 0)
                }
              />
            )
          }
        />
      </section>

      <TrafficRanking
        activeDate={
          trafficPeriod === "today"
            ? getDateKey()
            : shiftDateKey(getDateKey(), -1)
        }
        data={currentTraffic}
        limit={trafficLimit}
        loading={serverQuery.isLoading}
        onLimitChange={setTrafficLimit}
        onPeriodChange={setTrafficPeriod}
        onTypeChange={setTrafficType}
        pendingUserIds={pendingRankedUserIds}
        period={trafficPeriod}
        serverError={serverQuery.isError}
        systemTotal={
          trafficPeriod === "today"
            ? (server?.today_upload || 0) + (server?.today_download || 0)
            : undefined
        }
        trafficType={trafficType}
        userEmailById={rankedUserEmailById}
      />

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
  const { reducedMotion } = useAdminMotion();
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
      date: item.date || "",
      newPurchase: unitConversion("centsToDollars", item.new_order_amount),
      renewal: unitConversion("centsToDollars", item.renewal_order_amount),
    })) || [];
  const userData =
    userRange?.list?.map((item) => ({
      date: item.date || "",
      register: item.register,
      paid: item.new_order_users,
    })) || [];
  const renderRevenueChart = (expanded = false) => {
    const transitionKey = `revenue-${range}-${expanded ? "expanded" : "inline"}-${revenueLoading ? "loading" : revenueError || revenueData.length === 0 ? "unavailable" : "ready"}`;
    if (revenueLoading) {
      return (
        <DashboardDataTransition transitionKey={transitionKey}>
          <Skeleton className="h-full w-full rounded-lg" />
        </DashboardDataTransition>
      );
    }
    if (revenueError || revenueData.length === 0) {
      return (
        <DashboardDataTransition transitionKey={transitionKey}>
          <DataUnavailable
            text={t("overview.unavailable", "Data unavailable")}
          />
        </DashboardDataTransition>
      );
    }
    return (
      <DashboardDataTransition transitionKey={transitionKey}>
        <RevenueTrendChart
          data={revenueData}
          dateFormatter={dateFormatter}
          expanded={expanded}
          reducedMotion={reducedMotion}
        />
      </DashboardDataTransition>
    );
  };
  const renderUserChart = (expanded = false) => {
    const transitionKey = `users-${range}-${expanded ? "expanded" : "inline"}-${usersLoading ? "loading" : usersError || userData.length === 0 ? "unavailable" : "ready"}`;
    if (usersLoading) {
      return (
        <DashboardDataTransition transitionKey={transitionKey}>
          <Skeleton className="h-full w-full rounded-lg" />
        </DashboardDataTransition>
      );
    }
    if (usersError || userData.length === 0) {
      return (
        <DashboardDataTransition transitionKey={transitionKey}>
          <DataUnavailable
            text={t("overview.unavailable", "Data unavailable")}
          />
        </DashboardDataTransition>
      );
    }
    return (
      <DashboardDataTransition transitionKey={transitionKey}>
        <UserTrendChart
          data={userData}
          dateFormatter={dateFormatter}
          reducedMotion={reducedMotion}
        />
      </DashboardDataTransition>
    );
  };

  return (
    <section className="dashboard-section grid items-stretch gap-4 xl:grid-cols-2">
      <Card className="dashboard-card gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="dashboard-trend-header flex-row items-start justify-between gap-4 border-b px-5 py-4">
          <SectionHeading
            description={t(
              "overview.revenueTrendHint",
              "New purchases and renewals over time"
            )}
            title={t("overview.revenueTrend", "Revenue trend")}
          />
          <div className="dashboard-trend-header__actions flex shrink-0 items-start gap-1.5">
            <div className="dashboard-trend-header__summary text-right">
              <div className="text-muted-foreground text-xs">
                {t("totalIncome", "Total income")}
              </div>
              <div className="font-semibold tabular-nums">
                <AnimatedCurrency value={revenueRange?.amount_total} />
              </div>
            </div>
            <ChartExpandDialog
              description={t(
                "overview.revenueTrendHint",
                "New purchases and renewals over time"
              )}
              disabled={
                revenueLoading || revenueError || revenueData.length === 0
              }
              title={t("overview.revenueTrend", "Revenue trend")}
            >
              {renderRevenueChart(true)}
            </ChartExpandDialog>
          </div>
        </CardHeader>
        <CardContent className="dashboard-trend-chart h-60 p-3 sm:h-72 sm:p-5 lg:h-80">
          {renderRevenueChart()}
        </CardContent>
      </Card>

      <Card className="dashboard-card gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="dashboard-trend-header flex-row items-start justify-between gap-4 border-b px-5 py-4">
          <SectionHeading
            description={t(
              "overview.userTrendHint",
              "Registrations and first-time purchasers"
            )}
            title={t("overview.userTrend", "New user trend")}
          />
          <div className="dashboard-trend-header__actions flex shrink-0 items-start gap-1.5">
            <div className="dashboard-trend-header__summary text-right">
              <div className="text-muted-foreground text-xs">
                {t("register", "Registered")}
              </div>
              <div className="font-semibold tabular-nums">
                <AnimatedNumber value={userRange?.register || 0} />
              </div>
            </div>
            <ChartExpandDialog
              description={t(
                "overview.userTrendHint",
                "Registrations and first-time purchasers"
              )}
              disabled={usersLoading || usersError || userData.length === 0}
              title={t("overview.userTrend", "New user trend")}
            >
              {renderUserChart(true)}
            </ChartExpandDialog>
          </div>
        </CardHeader>
        <CardContent className="dashboard-trend-chart h-60 p-3 sm:h-72 sm:p-5 lg:h-80">
          {renderUserChart()}
        </CardContent>
      </Card>
    </section>
  );
}

function ChartExpandDialog({
  children,
  description,
  disabled,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  disabled: boolean;
  title: React.ReactNode;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <WorkspaceDialog>
      <WorkspaceDialogTrigger asChild>
        <Button
          aria-label={t("overview.expandChart", "Expand chart")}
          disabled={disabled}
          size="icon-sm"
          title={t("overview.expandChart", "Expand chart")}
          variant="ghost"
        >
          <Maximize2 />
        </Button>
      </WorkspaceDialogTrigger>
      <WorkspaceDialogContent className="dashboard-chart-dialog" size="xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle>{title}</WorkspaceDialogTitle>
          <WorkspaceDialogDescription>{description}</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody className="flex min-h-0 overflow-hidden p-3 sm:p-6">
          <div className="dashboard-chart-dialog__canvas h-full min-h-96 w-full">
            {children}
          </div>
        </WorkspaceDialogBody>
      </WorkspaceDialogContent>
    </WorkspaceDialog>
  );
}

function RevenueTrendChart({
  data,
  dateFormatter,
  expanded = false,
  reducedMotion,
}: {
  data: Array<{ date: string; newPurchase: number; renewal: number }>;
  dateFormatter: (value: string) => string;
  expanded?: boolean;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const gradientId = expanded ? "revenueBlueExpanded" : "revenueBlue";
  return (
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
      <AreaChart data={data} margin={{ left: 4, right: 12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
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
          content={<DashboardChartTooltipContent />}
          cursor={false}
        />
        <Area
          animationDuration={650}
          animationEasing="ease-out"
          dataKey="newPurchase"
          fill={`url(#${gradientId})`}
          isAnimationActive={!reducedMotion}
          stroke="var(--color-newPurchase)"
          strokeWidth={2}
          type="monotone"
        />
        <Area
          animationDuration={650}
          animationEasing="ease-out"
          dataKey="renewal"
          fill="transparent"
          isAnimationActive={!reducedMotion}
          stroke="var(--color-renewal)"
          strokeWidth={2}
          type="monotone"
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}

function UserTrendChart({
  data,
  dateFormatter,
  reducedMotion,
}: {
  data: Array<{ date: string; paid: number; register: number }>;
  dateFormatter: (value: string) => string;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation("dashboard");
  return (
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
      <LineChart data={data} margin={{ left: 4, right: 12 }}>
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
          content={<DashboardChartTooltipContent />}
          cursor={false}
        />
        <Line
          animationDuration={650}
          animationEasing="ease-out"
          dataKey="register"
          dot={false}
          isAnimationActive={!reducedMotion}
          stroke="var(--color-register)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          animationDuration={650}
          animationEasing="ease-out"
          dataKey="paid"
          dot={false}
          isAnimationActive={!reducedMotion}
          stroke="var(--color-paid)"
          strokeWidth={2}
          type="monotone"
        />
        <ChartLegend content={<ChartLegendContent />} />
      </LineChart>
    </ChartContainer>
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
  const { reducedMotion } = useAdminMotion();
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
    <Card
      className="dashboard-card dashboard-system-health gap-0 py-0 shadow-none"
      data-health-tone={tone}
    >
      <CardHeader className="flex-row items-start justify-between border-b px-5 py-4">
        <SectionHeading
          description={t(
            "overview.systemHealthHint",
            "Current service availability"
          )}
          title={t("overview.systemHealth", "System health")}
        />
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="dashboard-system-health__status"
            exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            key={tone}
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
          >
            <StatusChip tone={tone}>{label}</StatusChip>
          </motion.div>
        </AnimatePresence>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {loading ? (
          <DashboardDataTransition transitionKey="health-loading">
            <Skeleton className="h-28 w-full" />
          </DashboardDataTransition>
        ) : (
          <DashboardDataTransition
            transitionKey={error ? "health-error" : "health-ready"}
          >
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  {error ? (
                    <span className="font-semibold text-2xl tabular-nums">
                      —
                    </span>
                  ) : (
                    <AnimatedNumber
                      className="font-semibold text-2xl tabular-nums"
                      format={(value) => `${Math.round(value)}%`}
                      value={onlineRate}
                    />
                  )}
                  <span className="ml-2 text-muted-foreground text-xs">
                    {t("overview.availability", "availability")}
                  </span>
                </div>
                <span className="inline-flex text-muted-foreground text-xs tabular-nums">
                  <AnimatedNumber value={online} />
                  <span aria-hidden="true">&nbsp;/&nbsp;</span>
                  <AnimatedNumber value={total} />
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
          </DashboardDataTransition>
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
      <AnimatedNumber
        className="mt-2 block font-semibold text-xl tabular-nums"
        value={value}
      />
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
  activeDate,
  data,
  limit,
  loading,
  onLimitChange,
  onPeriodChange,
  onTypeChange,
  pendingUserIds,
  period,
  serverError,
  systemTotal,
  trafficType,
  userEmailById,
}: {
  activeDate: string;
  data: TrafficRankingDataset;
  limit: TrafficLimit;
  loading: boolean;
  onLimitChange: (value: TrafficLimit) => void;
  onPeriodChange: (period: TrafficPeriod) => void;
  onTypeChange: (type: TrafficType) => void;
  pendingUserIds: Set<number>;
  period: TrafficPeriod;
  serverError: boolean;
  systemTotal?: number;
  trafficType: TrafficType;
  userEmailById: Map<number, string | undefined>;
}) {
  const { t } = useTranslation("dashboard");
  const { reducedMotion } = useAdminMotion();
  const visibleData = data.items.slice(0, limit);
  const leaderTotal = visibleData.reduce(
    (maximum, item) => Math.max(maximum, item.total),
    0
  );
  const visibleTotal = visibleData.reduce((sum, item) => sum + item.total, 0);
  const upload = data.items.reduce((sum, item) => sum + item.upload, 0);
  const download = data.items.reduce((sum, item) => sum + item.download, 0);
  const growth = data.previousTotal
    ? ((data.currentTotal - data.previousTotal) / data.previousTotal) * 100
    : data.currentTotal
      ? 100
      : 0;
  const shareBase = systemTotal || data.currentTotal;
  const visibleShare = shareBase ? (visibleTotal / shareBase) * 100 : 0;
  const currentLabel =
    period === "today" ? t("today", "Today") : t("yesterday", "Yesterday");
  const previousLabel =
    period === "today" ? t("yesterday", "Yesterday") : t("today", "Today");

  return (
    <section className="dashboard-section">
      <Card className="dashboard-card gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="dashboard-traffic-header flex flex-col gap-4 border-b px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <SectionHeading
            description={t(
              "overview.trafficRankingHint",
              "Compare upload, download, rank and period-over-period changes"
            )}
            title={t("trafficRank", "Traffic ranking")}
          />
          <div className="dashboard-traffic-controls grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Tabs
              className="dashboard-traffic-controls__tabs"
              onValueChange={(value) => onTypeChange(value as TrafficType)}
              value={trafficType}
            >
              <TabsList className="dashboard-traffic-controls__tabs-list">
                <TabsTrigger value="nodes">{t("nodes", "Nodes")}</TabsTrigger>
                <TabsTrigger value="users">{t("users", "Users")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs
              className="dashboard-traffic-controls__tabs"
              onValueChange={(value) => onPeriodChange(value as TrafficPeriod)}
              value={period}
            >
              <TabsList className="dashboard-traffic-controls__tabs-list">
                <TabsTrigger value="today">{t("today", "Today")}</TabsTrigger>
                <TabsTrigger value="yesterday">
                  {t("yesterday", "Yesterday")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Select
              onValueChange={(value) =>
                onLimitChange(Number(value) as TrafficLimit)
              }
              value={String(limit)}
            >
              <SelectTrigger
                aria-label={t("overview.rankingLimit", "Ranking size")}
                className="dashboard-traffic-controls__limit h-9 w-full sm:w-28"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 8, 10, 20].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t("overview.topLabel", "Top {{count}}", {
                      count: value,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              asChild
              className="dashboard-traffic-controls__logs w-full sm:w-auto"
              size="sm"
              variant="outline"
            >
              <Link
                search={{ date: activeDate }}
                to={
                  trafficType === "nodes"
                    ? "/dashboard/log/server-traffic"
                    : "/dashboard/log/subscribe-traffic"
                }
              >
                {t("overview.trafficLogs", "Traffic logs")}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-20 w-full rounded-lg" />
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton
                  className="h-20 w-full rounded-lg"
                  key={`traffic-skeleton-${index}`}
                />
              ))}
            </div>
          ) : serverError || data.items.length === 0 ? (
            <div className="p-5">
              <DataUnavailable
                text={t("overview.unavailable", "Data unavailable")}
              />
            </div>
          ) : (
            <>
              <div className="dashboard-traffic-summary grid grid-cols-2 border-b xl:grid-cols-5">
                <TrafficSummaryValue
                  format={formatBytes}
                  hint={
                    systemTotal === undefined
                      ? t(
                          "overview.systemTotalHistoricalHint",
                          "Historical system total is not provided by the current API"
                        )
                      : t("overview.systemTotalHint", "All traffic today")
                  }
                  label={t("overview.systemTotal", "System total")}
                  value={systemTotal}
                />
                <TrafficSummaryValue
                  className="border-l"
                  format={formatBytes}
                  hint={t(
                    "overview.rankingDatasetHint",
                    "{{count}} records returned by the ranking source",
                    { count: data.items.length }
                  )}
                  label={t("overview.rankingDatasetTotal", "Ranking total")}
                  value={data.currentTotal}
                />
                <TrafficSummaryValue
                  className="border-t xl:border-t-0 xl:border-l"
                  format={formatBytes}
                  hint={t("overview.topShare", "{{share}}% of {{scope}}", {
                    share: visibleShare.toFixed(1),
                    scope:
                      systemTotal === undefined
                        ? t("overview.rankingDataset", "ranking data")
                        : t("overview.systemTraffic", "system traffic"),
                  })}
                  label={t("overview.topLabel", "Top {{count}}", {
                    count: limit,
                  })}
                  value={visibleTotal}
                />
                <div className="border-t border-l px-5 py-4 xl:border-t-0">
                  <div className="text-muted-foreground text-xs">
                    {t("overview.transferSplit", "Upload / Download")}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-medium text-sm tabular-nums">
                    <span className="inline-flex items-center gap-1 text-chart-1">
                      <ArrowUp className="size-3.5" /> {formatBytes(upload)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-chart-4">
                      <ArrowDown className="size-3.5" /> {formatBytes(download)}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 border-t px-5 py-4 xl:col-span-1 xl:border-t-0 xl:border-l">
                  <div className="text-muted-foreground text-xs">
                    {t("overview.periodComparison", "{{date}} / change", {
                      date: previousLabel,
                    })}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <AnimatedNumber
                      className="font-semibold text-base tabular-nums"
                      format={formatBytes}
                      value={data.previousTotal}
                    />
                    <GrowthChip value={growth} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("overview.currentPeriod", "Current period: {{date}}", {
                      date: currentLabel,
                    })}
                  </div>
                </div>
              </div>
              <LayoutGroup id={`traffic-ranking-${trafficType}`}>
                <ol className="dashboard-traffic-list divide-y">
                  <AnimatePresence initial={!reducedMotion} mode="popLayout">
                    {visibleData.map((item, index) => (
                      <TrafficRankingRow
                        currentLabel={currentLabel}
                        index={index}
                        item={item}
                        key={`${trafficType}-${item.id}`}
                        leaderTotal={leaderTotal}
                        previousLabel={previousLabel}
                        reducedMotion={reducedMotion}
                        selectedDate={activeDate}
                        trafficType={trafficType}
                        userEmail={
                          item.uid === undefined
                            ? undefined
                            : userEmailById.get(item.uid)
                        }
                        userEmailLoading={
                          item.uid === undefined
                            ? false
                            : pendingUserIds.has(item.uid)
                        }
                      />
                    ))}
                  </AnimatePresence>
                </ol>
              </LayoutGroup>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function TrafficSummaryValue({
  className,
  format,
  hint,
  label,
  value,
}: {
  className?: string;
  format: (value: number) => string;
  hint?: React.ReactNode;
  label: string;
  value?: number;
}) {
  return (
    <div className={cn("px-5 py-4", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      {value === undefined ? (
        <div className="mt-1 font-semibold text-base">—</div>
      ) : (
        <AnimatedNumber
          className="mt-1 block font-semibold text-base tabular-nums"
          format={format}
          value={value}
        />
      )}
      {hint ? (
        <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function GrowthChip({ value }: { value: number }) {
  const { t } = useTranslation("dashboard");
  const tone: StatusChipTone =
    value > 0 ? "success" : value < 0 ? "danger" : "neutral";
  const label = `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <StatusChip dot={false} tone={tone}>
      <span className="sr-only">{t("overview.growth", "Growth")}: </span>
      {label}
    </StatusChip>
  );
}

function RankChangeChip({ item }: { item: TrafficRankingItem }) {
  const { t } = useTranslation("dashboard");
  if (item.isNew) {
    return (
      <StatusChip dot={false} tone="info">
        {t("overview.newToRanking", "New")}
      </StatusChip>
    );
  }
  if (!item.rankChange) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        {t("overview.rankUnchanged", "Rank unchanged")}
      </span>
    );
  }
  const improved = item.rankChange > 0;
  const RankIcon = improved ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        improved ? "text-[var(--admin-success)]" : "text-destructive"
      )}
    >
      <RankIcon className="size-3" />
      {Math.abs(item.rankChange)}
      <span className="sr-only">
        {improved
          ? t("overview.rankImproved", "rank improved")
          : t("overview.rankDropped", "rank dropped")}
      </span>
    </span>
  );
}

function TrafficRankingRow({
  currentLabel,
  index,
  item,
  leaderTotal,
  previousLabel,
  reducedMotion,
  selectedDate,
  trafficType,
  userEmail,
  userEmailLoading,
}: {
  currentLabel: string;
  index: number;
  item: TrafficRankingItem;
  leaderTotal: number;
  previousLabel: string;
  reducedMotion: boolean;
  selectedDate: string;
  trafficType: TrafficType;
  userEmail?: string;
  userEmailLoading: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const uploadShare = item.total ? (item.upload / item.total) * 100 : 0;
  const downloadShare = 100 - uploadShare;
  const previousUploadShare = item.previousTotal
    ? (item.previousUpload / item.previousTotal) * 100
    : 0;
  const previousDownloadShare = item.previousTotal
    ? 100 - previousUploadShare
    : 0;
  const rankingWidth = getTrafficRankWidth(item.total, leaderTotal);
  const tooltipScale = Math.max(item.total, item.previousTotal, 1);
  const tooltipCurrentWidth = (item.total / tooltipScale) * 100;
  const tooltipPreviousWidth = (item.previousTotal / tooltipScale) * 100;
  const displayName =
    userEmail ||
    (trafficType === "users" ? t("overview.userFallback", "User") : item.name);
  const accessibleName = userEmail || item.name;
  const changeLabel = `${item.absoluteChange > 0 ? "+" : item.absoluteChange < 0 ? "−" : ""}${formatBytes(
    Math.abs(item.absoluteChange)
  )}`;
  const tooltipDataKey = `${trafficType}-${currentLabel}-${item.id}-${item.total}-${item.previousTotal}-${userEmail || "pending"}`;

  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      className="dashboard-traffic-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:px-5"
      data-rank={index + 1}
      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.99, y: -4 }}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      layout={reducedMotion ? false : "position"}
      transition={{
        layout: {
          duration: reducedMotion ? 0 : 0.24,
          ease: [0.2, 0, 0, 1],
        },
        opacity: {
          delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.25),
          duration: reducedMotion ? 0 : 0.2,
        },
        y: {
          delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.25),
          duration: reducedMotion ? 0 : 0.24,
          ease: [0.2, 0, 0, 1],
        },
      }}
    >
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <button
            aria-label={t(
              "overview.trafficTooltipLabel",
              "Traffic details for {{name}}",
              { name: accessibleName }
            )}
            className="min-w-0 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted font-semibold text-muted-foreground text-xs tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    {userEmailLoading && trafficType === "users" ? (
                      <Skeleton
                        aria-label={t(
                          "overview.loadingUserEmail",
                          "Loading user email"
                        )}
                        className="h-5 w-36 max-w-full"
                      />
                    ) : (
                      <div className="truncate font-medium text-sm">
                        {displayName}
                      </div>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground tabular-nums">
                      {item.uid !== undefined ? (
                        <span>UID {item.uid}</span>
                      ) : null}
                      <span>SID {item.sid}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <AnimatedNumber
                      className="font-semibold text-sm tabular-nums"
                      format={formatBytes}
                      value={item.total}
                    />
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {item.share.toFixed(1)}% {t("overview.share", "share")}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground tabular-nums">
                    <span>{currentLabel}</span>
                    <span>
                      {t(
                        "overview.relativeToLeader",
                        "{{share}}% of rank leader",
                        { share: rankingWidth.toFixed(0) }
                      )}
                    </span>
                  </div>
                  <div
                    aria-label={t(
                      "overview.rankingBarLabel",
                      "{{name}} has {{share}}% of the rank leader's traffic",
                      {
                        name: displayName,
                        share: rankingWidth.toFixed(0),
                      }
                    )}
                    className="h-2.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                  >
                    <div
                      className="dashboard-traffic-bar flex h-full overflow-hidden rounded-full"
                      style={
                        {
                          "--traffic-share": `${rankingWidth}%`,
                        } as React.CSSProperties
                      }
                    >
                      <span
                        className="h-full bg-chart-1"
                        style={{ width: `${uploadShare}%` }}
                      />
                      <span
                        className="h-full bg-chart-4"
                        style={{ width: `${downloadShare}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <i className="size-1.5 rounded-full bg-chart-1" />
                    {t("overview.upload", "Upload")} {formatBytes(item.upload)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="size-1.5 rounded-full bg-chart-4" />
                    {t("overview.download", "Download")}{" "}
                    {formatBytes(item.download)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                  <span>
                    {previousLabel} {formatBytes(item.previousTotal)}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      item.absoluteChange > 0
                        ? "text-[var(--admin-success)]"
                        : item.absoluteChange < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    )}
                  >
                    {changeLabel}
                  </span>
                  <GrowthChip value={item.growth} />
                  <RankChangeChip item={item} />
                </div>
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent
          className="dashboard-traffic-tooltip w-72 p-3"
          side="top"
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="dashboard-traffic-tooltip__data space-y-3"
              data-tooltip-key={tooltipDataKey}
              exit={reducedMotion ? undefined : { opacity: 0, y: -2 }}
              initial={reducedMotion ? false : { opacity: 0, y: 2 }}
              key={tooltipDataKey}
              transition={{ duration: reducedMotion ? 0 : 0.1 }}
            >
              <div>
                <div className="font-semibold text-sm">{displayName}</div>
                <div className="mt-1 flex gap-2 text-muted-foreground text-xs">
                  {item.uid !== undefined ? <span>UID {item.uid}</span> : null}
                  <span>SID {item.sid}</span>
                </div>
              </div>
              <div className="dashboard-traffic-tooltip__comparison space-y-2.5 rounded-xl border p-2.5">
                <div className="dashboard-traffic-tooltip__legend flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="dashboard-traffic-tooltip__legend-dot dashboard-traffic-tooltip__legend-dot--upload" />
                    {t("overview.upload", "Upload")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="dashboard-traffic-tooltip__legend-dot dashboard-traffic-tooltip__legend-dot--download" />
                    {t("overview.download", "Download")}
                  </span>
                </div>
                <TrafficTooltipComparisonBar
                  downloadShare={downloadShare}
                  label={currentLabel}
                  total={item.total}
                  uploadShare={uploadShare}
                  width={tooltipCurrentWidth}
                />
                <TrafficTooltipComparisonBar
                  downloadShare={previousDownloadShare}
                  label={previousLabel}
                  muted
                  total={item.previousTotal}
                  uploadShare={previousUploadShare}
                  width={tooltipPreviousWidth}
                />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <TrafficTooltipValue
                  label={`${currentLabel} · ${t("overview.upload", "Upload")}`}
                  tone="upload"
                  value={formatBytes(item.upload)}
                />
                <TrafficTooltipValue
                  label={`${currentLabel} · ${t("overview.download", "Download")}`}
                  tone="download"
                  value={formatBytes(item.download)}
                />
                <TrafficTooltipValue
                  label={`${previousLabel} · ${t("overview.upload", "Upload")}`}
                  tone="upload"
                  value={formatBytes(item.previousUpload)}
                />
                <TrafficTooltipValue
                  label={`${previousLabel} · ${t("overview.download", "Download")}`}
                  tone="download"
                  value={formatBytes(item.previousDownload)}
                />
                <TrafficTooltipValue
                  label={t("traffic", "Total traffic")}
                  value={formatBytes(item.total)}
                />
                <TrafficTooltipValue
                  label={t("overview.share", "Traffic share")}
                  value={`${item.share.toFixed(2)}%`}
                />
                <TrafficTooltipValue
                  label={currentLabel}
                  value={formatBytes(item.total)}
                />
                <TrafficTooltipValue
                  label={previousLabel}
                  value={formatBytes(item.previousTotal)}
                />
                <TrafficTooltipValue
                  label={t("overview.absoluteChange", "Absolute change")}
                  value={changeLabel}
                />
                <TrafficTooltipValue
                  label={t("overview.rankChange", "Rank change")}
                  value={
                    item.isNew
                      ? t("overview.newToRanking", "New")
                      : item.rankChange
                        ? `${item.rankChange > 0 ? "+" : ""}${item.rankChange}`
                        : "—"
                  }
                />
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-xs">
                <span className="text-muted-foreground">
                  {t("overview.growth", "Growth")}
                </span>
                <GrowthChip value={item.growth} />
              </div>
            </motion.div>
          </AnimatePresence>
        </TooltipContent>
      </Tooltip>
      <Button
        aria-label={t("overview.openTrafficLog", "Open traffic log")}
        asChild
        className="size-8 rounded-full"
        size="icon"
        variant="ghost"
      >
        {trafficType === "nodes" ? (
          <Link
            search={{ date: selectedDate, server_id: item.sid }}
            to="/dashboard/log/server-traffic"
          >
            <ArrowUpRight />
          </Link>
        ) : (
          <Link
            search={{
              date: selectedDate,
              user_id: item.uid,
              user_subscribe_id: item.sid,
            }}
            to="/dashboard/log/subscribe-traffic"
          >
            <ArrowUpRight />
          </Link>
        )}
      </Button>
    </motion.li>
  );
}

function TrafficTooltipComparisonBar({
  downloadShare,
  label,
  muted = false,
  total,
  uploadShare,
  width,
}: {
  downloadShare: number;
  label: string;
  muted?: boolean;
  total: number;
  uploadShare: number;
  width: number;
}) {
  return (
    <div
      className="dashboard-traffic-tooltip__period space-y-1.5"
      data-period={muted ? "previous" : "current"}
    >
      <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground tabular-nums">
        <span>{label}</span>
        <span className="font-medium text-foreground">
          {formatBytes(total)}
        </span>
      </div>
      <div className="dashboard-traffic-tooltip__track h-2 overflow-hidden rounded-full">
        <div
          className="dashboard-traffic-tooltip-bar flex h-full overflow-hidden rounded-full"
          style={
            {
              "--traffic-share": `${width}%`,
            } as React.CSSProperties
          }
        >
          <span
            className="dashboard-traffic-tooltip__segment dashboard-traffic-tooltip__segment--upload h-full"
            style={{ width: `${uploadShare}%` }}
          />
          <span
            className="dashboard-traffic-tooltip__segment dashboard-traffic-tooltip__segment--download h-full"
            style={{ width: `${downloadShare}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TrafficTooltipValue({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "upload" | "download";
  value: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-semibold tabular-nums",
          tone === "upload" && "dashboard-traffic-tooltip__value--upload",
          tone === "download" && "dashboard-traffic-tooltip__value--download"
        )}
      >
        {value}
      </div>
    </div>
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
