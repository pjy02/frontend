type TrafficType = "nodes" | "users";
type TrafficPeriod = "today" | "yesterday";

type TrafficSourceItem = {
  id: number;
  name?: string;
  uid?: number;
  sid: number;
  upload: number;
  download: number;
};

export type TrafficRankingItem = {
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
  growth: number | null;
  comparison: "comparable" | "missing" | "zero-base";
  share: number;
  rankChange?: number;
  isNew: boolean;
};

export type TrafficRankingDataset = {
  items: TrafficRankingItem[];
  currentTotal: number;
  previousTotal: number;
  previousAvailable: boolean;
};

export function createTrafficRanking(
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

export function createTrafficRankingDataset(
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
    previousAvailable: previous.length > 0,
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
        growth:
          previousItem && previousItemTotal > 0
            ? (absoluteChange / previousItemTotal) * 100
            : null,
        comparison: previousItem
          ? previousItemTotal === 0
            ? "zero-base"
            : "comparable"
          : "missing",
        share: currentTotal ? (total / currentTotal) * 100 : 0,
        rankChange:
          previousRank === undefined ? undefined : previousRank - (index + 1),
        isNew: previousRank === undefined,
      };
    }),
  };
}
