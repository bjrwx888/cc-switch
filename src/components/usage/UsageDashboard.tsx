import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsageSummaryCards } from "./UsageSummaryCards";
import { UsageTrendChart } from "./UsageTrendChart";
import { RequestLogTable } from "./RequestLogTable";
import { ProviderStatsTable } from "./ProviderStatsTable";
import { ModelStatsTable } from "./ModelStatsTable";
import type { TimeRange } from "@/types/usage";
import { motion } from "framer-motion";
import { BarChart3, ListFilter, Activity, Radio, AlertCircle, RefreshCw } from "lucide-react";
import { useProxyStatus } from "@/hooks/useProxyStatus";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { usageKeys } from "@/lib/query/usage";

export function UsageDashboard() {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
  const { isRunning, isTakeoverActive, status } = useProxyStatus();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const days = timeRange === "1d" ? 1 : timeRange === "7d" ? 7 : 30;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 计算当前时间范围的起止时间
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - days * 24 * 60 * 60;

      // 强制刷新当前时间范围的数据（使用 refetchQueries 忽略 staleTime）
      await Promise.all([
        // 刷新摘要卡片数据
        queryClient.refetchQueries({ queryKey: usageKeys.summary(startDate, endDate) }),
        // 刷新趋势图数据
        queryClient.refetchQueries({ queryKey: usageKeys.trends(days) }),
        // 刷新 Provider 统计
        queryClient.refetchQueries({ queryKey: usageKeys.providerStats() }),
        // 刷新模型统计
        queryClient.refetchQueries({ queryKey: usageKeys.modelStats() }),
      ]);
    } finally {
      // 添加一个小延迟以显示刷新动画
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const isMonitoring = isRunning && !isTakeoverActive;
  const isActive = isRunning && isTakeoverActive;

  const getProxyStatusText = () => {
    if (isActive) {
      return `代理接管模式运行中 - ${status?.address}:${status?.port}`;
    }
    if (isMonitoring) {
      return `代理监控模式运行中 - ${status?.address}:${status?.port}`;
    }
    return "代理未运行";
  };

  const getProxyStatusColor = () => {
    if (isActive) return "emerald";
    if (isMonitoring) return "blue";
    return "muted";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 pb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold">{t("usage.title", "使用统计")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("usage.subtitle", "查看 AI 模型的使用情况和成本统计")}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 w-9 shrink-0"
            title="刷新数据"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>

        <Tabs
          value={timeRange}
          onValueChange={(v) => setTimeRange(v as TimeRange)}
          className="w-full sm:w-auto"
        >
          <TabsList className="flex w-full sm:w-auto bg-card/60 border border-border/50 backdrop-blur-sm shadow-sm h-10 p-1">
            <TabsTrigger
              value="1d"
              className="flex-1 sm:flex-none sm:px-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:text-primary transition-colors"
            >
              {t("usage.today", "24小时")}
            </TabsTrigger>
            <TabsTrigger
              value="7d"
              className="flex-1 sm:flex-none sm:px-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:text-primary transition-colors"
            >
              {t("usage.last7days", "7天")}
            </TabsTrigger>
            <TabsTrigger
              value="30d"
              className="flex-1 sm:flex-none sm:px-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:text-primary transition-colors"
            >
              {t("usage.last30days", "30天")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Proxy 状态提示 */}
      <Alert
        className={cn(
          "border",
          isActive && "border-emerald-500/30 bg-emerald-500/5",
          isMonitoring && "border-blue-500/30 bg-blue-500/5",
          !isRunning && "border-amber-500/30 bg-amber-500/5",
        )}
      >
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Radio
              className={cn(
                "h-4 w-4 animate-pulse",
                isActive && "text-emerald-500",
                isMonitoring && "text-blue-500",
              )}
            />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <AlertTitle className="mb-0">
            {isRunning ? "代理服务运行中" : "代理服务未运行"}
          </AlertTitle>
        </div>
        <AlertDescription className="mt-2">
          {isRunning ? (
            <>
              {getProxyStatusText()}
              {isMonitoring && (
                <div className="mt-1 text-xs">
                  请确保各应用的 API 地址已配置为代理地址以记录统计数据
                </div>
              )}
            </>
          ) : (
            <>
              当前没有记录使用统计数据。请在主界面开启代理模式以开始记录。
              <div className="mt-1 text-xs">
                提示：监控模式需要手动配置 API 地址，接管模式自动配置无需手动操作
              </div>
            </>
          )}
        </AlertDescription>
      </Alert>

      <UsageSummaryCards days={days} />

      <UsageTrendChart days={days} />

      <div className="space-y-4">
        <Tabs defaultValue="logs" className="w-full" isProxyTakeover={isActive}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="logs" className="gap-2">
                <ListFilter className="h-4 w-4" />
                {t("usage.requestLogs", "请求日志")}
              </TabsTrigger>
              <TabsTrigger value="providers" className="gap-2">
                <Activity className="h-4 w-4" />
                {t("usage.providerStats", "Provider 统计")}
              </TabsTrigger>
              <TabsTrigger value="models" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("usage.modelStats", "模型统计")}
              </TabsTrigger>
            </TabsList>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <TabsContent value="logs" className="mt-0">
              <RequestLogTable />
            </TabsContent>

            <TabsContent value="providers" className="mt-0">
              <ProviderStatsTable />
            </TabsContent>

            <TabsContent value="models" className="mt-0">
              <ModelStatsTable />
            </TabsContent>
          </motion.div>
        </Tabs>
      </div>
    </motion.div>
  );
}
