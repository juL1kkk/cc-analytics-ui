"use client";



import {
  fetchOperatorsV2,
  type OperatorsResponseV2,
} from "@/lib/analytics/operators.client";
import { fetchChannelsSplitV2 } from "@/lib/analytics/channelsSplit.client";
import { fetchKpisV2, type KpisV2Response } from "@/lib/analytics/kpis.client";
import {
  fetchRecentV2,
  type RecentV2Response,
} from "@/lib/analytics/recent.client";
import { fetchTopicsTopV2 } from "@/lib/analytics/topicsTop.client";
import {
  fetchTopicsTimeseriesV2,
  type TopicsTimeseriesResponseV2,
} from "@/lib/analytics/topicsTimeseries.client";
import {
  fetchTimeseriesV2,
  type TimeseriesPointV2,
} from "@/lib/analytics/timeseries/client";
import {
  fetchSentimentV2,
  type SentimentV2Response,
} from "@/lib/analytics/sentiment.client";
import {
  fetchAgentStateSummaryV2,
  type AgentStateSummaryV2,
} from "@/lib/analytics/agentStateSummary.client";
import { fetchGoalSplitV2 } from "@/lib/analytics/goalSplit.client";
import {
  fetchDepartmentsV2,
  type DepartmentsDictionaryResponseV2,
} from "@/lib/dictionaries/departments.client";
import {
  fetchChannelsV2,
  type ChannelsDictionaryResponseV2,
} from "@/lib/dictionaries/channels.client";
import {
  fetchQueuesV2,
  type QueuesDictionaryResponseV2,
} from "@/lib/dictionaries/queues.client";
import {
  fetchTopicsV2,
  type TopicsDictionaryResponseV2,
} from "@/lib/dictionaries/topics.client";
import { getUiSource } from "@/lib/uiSource";
import { CALLS_BY_PERIOD } from "@/mock/callsByPeriod";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  Filter,
  RefreshCcw,
  Search,
  Settings,
  Bell,
  Users,
  PhoneCall,
  MessageSquare,
  Clock,
  ListChecks,
} from "lucide-react";

const envDefault =
  (process.env.NEXT_PUBLIC_UI_DATA_SOURCE as "MOCK" | "API" | undefined) ?? "MOCK";

const UI_DATA_SOURCE = getUiSource() ?? envDefault;

type Period = "today" | "yesterday" | "7d" | "30d" | "custom";

type Channel = "all" | "voice" | "chat" | "email" | "sms" | "push";
type TopicDirection = "all" | "in" | "out";

type Queue = "general" | "vip" | "antifraud";

type Dept = "Все отделы" | "Контакт-центр" | "Контроль качества" | "Антифрод";

type Theme = {
  name: string;
  count: number;
  avgHandleSec: number;
  fcrPct: number;
};

type FilterOption = {
  label: string;
  value: string;
};

type DictionaryOptionSource = {
  id?: string | number;
  code?: string;
  channelCode?: string;
  queueCode?: string;
  topicCode?: string;
  nameRu?: string;
  name?: string;
  label?: string;
  value?: string;
};

const mockDepartments: FilterOption[] = [
  { label: "Контакт-центр", value: "Контакт-центр" },
  { label: "Контроль качества", value: "Контроль качества" },
  { label: "Антифрод", value: "Антифрод" },
];

const mockChannels: FilterOption[] = [
  { label: "Звонки", value: "voice" },
  { label: "Чат", value: "chat" },
  { label: "Email", value: "email" },
  { label: "SMS", value: "sms" },
  { label: "Push", value: "push" },
];

const mockQueues: FilterOption[] = [
  { label: "Общая", value: "general" },
  { label: "VIP", value: "vip" },
  { label: "Антифрод", value: "antifraud" },
];

const mockTopics: FilterOption[] = [
  { label: "Авторизация ЛК", value: "Авторизация ЛК" },
  { label: "Сброс пароля", value: "Сброс пароля" },
  { label: "Консультация", value: "Консультация" },
  { label: "Ошибки в приложении", value: "Ошибки в приложении" },
];

type CallRow = {
  id: string;
  startedAt: string;
  channel: Exclude<Channel, "all">;
  queue: Exclude<Queue, "all">;
  dept: Exclude<Dept, "Все отделы">;
  operator: string;
  topic: string;
  durationSec: number;
  status: "Завершён" | "Пропущен" | "Ожидание" | "В разговоре";
  fcr: boolean;
  resolution: "resolved" | "escalated" | "followup";
};

const CHANNEL_TAB_LABELS: Record<Channel, string> = {
  all: "Все каналы",
  voice: "Звонки",
  chat: "Чат",
  email: "Email",
  sms: "SMS",
  push: "Push",
};

function mockResponseSec(channel: CallRow["channel"]) {
  return channel === "voice"
    ? 15 + Math.random() * 15
    : channel === "chat"
    ? 30 + Math.random() * 25
    : channel === "sms"
    ? 40 + Math.random() * 40
    : 120 + Math.random() * 300;
}

function formatSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function kpiDelta(delta: number) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}%`;
}

const queueLabel = (value: string, options?: FilterOption[]) => {
  if (value === "all") return "Все очереди";
  const apiOptionLabel = options?.find((item) => item.value === value)?.label;
  if (apiOptionLabel) return apiOptionLabel;
  if (value === "general" || value === "1") return "Общая";
  if (value === "vip" || value === "2") return "VIP";
  if (value === "antifraud" || value === "3") return "Антифрод";
  return value;
};

const COLORS = ["#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#f3f4f6"]; // neutral palette

const SENTIMENT_COLORS: Record<string, string> = {
  "Позитив": "#22c55e",     // зелёный
  "Нейтрально": "#f59e0b", // оранжевый
  "Негатив": "#dc2626",    // красный
};

const GOAL_COLORS: Record<string, string> = {
  "Решено": "#22c55e",        // зелёный
  "Эскалация": "#dc2626",    // красный
  "Требует действий": "#f59e0b", // на будущее
};

function mapRecentToUi(apiResp: RecentV2Response): CallRow[] {
  return (apiResp.items ?? []).map((r) => ({
      id: `C-${r.externalId}`,
      startedAt: new Date(r.startedAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      channel: r.channelCode,
      queue:
        r.queueCode === "general" || r.queueCode === "1"
          ? "general"
          : r.queueCode === "vip" || r.queueCode === "2"
          ? "vip"
          : r.queueCode === "antifraud" || r.queueCode === "3"
          ? "antifraud"
          : "general",
      dept:
        r.departmentNameRu === "Антифрод"
          ? "Антифрод"
          : r.departmentNameRu === "Контроль качества"
          ? "Контроль качества"
          : "Контакт-центр",
      operator: r.operatorNameRu ?? "—",
      topic: r.topicNameRu ?? "Не указано",
      durationSec: r.durationSec ?? 0,
      status: r.statusRu,
      fcr: false,
      resolution: "resolved",
    }));
}

function mapTopicsTsToUi(apiResp: TopicsTimeseriesResponseV2) {
  return (apiResp.items ?? []).map((p) => {
    const unsolved = p.missed ?? 0;
    const solved = Math.max(0, (p.incoming ?? 0) - unsolved);
    return {
      t: new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      solved,
      unsolved,
    };
  });
}

function mapOperatorsToUi(apiResp: OperatorsResponseV2) {
  return {
    items: (apiResp.items ?? []).map((row) => ({
      name: row.operatorNameRu,
      handled: row.handled,
      missed: row.missed,
      ahtMin: row.handled ? +(row.ahtSec / 60).toFixed(1) : 0,
      fcr: row.fcrPct,
    })),
    trend: (apiResp.trend ?? []).map((p) => ({
      t: new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      aht: p.ahtSec ?? 0,
      asa: p.asaSec ?? 0,
    })),
  };
}

function mapSentimentToUi(apiResp: SentimentV2Response) {
  return (apiResp.items ?? [])
    .map((item) => ({
      name: item.nameRu,
      value: item.value,
    }))
    .filter((item) => item.value > 0);
}

function mapGoalToUi(apiResp: Array<{ nameRu: string; value: number }> | null) {
  const values = { "Решено": 0, "Эскалация": 0 };

  for (const item of apiResp ?? []) {
    const key = item.nameRu.trim().toLowerCase();
    if (["решено", "resolved", "completed"].includes(key)) {
      values["Решено"] += item.value;
      continue;
    }
    if (["эскалация", "escalated", "escalation"].includes(key)) {
      values["Эскалация"] += item.value;
    }
  }

  return [
    { name: "Решено", value: values["Решено"] },
    { name: "Эскалация", value: values["Эскалация"] },
  ];
}

function formatTrendTimeLabel(rawTime: string) {
  const parsed = new Date(rawTime);
  if (Number.isNaN(parsed.getTime())) return rawTime;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatQueueDepthLocalHour(rawTime: string) {
  const parsed = new Date(rawTime);
  if (Number.isNaN(parsed.getTime())) return rawTime;
  return parsed.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function calculateAhtSec(calls: CallRow[]) {
  let ahtSum = 0;
  let ahtCnt = 0;

  for (const c of calls) {
    if (c.status === "Завершён") {
      ahtSum += c.durationSec;
      ahtCnt += 1;
    }
  }

  return ahtCnt ? Math.round(ahtSum / ahtCnt) : 0;
}

function normalizeTopicName(value: string | null | undefined) {
  if (!value) return "Не указано";
  const v = value.trim();
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(v) ? "Не указано" : v;
}

function mapDictionaryToOptions(apiResp: { items?: DictionaryOptionSource[] }): FilterOption[] {
  return (apiResp.items ?? [])
    .map((item) => {
      const label =
        item.nameRu ?? item.name ?? item.label;
      const value =
        item.code ??
        item.channelCode ??
        item.queueCode ??
        item.topicCode ??
        item.value ??
        (typeof item.id === "string" || typeof item.id === "number" ? String(item.id) : undefined) ??
        label;

      if (!label || !value) return null;
      return { label, value };
    })
    .filter((item): item is FilterOption => item !== null);
}

type ApiChannelResponseTrendPoint = {
  t: string;
  voice?: number;
  chat?: number;
  email?: number;
  sms?: number;
  push?: number;
  value?: number;
};

type QueuesAnalyticsResponseV2 = {
  items?: Array<{
    queueNameRu: string;
    total: number;
    abandonedPct: number | null;
    waiting: number;
    avgWaitSec: number;
    slaPct: number;
  }>;
  queueDepthTrend?: Array<{
    t: string;
    value: number;
  }>;
};

export default function ContactCenterAnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>("today");
  const [channel, setChannel] = useState<Channel>("all");
  const [selectedQueue, setSelectedQueue] = useState<string>("all");
  const [queueDepthQueue, setQueueDepthQueue] = useState<string>("all");
  const [dept, setDept] = useState<string>("Все отделы");
  const [query, setQuery] = useState<string>("");
  const [tab, setTab] = useState<string>("overview");
  const [topic, setTopic] = useState<string>("all");
  const [topicDirection, setTopicDirection] = useState<TopicDirection>("all");
  const [selectedOperator, setSelectedOperator] = useState<string>("all");
  const [channelTab, setChannelTab] = useState<Channel>("all");

  

  const [apiRecent, setApiRecent] = useState<RecentV2Response | null>(null);
  const [apiKpis, setApiKpis] = useState<KpisV2Response | null>(null);
  const [apiOperators, setApiOperators] = useState<OperatorsResponseV2 | null>(null);

  const [apiChannelSplit, setApiChannelSplit] = useState<
  {
    channelCode: string;
    channelNameRu: string;
    incoming: number;
    outgoing: number;
    responseSec: number | null;
  }[] | null
 >(null);
  const [apiChannelResponseTrend, setApiChannelResponseTrend] = useState<ApiChannelResponseTrendPoint[] | null>(null);
  const [apiQueuesV2, setApiQueuesV2] = useState<QueuesAnalyticsResponseV2 | null>(null);
  const [apiQueueDepthV2, setApiQueueDepthV2] = useState<QueuesAnalyticsResponseV2 | null>(null);

  const [apiTimeSeries, setApiTimeSeries] = useState<TimeseriesPointV2[] | null>(null);
  const [apiSentiment, setApiSentiment] = useState<SentimentV2Response | null>(null);
  const [apiGoalSplit, setApiGoalSplit] = useState<Array<{ nameRu: string; value: number }> | null>(null);
  const [apiTopicsTop, setApiTopicsTop] = useState<
    Array<{ name: string; count: number; avgHandleSec: number; fcrPct: number }> | null
  >(null);
  const [apiTopicsTs, setApiTopicsTs] = useState<TopicsTimeseriesResponseV2 | null>(null);
  const [apiTopicsTsLoading, setApiTopicsTsLoading] = useState<boolean>(false);
  const [apiTopicsTsError, setApiTopicsTsError] = useState<string | null>(null);
  const [apiAgentStateSummary, setApiAgentStateSummary] = useState<AgentStateSummaryV2 | null>(null);
  const [apiDepartments, setApiDepartments] = useState<DepartmentsDictionaryResponseV2 | null>(null);
  const [apiChannels, setApiChannels] = useState<ChannelsDictionaryResponseV2 | null>(null);
  const [apiQueues, setApiQueues] = useState<QueuesDictionaryResponseV2 | null>(null);
  const [apiTopics, setApiTopics] = useState<TopicsDictionaryResponseV2 | null>(null);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;
    setApiQueuesV2(null);

    (async () => {
      try {
        const params = new URLSearchParams({ period });
        if (dept !== "Все отделы") params.set("dept", dept);
        if (selectedQueue !== "all") params.set("queue", selectedQueue);
        if (query) params.set("q", query);
        params.set("tzOffsetMinutes", String(new Date().getTimezoneOffset()));

        const res = await fetch(`/api/analytics/queues/v2?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`queues/v2 failed: ${res.status}`);
        const data = (await res.json()) as QueuesAnalyticsResponseV2;

        if (!alive) return;
        setApiQueuesV2(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] analytics/queues/v2 failed", e);
        setApiQueuesV2(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, dept, selectedQueue, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;
    setApiQueueDepthV2(null);

    (async () => {
      try {
        const params = new URLSearchParams({ period });
        if (dept !== "Все отделы") params.set("dept", dept);
        if (queueDepthQueue !== "all") params.set("queue", queueDepthQueue);
        if (query) params.set("q", query);
        params.set("tzOffsetMinutes", String(new Date().getTimezoneOffset()));

        const res = await fetch(`/api/analytics/queues/v2?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`queue depth queues/v2 failed: ${res.status}`);
        const data = (await res.json()) as QueuesAnalyticsResponseV2;

        if (!alive) return;
        setApiQueueDepthV2(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] analytics/queues/v2 (queue depth) failed", e);
        setApiQueueDepthV2(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, dept, queueDepthQueue, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      try {
        const [departments, channels, queues] = await Promise.all([
          fetchDepartmentsV2(),
          fetchChannelsV2(),
          fetchQueuesV2(),
        ]);

        if (!alive) return;

        setApiDepartments(departments);
        setApiChannels(channels);
        setApiQueues(queues);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] dictionaries/v2 failed", e);
        setApiDepartments(null);
        setApiChannels(null);
        setApiQueues(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      try {
        const topics = await fetchTopicsV2(topicDirection);

        if (!alive) return;

        setApiTopics(topics);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] topics dictionary failed", e);
        setApiTopics(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, topicDirection]);

  useEffect(() => {
    setTopic("all");
  }, [topicDirection]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      try {
        const data = await fetchSentimentV2({
          period,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(selectedOperator !== "all" ? { operator: selectedOperator } : {}),
          ...(topic !== "all" ? { topic } : {}),
          ...(query ? { q: query } : {}),
        });
        if (!alive) return;
        setApiSentiment(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] sentiment/v2 failed", e);
        setApiSentiment(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, dept, channel, selectedQueue, selectedOperator, topic, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      try {
        const data = await fetchAgentStateSummaryV2({
          period,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
        });
        if (!alive) return;
        setApiAgentStateSummary(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] agent-state/summary/v2 failed", e);
        setApiAgentStateSummary(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, dept, selectedQueue]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      try {
        const data = await fetchGoalSplitV2({
          period,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(selectedOperator !== "all" ? { operator: selectedOperator } : {}),
          ...(topic !== "all" ? { topic } : {}),
          ...(query ? { q: query } : {}),
        });
        if (!alive) return;
        setApiGoalSplit(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] goal split source failed", e);
        setApiGoalSplit(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, dept, channel, selectedQueue, selectedOperator, topic, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        const data = await fetchKpisV2({
          period,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(selectedOperator !== "all" ? { operator: selectedOperator } : {}),
          ...(topic !== "all" ? { topic } : {}),
          ...(query ? { q: query } : {}),
        });
        if (!alive) return;
        setApiKpis(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] kpis/v2 failed", e);
        setApiKpis(null);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [UI_DATA_SOURCE, period, dept, channel, selectedQueue, selectedOperator, topic, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      setApiTopicsTsLoading(true);
      setApiTopicsTsError(null);
      try {
        const data = await fetchTopicsTimeseriesV2({
          period,
          bucket: "hour",
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(selectedOperator !== "all" ? { operator: selectedOperator } : {}),
          topic,
          ...(query ? { q: query } : {}),
        });
        if (!alive) return;
        setApiTopicsTs(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] topics/timeseries/v2 failed", e);
        setApiTopicsTs(null);
        setApiTopicsTsError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!alive) return;
        setApiTopicsTsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [period, dept, channel, selectedQueue, selectedOperator, topic, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchTopicsTopV2({
          period,
          direction: topicDirection,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(query ? { q: query } : {}),
        });
        if (!alive) return;
        setApiTopicsTop(
          (res.topTopics ?? []).map((t) => ({
            name: normalizeTopicName(t.topicNameRu),
            count: t.count,
            avgHandleSec: t.avgHandleSec,
            fcrPct: t.fcrPct,
          }))
        );
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] topics/top/v2 failed", e);
        setApiTopicsTop(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, topicDirection, dept, channel, selectedQueue, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchOperatorsV2({
          period,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(topic !== "all" ? { topic } : {}),
          operator: selectedOperator,
          ...(query ? { q: query } : {}),
          limit: 20,
          offset: 0,
        });
        if (!alive) return;
        setApiOperators(res);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] operators/v2 failed", e);
        setApiOperators(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, dept, channel, selectedQueue, topic, selectedOperator, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      try {
        const data = await fetchTimeseriesV2({
          period,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(selectedOperator !== "all" ? { operator: selectedOperator } : {}),
          ...(topic !== "all" ? { topic } : {}),
          ...(query ? { q: query } : {}),
        });
        if (!alive) return;
        setApiTimeSeries(data.items ?? []);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] timeseries/v2 failed", e);
        setApiTimeSeries(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [period, dept, channel, selectedQueue, selectedOperator, topic, query]);

  useEffect(() => {
    if (UI_DATA_SOURCE !== "API") return;

    let alive = true;

    (async () => {
      try {
        const data = await fetchRecentV2({
          period,
          ...(dept !== "Все отделы" ? { dept } : {}),
          ...(channel !== "all" ? { channel } : {}),
          ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
          ...(selectedOperator !== "all" ? { operator: selectedOperator } : {}),
          ...(topic !== "all" ? { topic } : {}),
          ...(query ? { q: query } : {}),
          limit: 20,
          offset: 0,
        });
        if (!alive) return;
        setApiRecent(data);
      } catch (e) {
        if (!alive) return;
        console.warn("[UI] recent/v2 failed", e);
        setApiRecent(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UI_DATA_SOURCE, period, dept, channel, selectedQueue, selectedOperator, topic, query]);

  const calls: CallRow[] = useMemo(() => {
  const result: CallRow[] = [];

  const hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17"];
  const operators =
    UI_DATA_SOURCE === "API" && apiOperators?.items?.length
      ? apiOperators.items.map((o) => o.operatorNameRu)
      : ["Иван Петров", "Анна Соколова", "Алексей Козлов", "Мария Орлова"];
  const topics = ["Авторизация ЛК", "Сброс пароля", "Консультация", "Ошибки в приложении"];

  const queues: CallRow["queue"][] = ["general", "vip", "antifraud"];
  const channels: CallRow["channel"][] = ["voice", "chat", "email", "sms", "push"];

  let id = period === "yesterday" ? 9000 : 10000;
  const depts: Array<"Контакт-центр" | "Контроль качества" | "Антифрод"> = [
  "Контакт-центр",
  "Контроль качества",
  "Антифрод",
];

const allChannels: Array<"voice" | "chat" | "email" | "sms" | "push"> = [
  "voice",
  "chat",
  "email",
  "sms",
  "push",
];

// seed: по 1 записи на каждую комбинацию (dept×queue×channel)
for (const dept of depts) {
  for (const queue of queues) {
    for (const ch of allChannels) {
      // чтобы Антифрод выглядел логично: он “любит” antifraud
      const q = dept === "Антифрод" ? "antifraud" : queue;

      const status = Math.random() < 0.12 ? "Пропущен" : "Завершён";
      const resolution =
        status === "Пропущен"
          ? "followup"
          : Math.random() < 0.75
          ? "resolved"
          : Math.random() < 0.6
          ? "escalated"
          : "followup";
      const fcr = resolution === "resolved" && Math.random() < 0.7;

      result.push({
        id: `C-${id++}`,
        startedAt: `09:00`,
        channel: ch,
        queue: q,
        dept,
        operator: operators[id % operators.length],
        topic: topics[id % topics.length],
        durationSec: 120 + Math.floor(Math.random() * 300),
        status,
        fcr,
        resolution,
      });
    }
  }
}

  for (const h of hours) {
    for (const queue of queues) {
      const callsPerQueuePerHour = 3 + Math.floor(Math.random() * 4); // 3–6 на очередь в час

// 👉 гарантируем одно SMS
const status = Math.random() < 0.12 ? "Пропущен" : "Завершён";
const resolution =
  status === "Пропущен"
    ? "followup"
    : Math.random() < 0.72
    ? "resolved"
    : Math.random() < 0.55
    ? "escalated"
    : "followup";
const fcr = resolution === "resolved" && Math.random() < 0.68;

result.push({
  id: `C-${id++}`,
  startedAt: `${h}:05`,
  channel: "sms",
  queue,
  dept: queue === "antifraud" ? "Антифрод" : "Контакт-центр",
  operator: operators[id % operators.length],
  topic: topics[id % topics.length],
  durationSec: 160 + Math.floor(Math.random() * 180),
  status,
  fcr,
  resolution,
});

// 👉 остальные обращения как раньше
for (let i = 1; i < callsPerQueuePerHour; i++) {
  const ch = channels[(i + h.charCodeAt(0)) % channels.length];
  const status = Math.random() < 0.12 ? "Пропущен" : "Завершён";
  const resolution =
    status === "Пропущен"
      ? "followup"
      : Math.random() < 0.78
      ? "resolved"
      : Math.random() < 0.6
      ? "escalated"
      : "followup";
  const fcr = resolution === "resolved" && Math.random() < 0.7;

  result.push({
    id: `C-${id++}`,
    startedAt: `${h}:${String(5 + i * 5).padStart(2, "0")}`,
    channel: ch,
    queue,
    dept:
  queue === "antifraud"
    ? "Антифрод"
    : Math.random() < 0.2
    ? "Контроль качества"
    : "Контакт-центр",
    operator: operators[(i + id) % operators.length],
    topic: topics[(i + id) % topics.length],
    durationSec: 180 + Math.floor(Math.random() * 240),
    status,
    fcr,
    resolution,
  });
}
    }
  }

  return result;
}, [UI_DATA_SOURCE, apiOperators, period]);

  const operatorsView = useMemo(() => {
    if (UI_DATA_SOURCE === "API" && apiOperators != null) {
      return mapOperatorsToUi(apiOperators);
    }
    return null;
  }, [UI_DATA_SOURCE, apiOperators]);

  const filteredCalls = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((r) => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (selectedQueue !== "all" && r.queue !== selectedQueue) return false;
      if (dept !== "Все отделы" && r.dept !== dept) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.operator.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q)
      );
    });
  }, [calls, channel, selectedQueue, dept, query]);

  const filteredCallsWithoutQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((r) => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (dept !== "Все отделы" && r.dept !== dept) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.operator.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q)
      );
    });
  }, [calls, channel, dept, query]);

  const operatorOptions = useMemo(() => {
    if (UI_DATA_SOURCE === "API" && apiOperators?.items?.length) {
      return apiOperators.items
        .filter((item) => Boolean(item.operatorLogin))
        .map((item) => ({
          label: item.operatorNameRu,
          value: item.operatorLogin as string,
        }));
    }

    const s = new Set<string>();
    for (const c of filteredCalls) s.add(c.operator);
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b))
      .map((operator) => ({ label: operator, value: operator }));
  }, [UI_DATA_SOURCE, apiOperators, filteredCalls]);

  const operatorFilteredCalls = useMemo(() => {
    if (selectedOperator === "all") return filteredCalls;
    if (UI_DATA_SOURCE === "API") return filteredCalls;
    return filteredCalls.filter((c) => c.operator === selectedOperator);
  }, [UI_DATA_SOURCE, filteredCalls, selectedOperator]);

  const queueCalls = useMemo(() => {
    if (UI_DATA_SOURCE === "API") return [] as CallRow[];
    return queueDepthQueue === "all"
      ? filteredCallsWithoutQueue
      : filteredCallsWithoutQueue.filter((c) => c.queue === queueDepthQueue);
  }, [UI_DATA_SOURCE, filteredCallsWithoutQueue, queueDepthQueue]);

  const channelTabCalls = useMemo(() => {
    if (channelTab === "all") return filteredCalls;
    return filteredCalls.filter((c) => c.channel === channelTab);
  }, [filteredCalls, channelTab]);

  const latestCalls = useMemo(() => {
    if (UI_DATA_SOURCE === "API" && apiRecent !== null) {
      return mapRecentToUi(apiRecent);
    }

    // === MOCK mode: как было ===
    if (tab === "queues" && selectedQueue !== "all") {
      return filteredCalls.filter((c) => c.queue === selectedQueue);
    }
    if (tab === "channels") {
      return channelTabCalls.slice(0, 10);
    }
    return filteredCalls;
  }, [
    UI_DATA_SOURCE,
    apiRecent,
    tab,
    selectedQueue,
    filteredCalls,
    channelTabCalls,
  ]);

  const topicOptions = useMemo(() => {
    if (UI_DATA_SOURCE === "API") {
      if (apiTopics == null) return [] as FilterOption[];
      return (apiTopics.items ?? [])
        .map((item) => ({
          value: String(item.id),
          label: item.nameRu,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru"));
    }

    const s = new Set<string>();
    for (const c of filteredCalls) s.add(c.topic);
    if (s.size === 0) return mockTopics;
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }));
  }, [UI_DATA_SOURCE, apiTopics, filteredCalls]);

  const departmentOptions = useMemo(() => {
    if (UI_DATA_SOURCE === "API" && apiDepartments != null) {
      return mapDictionaryToOptions(apiDepartments);
    }
    return mockDepartments;
  }, [UI_DATA_SOURCE, apiDepartments]);

  const channelOptions = useMemo(() => {
    if (UI_DATA_SOURCE === "API" && apiChannels != null) {
      return mapDictionaryToOptions(apiChannels);
    }
    return mockChannels;
  }, [UI_DATA_SOURCE, apiChannels]);

  const queueSelectOptions = useMemo(() => {
    if (UI_DATA_SOURCE === "API" && apiQueues != null) {
      return (apiQueues.items ?? [])
        .map((item) => {
          const label = item.nameRu ?? item.name ?? item.label;
          const value =
            typeof item.id === "string" || typeof item.id === "number"
              ? String(item.id)
              : undefined;
          if (!label || !value) return null;
          return { label, value };
        })
        .filter((item): item is FilterOption => item !== null);
    }
    return mockQueues;
  }, [UI_DATA_SOURCE, apiQueues]);

  const selectedQueueLabel = useMemo(() => {
    if (selectedQueue === "all") return "Все очереди";
    if (UI_DATA_SOURCE === "API") {
      return (
        queueSelectOptions.find((item) => item.value === selectedQueue)?.label ??
        selectedQueue
      );
    }
    return queueLabel(selectedQueue, queueSelectOptions);
  }, [UI_DATA_SOURCE, selectedQueue, queueSelectOptions]);

  const queueDepthQueueLabel = useMemo(() => {
    if (queueDepthQueue === "all") return "Все очереди";
    if (UI_DATA_SOURCE === "API") {
      return (
        queueSelectOptions.find((item) => item.value === queueDepthQueue)?.label ??
        queueDepthQueue
      );
    }
    return queueLabel(queueDepthQueue, queueSelectOptions);
  }, [UI_DATA_SOURCE, queueDepthQueue, queueSelectOptions]);

  const topicCalls = useMemo(
    () =>
      topic === "all"
        ? filteredCalls
        : filteredCalls.filter((c) => c.topic === topic),
    [filteredCalls, topic]
  );

  const topicAhtGauge = useMemo(() => {
    const handled = topicCalls.filter(
      (c) => c.status === "Завершён" && c.durationSec > 0
    );

    const ahtSec = handled.length
      ? Math.round(handled.reduce((sum, c) => sum + c.durationSec, 0) / handled.length)
      : 0;

    const boundedAht = Math.max(0, Math.min(600, ahtSec));
    return {
      ahtSec,
      data: [
        { name: "AHT", value: boundedAht },
        { name: "Остальное", value: 600 - boundedAht },
      ],
    };
  }, [topicCalls]);

  const topicChannelSplit = useMemo(() => {
    const channelOrder: Array<{
      key: Exclude<Channel, "all">;
      label: string;
      color: string;
    }> = [
      { key: "email", label: "Email", color: COLORS[0] },
      { key: "push", label: "Push", color: COLORS[1] },
      { key: "sms", label: "SMS", color: COLORS[2] },
      { key: "voice", label: "Звонки", color: COLORS[3] },
      { key: "chat", label: "Чат", color: COLORS[4] },
    ];

    const countByChannel = new Map<Exclude<Channel, "all">, number>([
      ["voice", 0],
      ["chat", 0],
      ["email", 0],
      ["sms", 0],
      ["push", 0],
    ]);

    for (const c of topicCalls) {
      countByChannel.set(c.channel, (countByChannel.get(c.channel) ?? 0) + 1);
    }

    const data = channelOrder
      .map(({ key, label, color }) => ({
        name: label,
        value: countByChannel.get(key) ?? 0,
        color,
      }))
      .filter((item) => item.value > 0);

    return data.length ? data : [{ name: "Нет данных", value: 1, color: "#d1d5db" }];
  }, [topicCalls]);

  const topicSentimentSplit = useMemo(() => {
    if (!topicCalls.length) {
      return [{ name: "Нет данных", value: 1, color: "#d1d5db" }];
    }

    const missed = topicCalls.filter((c) => c.status === "Пропущен").length;
    const missedRatio = missed / topicCalls.length;

    const negative = Math.max(5, Math.min(70, Math.round(missedRatio * 100)));
    const positive = Math.max(10, Math.round((1 - missedRatio) * 45));
    const neutral = Math.max(5, 100 - positive - negative);

    return [
      { name: "Позитив", value: positive, color: SENTIMENT_COLORS["Позитив"] },
      { name: "Нейтрально", value: neutral, color: SENTIMENT_COLORS["Нейтрально"] },
      { name: "Негатив", value: negative, color: SENTIMENT_COLORS["Негатив"] },
    ];
  }, [topicCalls]);

  const topicGoalSplit = useMemo(() => {
    if (!topicCalls.length) {
      return [{ name: "Нет данных", value: 1, color: "#d1d5db" }];
    }

    const resolved = topicCalls.filter((c) => c.status === "Завершён").length;
    const resolvedPct = Math.round((resolved / topicCalls.length) * 100);
    const escalatedPct = 100 - resolvedPct;

    return [
      { name: "Решено", value: resolvedPct, color: GOAL_COLORS["Решено"] },
      { name: "Эскалация", value: escalatedPct, color: GOAL_COLORS["Эскалация"] },
    ];
  }, [topicCalls]);

  const topicTimeSeries = useMemo(() => {
  if (UI_DATA_SOURCE === "API" && apiTopicsTs != null) {
    return mapTopicsTsToUi(apiTopicsTs);
  }

  const hours = ["09", "10", "11", "12", "13", "14", "15"];

  const map = new Map<string, { solved: number; unsolved: number }>();
  for (const h of hours) map.set(`${h}:00`, { solved: 0, unsolved: 0 });

  for (const c of filteredCalls) {
    if (topic !== "all" && c.topic !== topic) continue;

    const key = `${c.startedAt.split(":")[0]}:00`;
    const cur = map.get(key);
    if (!cur) continue;

    const solved =
      (c.status === "Завершён" && c.resolution === "resolved") || c.fcr;

    if (solved) {
      cur.solved += 1;
    } else {
      cur.unsolved += 1;
    }
  }

  return hours.map((h) => {
    const t = `${h}:00`;
    const v = map.get(t) ?? { solved: 0, unsolved: 0 };
    return { t, solved: v.solved, unsolved: v.unsolved };
  });
}, [UI_DATA_SOURCE, apiTopicsTs, filteredCalls, topic]);

  const isApiTopicsTsEmpty =
    UI_DATA_SOURCE === "API" &&
    !apiTopicsTsLoading &&
    !apiTopicsTsError &&
    (apiTopicsTs?.items?.length ?? 0) === 0;

const kpis = useMemo(() => {
  if (UI_DATA_SOURCE === "API" && apiKpis) {
    const apiCalls = apiRecent ? mapRecentToUi(apiRecent) : [];
    const recalculatedAhtSec =
      apiCalls.length > 0 ? calculateAhtSec(apiCalls) : apiKpis.ahtSec;

    return {
      ...apiKpis,
      ahtSec: recalculatedAhtSec,
    };
  }
  const incoming = filteredCalls.length;
  const missed = filteredCalls.filter((c) => c.status === "Пропущен").length;
  const ahtSec = calculateAhtSec(filteredCalls);

  const completed = filteredCalls.filter(
    (c) => c.status === "Завершён"
  ).length;

  return {
    incoming,
    missed,
    completed,
    ahtSec,
    total: incoming,
  };
}, [UI_DATA_SOURCE, filteredCalls, apiKpis, apiRecent]);

const kpiCards = useMemo(() => {
  const operatorsOnCalls = new Set(
    filteredCalls.map((c) => c.operator)
  ).size;

  const fcrPct = kpis.incoming
    ? Math.round((kpis.completed / kpis.incoming) * 100)
    : 0;

  return [
    {
      title: "Входящие",
      value: kpis.incoming.toLocaleString("ru-RU"),
      icon: PhoneCall,
      note: "за период",
      delta: 0,
    },
    {
      title: "Пропущенные",
      value: kpis.missed.toLocaleString("ru-RU"),
      icon: Bell,
      note: "требуют реакции",
      delta: 0,
    },
    {
      title: "Средняя длительность",
      value: kpis.ahtSec ? formatSec(kpis.ahtSec) : "—",
      icon: Clock,
      note: "AHT",
      delta: 0,
    },
    {
      title: "Нагрузка операторов",
      value:
        UI_DATA_SOURCE === "API" && apiAgentStateSummary
          ? `${apiAgentStateSummary.onLine} / ${apiAgentStateSummary.total}`
          : `${operatorsOnCalls} / 44`,
      icon: Users,
      note: "уникальных / всего",
      delta: 0,
    },
    {
      title: "FCR",
      value: `${Math.min(100, Math.max(0, fcrPct))}%`,
      icon: ListChecks,
      note: "завершённые / все",
      delta: 0,
    },
  ];
}, [filteredCalls, kpis, apiAgentStateSummary]);



  const timeSeries = useMemo(() => {
  if (UI_DATA_SOURCE === "API" && apiTimeSeries) {
    return apiTimeSeries.map((p) => ({
      t: new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      incoming: p.incoming,
      missed: p.missed,
      aht: p.ahtSec ?? 0,
    }));
  }

  // фиксируем “витрину” часов, чтобы график не схлопывался в точку
  
  const hours = ["09", "10", "11", "12", "13", "14", "15"];

  const map = new Map<
    string,
    { t: string; incoming: number; missed: number; ahtSum: number; ahtCnt: number }
  >();

  // 1) заполняем нулями все часы
  for (const h of hours) {
    const key = `${h}:00`;
    map.set(key, { t: key, incoming: 0, missed: 0, ahtSum: 0, ahtCnt: 0 });
  }

  // 2) накатываем реальные данные
  for (const c of filteredCalls) {
    const hour = c.startedAt.split(":")[0]; // "15"
    const key = `${hour}:00`;

    // если вдруг час вне витрины (например 08:xx), можно либо пропустить, либо добавить
    const cur =
      map.get(key) ?? { t: key, incoming: 0, missed: 0, ahtSum: 0, ahtCnt: 0 };

    cur.incoming += 1;

    if (c.status === "Пропущен") {
      cur.missed += 1;
    }

    if (c.status === "Завершён" && c.durationSec > 0) {
      cur.ahtSum += c.durationSec;
      cur.ahtCnt += 1;
    }

    map.set(key, cur);
  }

  // 3) возвращаем в правильном порядке (с нулями)
  return hours.map((h) => {
    const key = `${h}:00`;
    const x = map.get(key)!;
    return {
      t: x.t,
      incoming: x.incoming,
      missed: x.missed,
      aht: x.ahtCnt ? Math.round(x.ahtSum / x.ahtCnt) : 0,
    };
  });
}, [filteredCalls, apiTimeSeries]);


const operatorLoad = useMemo(() => {
  if (UI_DATA_SOURCE === "API" && apiAgentStateSummary) {
    return [
      { name: "На линии", value: apiAgentStateSummary.onLine },
      { name: "Ожидают", value: apiAgentStateSummary.waiting },
      { name: "Не доступен", value: apiAgentStateSummary.unavailable },
    ];
  }

  const handled = filteredCalls.filter((c) => c.status === "Завершён").length;
  const missed = filteredCalls.filter((c) => c.status === "Пропущен").length;

  const onLine = Math.min(44, Math.max(0, Math.round(handled / 6))); // демо-оценка
  const waiting = Math.min(44 - onLine, Math.max(0, Math.round(missed / 6)));
  const unavailable = Math.max(0, 44 - onLine - waiting);

  return [
    { name: "На линии", value: onLine },
    { name: "Ожидают", value: waiting },
    { name: "Не доступен", value: unavailable },
  ];
}, [UI_DATA_SOURCE, apiAgentStateSummary, filteredCalls]);
  const topicsTrend = useMemo(() => {
  const hours = ["09", "10", "11", "12", "13", "14", "15"];

  const cntByTopic = new Map<string, number>();
  for (const c of filteredCalls) {
    cntByTopic.set(c.topic, (cntByTopic.get(c.topic) ?? 0) + 1);
  }

  const topTopics = Array.from(cntByTopic.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  const base = hours.map((h) => {
    const row: Record<string, any> = { t: `${h}:00` };
    for (const topic of topTopics) row[topic] = 0;
    return row;
  });

  const idxByHour = new Map(hours.map((h, i) => [`${h}:00`, i]));

  for (const c of filteredCalls) {
    if (!topTopics.includes(c.topic)) continue;
    const key = `${c.startedAt.split(":")[0]}:00`;
    const idx = idxByHour.get(key);
    if (idx === undefined) continue;
    base[idx][c.topic] += 1;
  }

  return { data: base, topTopics };
}, [filteredCalls]);
  const channelSplit = useMemo(() => {
    if (UI_DATA_SOURCE === "API") {
      const split = (apiTopicsTop?.channelSplit ?? [])
        .map((item) => ({
          name: item.nameRu,
          value: item.value,
        }))
        .filter((item) => item.value > 0);

      return split.length ? split : [{ name: "Нет данных", value: 1 }];
    }

    const map = new Map<string, number>();

    for (const c of filteredCalls) {
      const label =
        c.channel === "voice"
          ? "Звонки"
          : c.channel === "chat"
          ? "Чат"
          : c.channel === "email"
          ? "Email"
          : c.channel === "sms"
          ? "SMS"
          : "Push";

      map.set(label, (map.get(label) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [UI_DATA_SOURCE, apiTopicsTop, filteredCalls]);

 const sentimentSplit = useMemo(() => {
  const counts = { "Позитив": 0, "Нейтрально": 0, "Негатив": 0 };

  for (const c of filteredCalls) {
    if (c.status === "Пропущен") counts["Негатив"] += 1;
    else if (c.channel === "voice") counts["Нейтрально"] += 1;
    else counts["Позитив"] += 1;
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0);
}, [filteredCalls]);

 const sentimentSplitView = useMemo(() => {
  if (UI_DATA_SOURCE === "API" && apiSentiment !== null) {
    return mapSentimentToUi(apiSentiment);
  }
  return sentimentSplit;
 }, [UI_DATA_SOURCE, apiSentiment, sentimentSplit]);

const goalSplit = useMemo(() => {
  if (UI_DATA_SOURCE === "API") {
    return mapGoalToUi(apiGoalSplit);
  }

  const counts = { "Решено": 0, "Эскалация": 0, "Требует действий": 0 };

  for (const c of filteredCalls) {
    if (c.status === "Завершён") counts["Решено"] += 1;
    else if (c.status === "Пропущен") counts["Эскалация"] += 1;
    else counts["Требует действий"] += 1;
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0);
}, [UI_DATA_SOURCE, apiGoalSplit, filteredCalls]);

  const themes: Theme[] = useMemo(() => {
  const map = new Map<
    string,
    { count: number; sumSec: number; handled: number; completed: number }
  >();

  for (const c of filteredCalls) {
    const cur =
      map.get(c.topic) ?? { count: 0, sumSec: 0, handled: 0, completed: 0 };

    cur.count += 1;

    if (c.durationSec > 0) {
      cur.sumSec += c.durationSec;
      cur.handled += 1;
    }

    if (c.status === "Завершён") {
      cur.completed += 1;
    }

    map.set(c.topic, cur);
  }

  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      count: v.count,
      avgHandleSec: v.handled ? Math.round(v.sumSec / v.handled) : 0,
      fcrPct: v.count ? Math.round((v.completed / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}, [filteredCalls]);

  const themesView = UI_DATA_SOURCE === "API" && apiTopicsTop ? apiTopicsTop : themes;
  const topicSplit = useMemo(() => {
  const m = new Map<string, number>();

  for (const c of filteredCalls) {
    m.set(c.topic, (m.get(c.topic) ?? 0) + 1);
  }

  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));
}, [filteredCalls]);

  // Доп. данные для вкладок (мок)
  const operatorStats = useMemo(() => {
  if (operatorsView) {
    return operatorsView.items;
  }

  const map = new Map<
    string,
    { handled: number; missed: number; sumSec: number; completed: number }
  >();

  for (const c of filteredCalls) {
    const cur =
      map.get(c.operator) ?? {
        handled: 0,
        missed: 0,
        sumSec: 0,
        completed: 0,
      };

    if (c.status === "Пропущен") {
      cur.missed += 1;
    } else {
      cur.handled += 1;
    }

    if (c.durationSec > 0) {
      cur.sumSec += c.durationSec;
    }

    if (c.status === "Завершён") {
      cur.completed += 1;
    }

    map.set(c.operator, cur);
  }

  return Array.from(map.entries()).map(([name, v]) => ({
    name,
    handled: v.handled,
    missed: v.missed,
    ahtMin: v.handled ? +(v.sumSec / v.handled / 60).toFixed(1) : 0,
    fcr: v.handled + v.missed
      ? Math.round((v.completed / (v.handled + v.missed)) * 100)
      : 0,
  }));
}, [filteredCalls, operatorsView]);


  const operatorAhtTrend = useMemo(() => {
  if (operatorsView) {
    return operatorsView.trend;
  }

  const map = new Map<
    string,
    { t: string; ahtSum: number; cnt: number; asaSum: number }
  >();

  for (const c of operatorFilteredCalls) {
    const hour = c.startedAt.split(":")[0];
    const key = `${hour}:00`;

    const cur =
      map.get(key) ?? { t: key, ahtSum: 0, cnt: 0, asaSum: 0 };

    if (c.durationSec > 0) {
      cur.ahtSum += c.durationSec;
      cur.cnt += 1;

      // простая модель ASA: меньше при голосе, больше при тексте
      const asa =
        c.channel === "voice"
          ? 15 + Math.random() * 10
          : c.channel === "chat"
          ? 30 + Math.random() * 15
          : 60 + Math.random() * 40;

      cur.asaSum += asa;
    }

    map.set(key, cur);
  }

  return Array.from(map.values())
    .sort((a, b) => a.t.localeCompare(b.t))
    .map((x) => ({
      t: x.t,
      aht: x.cnt ? Math.round(x.ahtSum / x.cnt) : 0,
      asa: x.cnt ? Math.round(x.asaSum / x.cnt) : 0,
    }));
}, [operatorFilteredCalls, operatorsView]);


  const queueStats = useMemo(() => {
  if (UI_DATA_SOURCE === "API") {
    const items = apiQueuesV2?.items ?? [];
    return items.map((item) => ({
      name: item.queueNameRu,
      total: item.total,
      waiting: item.waiting,
      avgWaitSec: item.avgWaitSec,
      slaPct: item.slaPct,
      abandonedPct: item.abandonedPct ?? 0,
    }));
  }

  const map = new Map<
    string,
    { total: number; missed: number; sumWait: number }
  >();

  for (const c of filteredCalls) {
    const cur =
      map.get(c.queue) ?? { total: 0, missed: 0, sumWait: 0 };

    cur.total += 1;

    if (c.status === "Пропущен") {
      cur.missed += 1;
    }

    // простая модель ожидания (сек)
    const wait =
      c.channel === "voice"
        ? 20 + Math.random() * 40
        : c.channel === "chat"
        ? 30 + Math.random() * 60
        : 60 + Math.random() * 120;

    cur.sumWait += wait;

    map.set(c.queue, cur);
  }

  return Array.from(map.entries()).map(([queue, v]) => {
    const avgWait = v.total ? Math.round(v.sumWait / v.total) : 0;

    const abandonedPct = v.total
      ? Math.round((v.missed / v.total) * 100)
      : 0;

    const slaPct = Math.max(60, 100 - abandonedPct - Math.round(avgWait / 5));

    return {
      name:
        queue === "general"
          ? "Общая"
          : queue === "vip"
          ? "VIP"
          : "Антифрод",
      total: v.total,
      waiting: Math.round(v.total * 0.08), // приблизительно в очереди
      avgWaitSec: avgWait,
      slaPct,
      abandonedPct,
    };
  });
}, [UI_DATA_SOURCE, apiQueuesV2, filteredCalls]);


  const queueDepthTrend = useMemo(
    () => {
      if (UI_DATA_SOURCE === "API") {
        const trend = apiQueueDepthV2?.queueDepthTrend ?? [];
        return trend.map((row) => ({
          t: formatQueueDepthLocalHour(row.t),
          queueDepth: row.value ?? 0,
        }));
      }

      const hours = ["09", "10", "11", "12", "13", "14", "15"];
      const map = new Map<string, number>();

      for (const h of hours) {
        map.set(`${h}:00`, 0);
      }

      for (const c of queueCalls) {
        const key = `${c.startedAt.split(":")[0]}:00`;
        if (!map.has(key)) continue;
        map.set(key, (map.get(key) ?? 0) + 1);
      }

      return hours.map((h) => ({
        t: `${h}:00`,
        queueDepth: map.get(`${h}:00`) ?? 0,
      }));
    },
    [UI_DATA_SOURCE, apiQueueDepthV2, queueCalls]
  );

  useEffect(() => {
  if (UI_DATA_SOURCE !== "API") return;

  let alive = true;

  (async () => {
    try {
      const res = await fetchChannelsSplitV2({
        period,
        ...(dept !== "Все отделы" ? { dept } : {}),
        ...(channel !== "all" ? { channel } : {}),
        ...(selectedQueue !== "all" ? { queue: selectedQueue } : {}),
        ...(query ? { q: query } : {}),
      });
      if (!alive) return;
      setApiChannelSplit(res.split ?? []);
      setApiChannelResponseTrend(res.responseTrend ?? []);
    } catch (e) {
      if (!alive) return;
      console.warn("[UI] channels/split/v2 failed", e);
      setApiChannelSplit(null);
      setApiChannelResponseTrend(null);
    }
  })();

  return () => {
    alive = false;
  };
  }, [UI_DATA_SOURCE, period, dept, channel, selectedQueue, query]);

  const channelVolumes = useMemo(() => {
  if (UI_DATA_SOURCE === "API") {
    return (apiChannelSplit ?? []).map((item) => ({
      name: item.channelNameRu,
      incoming: item.incoming,
      outgoing: item.outgoing,
      responseSec: item.responseSec ?? 0,
    }));
  }

  const map = new Map<
    string,
    { incoming: number; responseSum: number; cnt: number }
  >();

  for (const c of filteredCalls) {
    const key = c.channel;

    const cur =
      map.get(key) ?? { incoming: 0, responseSum: 0, cnt: 0 };

    cur.incoming += 1;

    // простая модель времени ответа (сек)
    const response = mockResponseSec(c.channel);

    cur.responseSum += response;
    cur.cnt += 1;

    map.set(key, cur);
  }

  const label = (ch: string) =>
    ch === "voice"
      ? "Звонки"
      : ch === "chat"
      ? "Чат"
      : ch === "email"
      ? "Email"
      : ch === "sms"
      ? "SMS"
      : "Push";

  return Array.from(map.entries()).map(([ch, v]) => ({
    name: label(ch),
    incoming: v.incoming,
    outgoing: Math.round(v.incoming * 0.15), // условная доля исходящих
    responseSec: v.cnt ? Math.round(v.responseSum / v.cnt) : 0,
  }));
}, [UI_DATA_SOURCE, apiChannelSplit, filteredCalls]);


  const channelResponseTrendTab = useMemo(() => {
    if (UI_DATA_SOURCE === "API") {
      const src = apiChannelResponseTrend ?? [];
      return src.map((row) => {
        if (channelTab === "all") {
          return {
            t: row.t,
            voice: row.voice ?? 0,
            chat: row.chat ?? 0,
            email: row.email ?? 0,
            sms: row.sms ?? 0,
            push: row.push ?? 0,
          };
        }

        return {
          t: row.t,
          value: row[channelTab] ?? row.value ?? 0,
        };
      });
    }

    const hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17"];
    const map = new Map<
      string,
      {
        t: string;
        voice: number;
        chat: number;
        email: number;
        sms: number;
        push: number;
        cnt: Record<string, number>;
        valueSum: number;
        valueCnt: number;
      }
    >();

    for (const h of hours) {
      const key = `${h}:00`;
      map.set(key, {
        t: key,
        voice: 0,
        chat: 0,
        email: 0,
        sms: 0,
        push: 0,
        cnt: { voice: 0, chat: 0, email: 0, sms: 0, push: 0 },
        valueSum: 0,
        valueCnt: 0,
      });
    }

    for (const c of channelTabCalls) {
      const hour = c.startedAt.split(":")[0];
      const key = `${hour}:00`;
      const cur = map.get(key);
      if (!cur) continue;

      const response = c.durationSec > 0 ? c.durationSec : 0;

      if (channelTab === "all") {
        cur[c.channel] += response;
        cur.cnt[c.channel] += 1;
      } else {
        cur.valueSum += response;
        cur.valueCnt += 1;
      }
    }

    return hours.map((h) => {
      const key = `${h}:00`;
      const cur = map.get(key)!;
      if (channelTab === "all") {
        return {
          t: cur.t,
          voice: cur.cnt.voice ? Math.round(cur.voice / cur.cnt.voice) : 0,
          chat: cur.cnt.chat ? Math.round(cur.chat / cur.cnt.chat) : 0,
          email: cur.cnt.email ? Math.round(cur.email / cur.cnt.email) : 0,
          sms: cur.cnt.sms ? Math.round(cur.sms / cur.cnt.sms) : 0,
          push: cur.cnt.push ? Math.round(cur.push / cur.cnt.push) : 0,
        };
      }
      return {
        t: cur.t,
        value: cur.valueCnt ? Math.round(cur.valueSum / cur.valueCnt) : 0,
      };
    });
  }, [UI_DATA_SOURCE, apiChannelResponseTrend, channelTabCalls, channelTab]);




  return (
    <div className="min-h-screen bg-muted/30">
      {/* Верхняя часть: шапка + навигация */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">Расширенная аналитика контакт-центра</div>
              <div className="text-xs text-muted-foreground">Отчётность по операторам, очередям, каналам и тематикам обращений</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Обновить
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Экспорт
            </Button>
            <Button variant="outline" asChild>
              <Link href="/swagger">Swagger</Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Настройки">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Фильтры */}
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
            <div className="md:col-span-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Период" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Сегодня</SelectItem>
                  <SelectItem value="yesterday">Вчера</SelectItem>
                  <SelectItem value="7d">Последние 7 дней</SelectItem>
                  <SelectItem value="30d">Последние 30 дней</SelectItem>
                  <SelectItem value="custom">Произвольный</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Отдел" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Все отделы">Все отделы</SelectItem>
                  {departmentOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Канал" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все каналы</SelectItem>
                  {channelOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select value={selectedQueue} onValueChange={setSelectedQueue}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Очередь" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все очереди</SelectItem>
                  {queueSelectOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск: оператор, тема, ID"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="md:col-span-12">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  Фильтры
                </Badge>
                <Badge variant="outline">Период: {period === "today" ? "Сегодня" : period === "yesterday" ? "Вчера" : period === "7d" ? "7 дней" : period === "30d" ? "30 дней" : "Произвольный"}</Badge>
                <Badge variant="outline">Отдел: {dept}</Badge>
                <Badge variant="outline">Канал: {channel === "all" ? "Все" : channel}</Badge>
                <Badge variant="outline">Очередь: {selectedQueueLabel}</Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Центральная часть: KPI + графики + таблицы */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-12">
        {/* KPI */}
        <section className="lg:col-span-12">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {kpiCards.map((k) => {
              const Icon = k.icon;
              const isPositive = k.delta >= 0;
              return (
                <Card key={k.title} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">{k.title}</div>
                        <div className="mt-1 text-2xl font-semibold tracking-tight">{k.value}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{k.note}</div>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <Badge variant={isPositive ? "default" : "secondary"} className="rounded-xl">
                        {kpiDelta(k.delta)}
                      </Badge>
                      <span className="text-muted-foreground">к предыдущему периоду</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Вкладки */}
        <section className="lg:col-span-12">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                <TabsTrigger value="operators">Операторы</TabsTrigger>
                <TabsTrigger value="queues">Очереди</TabsTrigger>
                <TabsTrigger value="channels">Каналы</TabsTrigger>
                <TabsTrigger value="topics">Тематики</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2">
                  <ListChecks className="h-4 w-4" />
                  Настроить отчёты
                </Button>
                <Button className="gap-2">
                  <Bell className="h-4 w-4" />
                  Алерты
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Лево: графики */}
              <div className="lg:col-span-8 space-y-4">
                <TabsContent value="overview" className="m-0 space-y-4">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Динамика обращений и пропусков</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="t" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="incoming"
                            name="Входящие"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="missed"
                            name="Пропущенные"
                            stroke="#EF4444"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Нагрузка операторов</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={operatorLoad} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" name="Сотрудники" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">На линии: {operatorLoad[0]?.value ?? 0}</Badge>
                          <Badge variant="outline">Ожидают: {operatorLoad[1]?.value ?? 0}</Badge>
                          <Badge variant="outline">Не доступен: {operatorLoad[2]?.value ?? 0}</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Распределение по каналам</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip />
                            <Legend />
                            <Pie data={channelSplit} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                              {channelSplit.map((_, idx) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

  <Card className="rounded-2xl">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Эмоциональный фон</CardTitle>
    </CardHeader>
    <CardContent className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Legend />
            <Pie
            data={sentimentSplitView}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {sentimentSplitView.map((entry) => (
  <Cell
    key={entry.name}
    fill={SENTIMENT_COLORS[entry.name] || "#9ca3af"}
  />
))}

          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>

  <Card className="rounded-2xl">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Достижение цели</CardTitle>
    </CardHeader>
    <CardContent className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie
            data={goalSplit}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {goalSplit.map((entry) => {
  const key = entry.name.trim();
  return (
    <Cell
      key={key}
      fill={GOAL_COLORS[key] || "#9ca3af"}
    />
  );
})}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
</div>
 
                </TabsContent>

                <TabsContent value="operators" className="m-0 space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Нагрузка по операторам</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={operatorStats} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={55} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="handled" name="Обработано" radius={[10, 10, 0, 0]} />
                            <Bar dataKey="missed" name="Пропущено" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>



                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Качество: AHT и FCR</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={operatorStats} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={55} />
                            <YAxis yAxisId="left" allowDecimals={false} />
                            <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="ahtMin" name="AHT (мин)" radius={[10, 10, 0, 0]} />
                            <Bar yAxisId="right" dataKey="fcr" name="FCR (%)" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">Динамика AHT и скорости ответа (ASA)</CardTitle>
                        <div className="w-full md:w-[220px]">
                          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Оператор" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Все операторы</SelectItem>
                              {operatorOptions.map((operator) => (
                                <SelectItem key={operator.value} value={operator.value}>
                                  {operator.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      {operatorAhtTrend.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={operatorAhtTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="t" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="aht" name="AHT (сек)" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="asa" name="ASA (сек)" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-2xl border bg-background text-sm text-muted-foreground">
                          Ничего не найдено по заданным фильтрам.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="queues" className="m-0 space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Очереди: SLA и ожидание</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px]">
                        {queueStats.length ? (
                          <>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={queueStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis yAxisId="left" allowDecimals={false} />
                                <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar yAxisId="left" dataKey="slaPct" name="SLA (%)" radius={[10, 10, 0, 0]} />
                                <Bar yAxisId="right" dataKey="avgWaitSec" name="Среднее ожидание (сек)" radius={[10, 10, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {queueStats.map((q) => (
                                <Badge key={q.name} variant="outline">
                                  {q.name}: всего {q.total}, в очереди {q.waiting}
                                </Badge>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border bg-background text-sm text-muted-foreground">
                            Нет данных по очередям для выбранных фильтров.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Потери: доля пропущенных</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px]">
                        {queueStats.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={queueStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="abandonedPct" name="Пропущенные (%)" radius={[10, 10, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border bg-background text-sm text-muted-foreground">
                            Нет данных по потерям в очередях.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <CardTitle className="text-base">Динамика длины очередей</CardTitle>
                          <div className="text-xs text-muted-foreground">
                            Фильтр: {queueDepthQueueLabel}
                          </div>
                        </div>
                        <div className="w-full md:w-[220px]">
                          <Select value={queueDepthQueue} onValueChange={setQueueDepthQueue}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Очередь" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Все</SelectItem>
                              {queueSelectOptions.map((queueOption) => (
                                <SelectItem key={queueOption.value} value={queueOption.value}>
                                  {queueOption.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      {queueDepthTrend.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={queueDepthTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="t" tickFormatter={(value) => String(value)} />
                            <YAxis allowDecimals={false} />
                            <Tooltip labelFormatter={(label) => String(label)} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="queueDepth"
                              name={queueDepthQueueLabel}
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-2xl border bg-background text-sm text-muted-foreground">
                          Нет данных по динамике длины очередей.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="channels" className="m-0 space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Объём: входящие и исходящие</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={channelVolumes} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="incoming" name="Входящие" radius={[10, 10, 0, 0]} />
                            <Bar dataKey="outgoing" name="Исходящие" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Скорость реакции по каналам</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={channelVolumes} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="responseSec" name="Время ответа (сек)" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">Динамика времени ответа (сек)</CardTitle>
                        <div className="w-full md:w-[220px]">
                          <Select
                            value={channelTab}
                            onValueChange={(value) => setChannelTab(value as Channel)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Канал" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CHANNEL_TAB_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={channelResponseTrendTab} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="t" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {channelTab === "all" ? (
                            <>
                              <Line
                                type="monotone"
                                dataKey="voice"
                                name="Звонки"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="chat"
                                name="Чат"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="email"
                                name="Email"
                                stroke="#f97316"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="sms"
                                name="SMS"
                                stroke="#a855f7"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="push"
                                name="Push"
                                stroke="#0ea5e9"
                                strokeWidth={2}
                                dot={false}
                              />
                            </>
                          ) : (
                            <Line
                              type="monotone"
                              dataKey="value"
                              name={CHANNEL_TAB_LABELS[channelTab]}
                              strokeWidth={2}
                              dot={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

              <TabsContent value="topics" className="m-0 space-y-4">
  <Card className="rounded-2xl">
    <CardHeader className="pb-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-base">Количество обращений по выбранной теме</CardTitle>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <div className="w-full md:w-[220px]">
            <Select
              value={topicDirection}
              onValueChange={(value) => setTopicDirection(value as TopicDirection)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Тип обращения" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="in">Входящие</SelectItem>
                <SelectItem value="out">Исходящие</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-[320px]">
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Тема" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все темы</SelectItem>
                {topicOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </CardHeader>

    <CardContent className="h-[320px]">
      {apiTopicsTsLoading ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Загрузка…
        </div>
      ) : apiTopicsTsError ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Не удалось загрузить данные
        </div>
      ) : isApiTopicsTsEmpty ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Нет данных за выбранный период / фильтры
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={topicTimeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="solved"
              name="Решенные"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="unsolved"
              name="Не решенные"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Спидометр ср. Продолж.</CardTitle>
      </CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={topicAhtGauge.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={88}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              <Cell fill="#111827" />
              <Cell fill="#e5e7eb" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 text-center text-sm text-muted-foreground">
          AHT: {formatSec(topicAhtGauge.ahtSec)}
        </div>
      </CardContent>
    </Card>

    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Распределение по каналам</CardTitle>
      </CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={topicChannelSplit}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={88}
              stroke="none"
            >
              {topicChannelSplit.map((entry, idx) => (
                <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Эмоциональный фон</CardTitle>
      </CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={topicSentimentSplit}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={88}
              stroke="none"
            >
              {topicSentimentSplit.map((entry, idx) => (
                <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Достижение цели</CardTitle>
      </CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={topicGoalSplit}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={88}
              stroke="none"
            >
              {topicGoalSplit.map((entry, idx) => (
                <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  </div>
</TabsContent>

              </div>
              
              {/* Право: таблица + быстрые метрики */}
              <aside className="lg:col-span-4 space-y-4">
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Срез по тематикам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {themesView.map((t) => (
                        <div key={t.name} className="rounded-2xl border bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{t.name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                AHT: {formatSec(t.avgHandleSec)} · FCR: {t.fcrPct}%
                              </div>
                            </div>
                            <Badge variant="secondary" className="rounded-xl">
                              {t.count}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>


                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Последние коммуникации</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {latestCalls.map((r) => (
                        <div key={r.id} className="rounded-2xl border bg-background p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{r.id}</div>
                            <Badge variant={r.status === "Пропущен" ? "secondary" : "outline"} className="rounded-xl">
                              {r.status}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {r.startedAt} · {r.channel.toUpperCase()} · {r.queue.toUpperCase()}
                          </div>
                          <Separator className="my-2" />
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm">{r.topic}</div>
                              <div className="mt-1 text-xs text-muted-foreground">Оператор: {r.operator}</div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {r.durationSec ? `Длительность: ${formatSec(r.durationSec)}` : "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                      {!latestCalls.length && (
                        <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
                          Ничего не найдено по заданным фильтрам.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </Tabs>
        </section>

        {/* Нижняя часть: действия */}
        <section className="lg:col-span-12">
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium">Действия</div>
                <div className="text-xs text-muted-foreground">
                  Настройте отчёты под заказчика: очереди, каналы, тематики и длительность разговоров — без Excel.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Конструктор отчётов
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Экспорт (API)
                </Button>
                <Button className="gap-2">
                  <Filter className="h-4 w-4" />
                  Сохранить набор фильтров
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 text-xs text-muted-foreground">
            Примечание (учебный мокап): данные демонстрационные. В боевой системе источники — FreeSwitch (очереди), CRM/учётные системы (клиенты),
            хранилище коммуникаций и аналитика по тематикам.
          </div>
        </section>
      </main>
    </div>
  );
}
