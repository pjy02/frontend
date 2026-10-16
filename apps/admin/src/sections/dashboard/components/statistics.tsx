"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
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
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { usePreferenceScope } from "@workspace/ui/composed/pro-table/view-preferences";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { LIVE_QUERY_OPTIONS } from "@workspace/ui/integrations/tanstack-query";
import { cn } from "@workspace/ui/lib/utils";
import {
  getUserDetail,
  getConsoleRevenue as queryRevenueStatistics,
  getConsoleServer as queryServerTotalData,
  getConsoleTicket as queryTicketWaitReply,
  getConsoleUser as queryUserStatistics,
} from "@workspace/ui/services/admin/admin";
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
import { useMemo, useRef, useState } from "react";
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
import { adminChartEasing } from "@/components/motion-tokens";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states";
import { StatusChip, type StatusChipTone } from "@/components/status-chip";
import {
  WorkspaceDialog,
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";
import { useGlobalStore } from "@/stores/global";
import { useTableSearchWriter } from "@/utils/use-table-search-params";
import { DashboardComponentsMenu } from "./dashboard-components-menu";
import {
  AnimatedNumber,
  DashboardCategoryMotion,
  DashboardDataTransition,
  DashboardFadeThrough,
  DashboardHeightRegion,
  useDashboardCategory,
} from "./dashboard-motion";
import {
  type DashboardModuleId,
  useDashboardPreferences,
} from "./dashboard-preferences";
import { DataFreshness, refreshDashboardSources } from "./data-freshness";
import { ProjectSupport } from "./project-support";
import SystemLogsDialog from "./system-logs-dialog";
import SystemVersionCard from "./system-version-card";
import { getTrafficRankWidth, getUserEmail } from "./traffic-ranking-utils";
import { useDashboardScroll } from "./use-dashboard-scroll";

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
  value,
}: {
  className?: string;
  value?: number;
}) {
  const currencySymbol = useGlobalStore(
    (state) => state.common.currency?.currency_symbol || ""
  );
  if (value == null) return <span className={className}>—</span>;
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
  const tooltipKey = String(
    props.label ?? props.payload?.[0]?.payload?.date ?? "dashboard-tooltip"
  );

  if (!props.active) return null;
  return (
    <div
      className="dashboard-chart-tooltip-transition"
      data-tooltip-key={tooltipKey}
    >
      <ChartTooltipContent {...props} />
    </div>
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
  const { t } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const [refreshResult, setRefreshResult] = useState<{
    failed: number;
    total: number;
  } | null>(null);
  const refreshLock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const dashboardPreferences = useDashboardPreferences();
  const { layout } = dashboardPreferences;
  const search = useSearch({
    strict: false,
    structuralSharing: false,
  }) as Record<string, unknown>;
  const writeSearch = useTableSearchWriter();
  const range: DashboardRange = search.range === "total" ? "total" : "month";
  const trafficType: TrafficType =
    search.trafficType === "users" ? "users" : "nodes";
  const trafficPeriod: TrafficPeriod =
    search.trafficPeriod === "yesterday" ? "yesterday" : "today";
  const trafficLimit: TrafficLimit = [5, 8, 10, 20].includes(
    Number(search.trafficLimit)
  )
    ? (Number(search.trafficLimit) as TrafficLimit)
    : 8;
  const changeControl = (key: string, value: string | number) =>
    writeSearch((params) => params.set(key, String(value)));
  const setRange = (value: DashboardRange) => changeControl("range", value);
  const setTrafficType = (value: TrafficType) =>
    changeControl("trafficType", value);
  const setTrafficPeriod = (value: TrafficPeriod) =>
    changeControl("trafficPeriod", value);
  const setTrafficLimit = (value: TrafficLimit) =>
    changeControl("trafficLimit", value);

  const serverQuery = useQuery({
    ...LIVE_QUERY_OPTIONS,
    queryKey: ["queryServerTotalData"],
    queryFn: async () => {
      const { data } = await queryServerTotalData();
      return data.data;
    },
  });
  const ticketQuery = useQuery({
    ...LIVE_QUERY_OPTIONS,
    queryKey: ["queryTicketWaitReply"],
    queryFn: async () => {
      const { data } = await queryTicketWaitReply();
      return data.data?.count;
    },
  });
  const revenueQuery = useQuery({
    ...LIVE_QUERY_OPTIONS,
    queryKey: ["queryRevenueStatistics"],
    queryFn: async () => {
      const { data } = await queryRevenueStatistics();
      return data.data;
    },
  });
  const userQuery = useQuery({
    ...LIVE_QUERY_OPTIONS,
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
  const isRefreshing =
    refreshing ||
    [serverQuery, ticketQuery, revenueQuery, userQuery].some(
      (query) => query.isFetching
    );
  const refreshAll = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    setRefreshResult(null);
    try {
      setRefreshResult(
        await refreshDashboardSources([
          serverQuery,
          ticketQuery,
          revenueQuery,
          userQuery,
          ...(queryClient
            .getQueryCache()
            .find({ queryKey: ["getServerVersion"], exact: true })
            ?.isActive()
            ? [
                {
                  refetch: async () => {
                    await queryClient.refetchQueries(
                      {
                        queryKey: ["getServerVersion"],
                        exact: true,
                        type: "active",
                      },
                      { throwOnError: true }
                    );
                    return {
                      isError:
                        queryClient.getQueryState(["getServerVersion"])
                          ?.status === "error",
                      data: {},
                    };
                  },
                },
              ]
            : []),
        ])
      );
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  };
  const moduleSources: Partial<
    Record<
      DashboardModuleId,
      {
        query:
          | typeof serverQuery
          | typeof ticketQuery
          | typeof revenueQuery
          | typeof userQuery;
        label?: string;
      }[]
    >
  > = {
    income: [{ query: revenueQuery }],
    revenueTrend: [{ query: revenueQuery }],
    newUsers: [{ query: userQuery }],
    userTrend: [{ query: userQuery }],
    onlineUsers: [{ query: serverQuery }],
    monthTraffic: [{ query: serverQuery }],
    trafficRanking: [{ query: serverQuery }],
    systemHealth: [{ query: serverQuery }],
    servers: [{ query: serverQuery }],
    pending: [
      {
        query: serverQuery,
        label: t("overview.serverSummary", "Nodes and servers"),
      },
      { query: ticketQuery, label: t("pendingTickets", "Pending tickets") },
    ],
  };

  const currentTraffic = createTrafficRanking(
    server,
    trafficType,
    trafficPeriod
  );
  const preferenceScope = usePreferenceScope();
  useDashboardScroll(
    dashboardPreferences.ready &&
      ![serverQuery, ticketQuery, revenueQuery, userQuery].some(
        (query) => query.isLoading
      ),
    preferenceScope?.accountKey || null
  );

  const modules: Record<DashboardModuleId, React.ReactNode> = {
    income: (
      <MetricCard
        description={
          revenueQuery.data == null
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
          revenueQuery.data == null ? (
            "—"
          ) : (
            <AnimatedCurrency value={selectedRevenue?.amount_total} />
          )
        }
      />
    ),
    newUsers: (
      <MetricCard
        description={t(
          "overview.newUsersHint",
          "Accounts registered in the selected range"
        )}
        icon={Users}
        loading={userQuery.isLoading}
        title={t("overview.newUsers", "New users")}
        value={
          userQuery.data == null ? (
            "—"
          ) : selectedUsers?.register == null ? (
            "—"
          ) : (
            <AnimatedNumber value={selectedUsers.register} />
          )
        }
      />
    ),
    onlineUsers: (
      <MetricCard
        description={t("currentlyOnline", "Currently online")}
        icon={Activity}
        loading={serverQuery.isLoading}
        title={t("onlineUsersCount", "Online users")}
        value={
          serverQuery.data == null ? (
            "—"
          ) : server?.online_users == null ? (
            "—"
          ) : (
            <AnimatedNumber value={server.online_users} />
          )
        }
      />
    ),
    monthTraffic: (
      <MetricCard
        description={
          serverQuery.data == null ? (
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
          serverQuery.data == null ? (
            "—"
          ) : (
            <AnimatedNumber
              format={formatBytes}
              value={
                (server?.monthly_upload || 0) + (server?.monthly_download || 0)
              }
            />
          )
        }
      />
    ),
    trafficRanking: (
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
        serverError={serverQuery.data == null}
        systemTotal={
          trafficPeriod === "today"
            ? (server?.today_upload || 0) + (server?.today_download || 0)
            : undefined
        }
        trafficType={trafficType}
        userEmailById={rankedUserEmailById}
      />
    ),
    revenueTrend: (
      <BusinessTrends
        kind="revenue"
        range={range}
        revenue={revenueQuery.data}
        revenueError={revenueQuery.data == null}
        revenueLoading={revenueQuery.isLoading}
        users={userQuery.data}
        usersError={userQuery.data == null}
        usersLoading={userQuery.isLoading}
      />
    ),
    userTrend: (
      <BusinessTrends
        kind="users"
        range={range}
        revenue={revenueQuery.data}
        revenueError={revenueQuery.data == null}
        revenueLoading={revenueQuery.isLoading}
        users={userQuery.data}
        usersError={userQuery.data == null}
        usersLoading={userQuery.isLoading}
      />
    ),
    systemHealth: (
      <SystemHealthCard
        error={serverQuery.data == null}
        loading={serverQuery.isLoading}
        offline={offlineServers}
        online={onlineServers}
        onlineRate={onlineRate}
        serverUpdatedAt={serverQuery.dataUpdatedAt}
        total={serverTotal}
      />
    ),
    servers: (
      <ServerSummaryCard
        error={serverQuery.data == null}
        loading={serverQuery.isLoading}
        server={server}
      />
    ),
    pending: (
      <PendingCard
        loading={serverQuery.isLoading || ticketQuery.isLoading}
        offlineServers={offlineServers}
        pendingTickets={pendingTickets}
        serverError={serverQuery.data == null}
        ticketError={ticketQuery.data == null}
      />
    ),
    systemServices: <SystemVersionCard />,
    systemOperations: <SystemOperations />,
    projectSupport: <ProjectSupport />,
  };
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
            <DashboardComponentsMenu {...dashboardPreferences} />
            <Button disabled={isRefreshing} onClick={refreshAll} size="sm">
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
        eyebrow={t("overview.liveOverview", "Operations overview")}
        title={t("overview.title", "Dashboard")}
      />

      {refreshResult && (
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm"
          data-dashboard-refresh-result
          role="status"
        >
          {refreshResult.failed === 0
            ? t("freshness.allUpdated", "All dashboard data updated")
            : refreshResult.failed === refreshResult.total
              ? t(
                  "freshness.allFailed",
                  "Refresh failed for all sources; previous data is retained where available"
                )
              : t(
                  "freshness.partial",
                  "{{failed}} of {{total}} sources failed; other sources updated",
                  refreshResult
                )}
        </p>
      )}

      <div className="dashboard-module-grid grid grid-cols-2 gap-4 xl:grid-cols-12">
        {layout.order
          .filter((id) => !layout.hidden.includes(id))
          .map((id) => (
            <div
              className={cn(
                "min-w-0",
                ["income", "newUsers", "onlineUsers", "monthTraffic"].includes(
                  id
                )
                  ? "col-span-1 xl:col-span-3"
                  : ["trafficRanking", "projectSupport"].includes(id)
                    ? "col-span-2 xl:col-span-12"
                    : ["systemHealth", "servers", "pending"].includes(id)
                      ? "col-span-2 xl:col-span-4"
                      : "col-span-2 xl:col-span-6"
              )}
              data-dashboard-module={id}
              key={id}
            >
              {modules[id]}
              {moduleSources[id] && (
                <div className="mt-2 space-y-1 px-1">
                  {moduleSources[id].map(({ query, label }, index) => (
                    <DataFreshness
                      key={label || index}
                      label={label}
                      query={query}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
      {layout.hidden.length === layout.order.length && (
        <EmptyState
          description={t(
            "components.emptyHint",
            "Use Dashboard components above to show components or restore a preset."
          )}
          title={t("components.emptyTitle", "No dashboard components selected")}
        />
      )}
    </div>
  );
}

export function BusinessTrends({
  kind,
  range,
  revenue,
  revenueError,
  revenueLoading,
  users,
  usersError,
  usersLoading,
}: {
  kind?: "revenue" | "users";
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
  const [hiddenRevenue, setHiddenRevenue] = useState<string[]>([]);
  const [hiddenUsers, setHiddenUsers] = useState<string[]>([]);
  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    key: string
  ) =>
    setter((hidden) =>
      hidden.includes(key)
        ? hidden.filter((item) => item !== key)
        : [...hidden, key]
    );
  const revenueData = useMemo(
    () =>
      revenueRange?.list?.map((item) => ({
        date: item.date || "",
        newPurchase: unitConversion("centsToDollars", item.new_order_amount),
        renewal: unitConversion("centsToDollars", item.renewal_order_amount),
      })) || [],
    [revenueRange?.list]
  );
  const userData = useMemo(
    () =>
      userRange?.list?.map((item) => ({
        date: item.date || "",
        register: item.register,
        paid: item.new_order_users,
      })) || [],
    [userRange?.list]
  );
  const renderRevenueChart = (expanded = false) => {
    const transitionKey = `revenue-${range}-${expanded ? "expanded" : "inline"}-${revenueLoading ? "loading" : revenueError || revenueData.length === 0 ? "unavailable" : "ready"}`;
    if (revenueLoading && revenueData.length === 0) {
      return (
        <DashboardDataTransition transitionKey={transitionKey}>
          <Skeleton className="h-full w-full rounded-lg" />
        </DashboardDataTransition>
      );
    }
    if (revenueData.length === 0) {
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
          legend={{
            hidden: hiddenRevenue,
            onToggle: (key) => toggle(setHiddenRevenue, key),
          }}
          reducedMotion={reducedMotion}
        />
      </DashboardDataTransition>
    );
  };
  const renderUserChart = (expanded = false) => {
    const transitionKey = `users-${range}-${expanded ? "expanded" : "inline"}-${usersLoading ? "loading" : usersError || userData.length === 0 ? "unavailable" : "ready"}`;
    if (usersLoading && userData.length === 0) {
      return (
        <DashboardDataTransition transitionKey={transitionKey}>
          <Skeleton className="h-full w-full rounded-lg" />
        </DashboardDataTransition>
      );
    }
    if (userData.length === 0) {
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
          expanded={expanded}
          legend={{
            hidden: hiddenUsers,
            onToggle: (key) => toggle(setHiddenUsers, key),
          }}
          reducedMotion={reducedMotion}
        />
      </DashboardDataTransition>
    );
  };

  return (
    <section
      className={
        kind
          ? "min-w-0"
          : "dashboard-section grid items-stretch gap-4 xl:grid-cols-2"
      }
    >
      {kind !== "users" && (
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
                  {revenueRange?.amount_total == null ? (
                    "—"
                  ) : (
                    <AnimatedCurrency value={revenueRange.amount_total} />
                  )}
                </div>
              </div>
              <ChartExpandDialog
                description={t(
                  "overview.revenueTrendHint",
                  "New purchases and renewals over time"
                )}
                disabled={revenueData.length === 0}
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
      )}

      {kind !== "revenue" && (
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
                  {userRange?.register == null ? (
                    "—"
                  ) : (
                    <AnimatedNumber value={userRange.register} />
                  )}
                </div>
              </div>
              <ChartExpandDialog
                description={t(
                  "overview.userTrendHint",
                  "Registrations and first-time purchasers"
                )}
                disabled={userData.length === 0}
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
      )}
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
  legend,
}: {
  data: Array<{ date: string; newPurchase: number; renewal: number }>;
  dateFormatter: (value: string) => string;
  expanded?: boolean;
  reducedMotion: boolean;
  legend: ChartLegendState;
}) {
  const { t } = useTranslation("dashboard");
  const gradientId = expanded ? "revenueBlueExpanded" : "revenueBlue";
  const { presets } = useAdminMotion();
  const firstDraw = useRef(!(expanded || reducedMotion));
  const previousData = useRef(data);
  if (previousData.current !== data) {
    firstDraw.current = false;
    previousData.current = data;
  }
  const chartDuration = firstDraw.current
    ? presets.chart.durationMs
    : presets.dataLayout.durationMs;
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
          isAnimationActive={false}
        />
        <Area
          animationDuration={chartDuration}
          animationEasing={adminChartEasing}
          dataKey="newPurchase"
          fill={`url(#${gradientId})`}
          hide={legend.hidden.includes("newPurchase")}
          isAnimationActive={!(reducedMotion || expanded)}
          onAnimationEnd={() => {
            firstDraw.current = false;
          }}
          stroke="var(--color-newPurchase)"
          strokeWidth={2}
          type="monotone"
        />
        <Area
          animationDuration={chartDuration}
          animationEasing={adminChartEasing}
          dataKey="renewal"
          fill="transparent"
          hide={legend.hidden.includes("renewal")}
          isAnimationActive={!(reducedMotion || expanded)}
          stroke="var(--color-renewal)"
          strokeWidth={2}
          type="monotone"
        />
        <ChartLegend
          content={
            <DashboardChartLegend
              {...legend}
              items={[
                { key: "newPurchase", label: t("newPurchase", "New purchase") },
                { key: "renewal", label: t("repurchase", "Renewal") },
              ]}
            />
          }
        />
      </AreaChart>
    </ChartContainer>
  );
}

function UserTrendChart({
  data,
  dateFormatter,
  reducedMotion,
  expanded = false,
  legend,
}: {
  data: Array<{ date: string; paid: number; register: number }>;
  dateFormatter: (value: string) => string;
  reducedMotion: boolean;
  expanded?: boolean;
  legend: ChartLegendState;
}) {
  const { t } = useTranslation("dashboard");
  const { presets } = useAdminMotion();
  const firstDraw = useRef(!(expanded || reducedMotion));
  const previousData = useRef(data);
  if (previousData.current !== data) {
    firstDraw.current = false;
    previousData.current = data;
  }
  const chartDuration = firstDraw.current
    ? presets.chart.durationMs
    : presets.dataLayout.durationMs;
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
          isAnimationActive={false}
        />
        <Line
          animationDuration={chartDuration}
          animationEasing={adminChartEasing}
          dataKey="register"
          dot={false}
          hide={legend.hidden.includes("register")}
          isAnimationActive={!(reducedMotion || expanded)}
          onAnimationEnd={() => {
            firstDraw.current = false;
          }}
          stroke="var(--color-register)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          animationDuration={chartDuration}
          animationEasing={adminChartEasing}
          dataKey="paid"
          dot={false}
          hide={legend.hidden.includes("paid")}
          isAnimationActive={!(reducedMotion || expanded)}
          stroke="var(--color-paid)"
          strokeWidth={2}
          type="monotone"
        />
        <ChartLegend
          content={
            <DashboardChartLegend
              {...legend}
              items={[
                { key: "register", label: t("register", "Register") },
                {
                  key: "paid",
                  label: t("overview.firstPurchaseUsers", "First purchase"),
                },
              ]}
            />
          }
        />
      </LineChart>
    </ChartContainer>
  );
}

type ChartLegendState = { hidden: string[]; onToggle: (key: string) => void };

function DashboardChartLegend({
  hidden,
  onToggle,
  items,
}: ChartLegendState & {
  items: { key: string; label: string }[];
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 pt-3"
      data-dashboard-chart-legend
    >
      {items.map(({ key, label }) => (
        <Button
          aria-pressed={!hidden.includes(key)}
          className={cn(
            "h-11 gap-2 px-2 text-xs sm:h-9",
            hidden.includes(key) && "text-muted-foreground line-through"
          )}
          key={key}
          onClick={() => onToggle(key)}
          size="sm"
          variant="ghost"
        >
          <span
            className="size-2 rounded-sm"
            style={{
              background: `var(--color-${key})`,
              opacity: hidden.includes(key) ? 0.35 : 1,
            }}
          />
          {label}
        </Button>
      ))}
    </div>
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
  const { reducedMotion, presets } = useAdminMotion();
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
            exit={reducedMotion ? undefined : { opacity: 0 }}
            initial={reducedMotion ? false : { opacity: 0 }}
            key={tone}
            transition={presets.state.transition}
          >
            <StatusChip tone={tone}>{label}</StatusChip>
          </motion.div>
        </AnimatePresence>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <DashboardDataTransition transitionKey="health-loading">
            <Skeleton className="h-28 w-full" />
          </DashboardDataTransition>
        ) : (
          <DashboardDataTransition
            transitionKey={error ? "health-error" : "health-ready"}
          >
            <div className="space-y-5">
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
                    {error ? "—" : <AnimatedNumber value={online} />}
                    <span aria-hidden="true">&nbsp;/&nbsp;</span>
                    {error ? "—" : <AnimatedNumber value={total} />}
                  </span>
                </div>
                <Progress className="h-2" value={error ? 0 : onlineRate} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <HealthValue
                  label={t("online", "Online")}
                  tone="success"
                  value={error ? undefined : online}
                />
                <HealthValue
                  label={t("offline", "Offline")}
                  tone={offline ? "danger" : "neutral"}
                  value={error ? undefined : offline}
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
            </div>
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
  value?: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <StatusChip dot tone={tone}>
        {label}
      </StatusChip>
      {value === undefined ? (
        <span className="mt-2 block font-semibold text-xl">—</span>
      ) : (
        <AnimatedNumber
          className="mt-2 block font-semibold text-xl tabular-nums"
          value={value}
        />
      )}
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
                  {error ? "—" : formatBytes(server?.monthly_upload || 0)}
                </div>
              </div>
              <div className="rounded-lg bg-muted/35 p-3">
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <ArrowDown className="size-3" />{" "}
                  {t("overview.download", "Download")}
                </div>
                <div className="mt-1 font-medium text-sm tabular-nums">
                  {error ? "—" : formatBytes(server?.monthly_download || 0)}
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
  activeDate: requestedDate,
  data: requestedData,
  limit,
  loading,
  onLimitChange,
  onPeriodChange,
  onTypeChange,
  pendingUserIds,
  period: requestedPeriod,
  serverError,
  systemTotal,
  trafficType: requestedType,
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
  const { reducedMotion, presets } = useAdminMotion();
  const category = useDashboardCategory(requestedType, {
    data: requestedData,
    trafficType: requestedType,
    period: requestedPeriod,
    activeDate: requestedDate,
  });
  const { data, trafficType, period, activeDate } = category.value;
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
              value={requestedType}
            >
              <LayoutGroup id="dashboard-traffic-type-switcher">
                <TabsList className="dashboard-traffic-controls__tabs-list dashboard-traffic-type-tabs-list">
                  <TabsTrigger
                    className="dashboard-traffic-type-trigger"
                    value="nodes"
                  >
                    {requestedType === "nodes" ? (
                      <motion.span
                        aria-hidden="true"
                        className="dashboard-traffic-type-indicator"
                        layoutId="dashboard-traffic-type-indicator"
                        transition={presets.selection.transition}
                      />
                    ) : null}
                    <span className="dashboard-traffic-type-label">
                      {t("nodes", "Nodes")}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    className="dashboard-traffic-type-trigger"
                    value="users"
                  >
                    {requestedType === "users" ? (
                      <motion.span
                        aria-hidden="true"
                        className="dashboard-traffic-type-indicator"
                        layoutId="dashboard-traffic-type-indicator"
                        transition={presets.selection.transition}
                      />
                    ) : null}
                    <span className="dashboard-traffic-type-label">
                      {t("users", "Users")}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </LayoutGroup>
            </Tabs>
            <Tabs
              className="dashboard-traffic-controls__tabs"
              onValueChange={(value) => onPeriodChange(value as TrafficPeriod)}
              value={requestedPeriod}
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
                search={{ date: requestedDate }}
                to={
                  requestedType === "nodes"
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
          <DashboardHeightRegion>
            {loading && data.items.length === 0 ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-20 w-full rounded-lg" />
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton
                    className="h-20 w-full rounded-lg"
                    key={`traffic-skeleton-${index}`}
                  />
                ))}
              </div>
            ) : serverError && data.items.length === 0 ? (
              <div className="p-5">
                <DataUnavailable
                  text={t("overview.unavailable", "Data unavailable")}
                />
              </div>
            ) : (
              <DashboardCategoryMotion.Provider value={category.opacity}>
                <TooltipProvider delayDuration={100}>
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
                      transitionKey={trafficType}
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
                      transitionKey={trafficType}
                      value={visibleTotal}
                    />
                    <div className="border-t border-l px-5 py-4 xl:border-t-0">
                      <DashboardFadeThrough transitionKey={trafficType}>
                        <div className="text-muted-foreground text-xs">
                          {t("overview.transferSplit", "Upload / Download")}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-medium text-sm tabular-nums">
                          <span className="inline-flex items-center gap-1 text-chart-1">
                            <ArrowUp className="size-3.5" />{" "}
                            {formatBytes(upload)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-chart-4">
                            <ArrowDown className="size-3.5" />{" "}
                            {formatBytes(download)}
                          </span>
                        </div>
                      </DashboardFadeThrough>
                    </div>
                    <div className="col-span-2 border-t px-5 py-4 xl:col-span-1 xl:border-t-0 xl:border-l">
                      <DashboardFadeThrough transitionKey={trafficType}>
                        <div className="text-muted-foreground text-xs">
                          {t("overview.periodComparison", "{{date}} / change", {
                            date: previousLabel,
                          })}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <AnimatedNumber
                            animateOnMount={false}
                            className="font-semibold text-base tabular-nums"
                            format={formatBytes}
                            value={data.previousTotal}
                          />
                          <GrowthChip value={growth} />
                        </div>
                        <div className="mt-1 text-muted-foreground text-xs">
                          {t(
                            "overview.currentPeriod",
                            "Current period: {{date}}",
                            {
                              date: currentLabel,
                            }
                          )}
                        </div>
                      </DashboardFadeThrough>
                    </div>
                  </div>
                  <DashboardFadeThrough transitionKey={trafficType}>
                    <LayoutGroup id={`traffic-ranking-${trafficType}`}>
                      <ol className="dashboard-traffic-list min-h-52 divide-y">
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
                      </ol>
                      {data.items.length === 0 && (
                        <div className="p-5">
                          <DataUnavailable
                            text={t("freshness.empty", "No data received")}
                          />
                        </div>
                      )}
                    </LayoutGroup>
                  </DashboardFadeThrough>
                </TooltipProvider>
              </DashboardCategoryMotion.Provider>
            )}
          </DashboardHeightRegion>
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
  transitionKey,
  value,
}: {
  className?: string;
  format: (value: number) => string;
  hint?: React.ReactNode;
  label: string;
  transitionKey?: string;
  value?: number;
}) {
  const content = (
    <>
      {value === undefined ? (
        <div className="mt-1 font-semibold text-base">—</div>
      ) : (
        <AnimatedNumber
          animateOnMount={false}
          className="mt-1 block font-semibold text-base tabular-nums"
          format={format}
          value={value}
        />
      )}
      {hint ? (
        <div className="mt-1 line-clamp-2 text-muted-foreground text-xs">
          {hint}
        </div>
      ) : null}
    </>
  );

  return (
    <div className={cn("px-5 py-4", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      {transitionKey ? (
        <DashboardFadeThrough transitionKey={transitionKey}>
          {content}
        </DashboardFadeThrough>
      ) : (
        content
      )}
    </div>
  );
}

function GrowthChip({ value }: { value: number }) {
  const { t } = useTranslation("dashboard");
  // More/less traffic is a trend, not a service success/failure signal.
  const tone: StatusChipTone = value > 0 ? "info" : "neutral";
  const TrendIcon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : null;
  const label = `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <StatusChip dot={false} tone={tone}>
      <span className="sr-only">{t("overview.growth", "Growth")}: </span>
      {TrendIcon ? <TrendIcon aria-hidden="true" className="size-3" /> : null}
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
        improved ? "text-[var(--admin-info)]" : "text-muted-foreground"
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

export function TrafficRankingRow({
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
  const { presets } = useAdminMotion();
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
  const tooltipDataKey = `${trafficType}-${item.id}`;

  const [detailOpen, setDetailOpen] = useState(false);
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const mobile = useIsMobile();
  const touchDetails =
    mobile ||
    (typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches);
  const detailContent = (
    <div
      className="dashboard-traffic-tooltip__data space-y-3"
      data-tooltip-key={tooltipDataKey}
    >
      <div>
        <div className="wrap-anywhere font-semibold text-sm">{displayName}</div>
        <div className="mt-1 flex gap-2 text-muted-foreground text-xs">
          {item.uid !== undefined ? <span>UID {item.uid}</span> : null}
          <span>SID {item.sid}</span>
        </div>
      </div>
      <div className="dashboard-traffic-tooltip__comparison space-y-2.5 rounded-xl border p-2.5">
        <div className="dashboard-traffic-tooltip__legend flex items-center gap-3 text-muted-foreground text-xs">
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
    </div>
  );
  return (
    <motion.li
      className="dashboard-traffic-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:px-5"
      data-rank={index + 1}
      data-traffic-id={`${trafficType}-${item.id}`}
      layout={reducedMotion ? false : "position"}
      transition={{
        layout: presets.categoryLayout.transition,
      }}
    >
      <Tooltip
        delayDuration={100}
        open={touchDetails || detailOpen ? false : undefined}
        sharedProvider
      >
        <TooltipTrigger asChild>
          <button
            aria-label={t(
              "overview.trafficTooltipLabel",
              "Traffic details for {{name}}",
              { name: accessibleName }
            )}
            className="min-w-0 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              if (touchDetails) setDetailOpen(true);
            }}
            ref={detailTrigger}
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
                    <div className="mt-0.5 flex flex-wrap gap-2 text-muted-foreground text-xs tabular-nums">
                      {item.uid !== undefined ? (
                        <span>UID {item.uid}</span>
                      ) : null}
                      <span>SID {item.sid}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <AnimatedNumber
                      animateOnMount={false}
                      className="font-semibold text-sm tabular-nums"
                      format={formatBytes}
                      value={item.total}
                    />
                    <div className="text-muted-foreground text-xs tabular-nums">
                      {item.share.toFixed(1)}% {t("overview.share", "share")}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between gap-3 text-muted-foreground text-xs tabular-nums">
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
                    <motion.div
                      animate={{ opacity: 1, scaleX: 1 }}
                      className="dashboard-traffic-bar flex h-full overflow-hidden rounded-full"
                      initial={
                        reducedMotion
                          ? false
                          : { opacity: 0.72, scaleX: presets.rankBar.scale }
                      }
                      style={
                        {
                          "--traffic-share": `${rankingWidth}%`,
                        } as React.CSSProperties
                      }
                      transition={presets.rankBar.transition}
                    >
                      <span
                        className="h-full bg-chart-1"
                        style={{ width: `${uploadShare}%` }}
                      />
                      <span
                        className="h-full bg-chart-4"
                        style={{ width: `${downloadShare}%` }}
                      />
                    </motion.div>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs tabular-nums">
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
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs tabular-nums">
                  <span>
                    {previousLabel} {formatBytes(item.previousTotal)}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      item.absoluteChange > 0
                        ? "text-[var(--admin-info)]"
                        : item.absoluteChange < 0
                          ? "text-muted-foreground"
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
          {detailContent}
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
      <WorkspaceDialog onOpenChange={setDetailOpen} open={detailOpen}>
        <WorkspaceDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            detailTrigger.current?.focus({ preventScroll: true });
          }}
          size="md"
        >
          <WorkspaceDialogHeader>
            <WorkspaceDialogTitle className="wrap-anywhere">
              {t(
                "overview.trafficTooltipLabel",
                "Traffic details for {{name}}",
                { name: displayName }
              )}
            </WorkspaceDialogTitle>
            <WorkspaceDialogDescription>
              {selectedDate} · {currentLabel} / {previousLabel}
              <span className="mt-1 block">
                {t(
                  "overview.trafficShareScope",
                  "Traffic share is relative to all ranking records returned by the API."
                )}
              </span>
            </WorkspaceDialogDescription>
          </WorkspaceDialogHeader>
          <WorkspaceDialogBody>
            <div className="dashboard-traffic-tooltip dashboard-traffic-detail space-y-4">
              {detailContent}
            </div>
          </WorkspaceDialogBody>
          <WorkspaceDialogFooter className="flex-row">
            <Button asChild className="min-h-11 w-full">
              <Link
                search={{
                  date: selectedDate,
                  ...(trafficType === "nodes"
                    ? { server_id: item.sid }
                    : { user_id: item.uid, user_subscribe_id: item.sid }),
                }}
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
          </WorkspaceDialogFooter>
        </WorkspaceDialogContent>
      </WorkspaceDialog>
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
      <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs tabular-nums">
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
