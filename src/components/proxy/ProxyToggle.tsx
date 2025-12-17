/**
 * 代理模式切换开关组件
 *
 * 放置在主界面头部，用于一键启用/关闭代理模式
 * - 监控模式：只启动代理服务器记录统计数据，需要手动配置 API 地址和 Key
 * - 接管模式：自动接管 Live 配置，无需手动配置
 */

import { Radio, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useProxyStatus } from "@/hooks/useProxyStatus";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ProxyToggleProps {
  className?: string;
}

export function ProxyToggle({ className }: ProxyToggleProps) {
  const {
    isRunning,
    isTakeoverActive,
    startMonitoring,
    startWithTakeover,
    stopWithRestore,
    isPending,
    status,
  } = useProxyStatus();

  const [showModeMenu, setShowModeMenu] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (!checked) {
      // 关闭代理
      try {
        await stopWithRestore();
      } catch (error) {
        console.error('Failed to stop proxy:', error);
      }
    } else {
      // 开启代理时显示模式选择菜单
      setShowModeMenu(true);
    }
  };

  const handleStartMonitoring = async () => {
    setShowModeMenu(false);
    try {
      await startMonitoring();
    } catch (error) {
      console.error('Failed to start monitoring mode:', error);
    }
  };

  const handleStartTakeover = async () => {
    setShowModeMenu(false);
    try {
      await startWithTakeover();
    } catch (error) {
      console.error('Failed to start takeover mode:', error);
    }
  };

  const isActive = isRunning && isTakeoverActive;
  const isMonitoring = isRunning && !isTakeoverActive;

  const getTooltipText = () => {
    if (isActive) {
      return `代理接管模式运行中 - ${status?.address}:${status?.port}\n切换供应商为热切换`;
    }
    if (isMonitoring) {
      return `代理监控模式运行中 - ${status?.address}:${status?.port}\n仅记录统计数据`;
    }
    return "开启代理模式\n点击选择监控模式或接管模式";
  };

  const getStatusColor = () => {
    if (isActive) return "emerald"; // 接管模式 - 绿色
    if (isMonitoring) return "blue"; // 监控模式 - 蓝色
    return "muted"; // 未运行
  };

  const statusColor = getStatusColor();

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all",
          statusColor === "emerald" &&
            "bg-emerald-500/10 border border-emerald-500/30",
          statusColor === "blue" && "bg-blue-500/10 border border-blue-500/30",
          statusColor === "muted" && "bg-muted/50",
          className,
        )}
        title={getTooltipText()}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Radio
            className={cn(
              "h-4 w-4 transition-colors",
              statusColor === "emerald" &&
                "text-emerald-500 animate-pulse",
              statusColor === "blue" && "text-blue-500 animate-pulse",
              statusColor === "muted" && "text-muted-foreground",
            )}
          />
        )}

        {!isRunning ? (
          // 未运行时，点击文字可选择模式
          <DropdownMenu open={showModeMenu} onOpenChange={setShowModeMenu}>
            <DropdownMenuTrigger asChild>
              <span
                className={cn(
                  "text-sm font-medium transition-colors select-none cursor-pointer hover:opacity-80",
                  statusColor === "muted" && "text-muted-foreground",
                )}
              >
                Proxy
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>选择代理模式</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleStartMonitoring}
                className="flex flex-col items-start py-3"
              >
                <div className="font-medium text-blue-600 dark:text-blue-400">
                  监控模式
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  只启动代理服务器记录统计数据，需要手动配置各应用的 API 地址为{" "}
                  http://127.0.0.1:15721 且填写真实上游的 API Key（代理不会替换或自动切换上游）
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleStartTakeover}
                className="flex flex-col items-start py-3"
              >
                <div className="font-medium text-emerald-600 dark:text-emerald-400">
                  接管模式（推荐）
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  自动接管 Live 配置，支持热切换供应商，无需手动配置
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // 运行中时，仅显示状态文字
          <span
            className={cn(
              "text-sm font-medium transition-colors select-none",
              statusColor === "emerald" &&
                "text-emerald-600 dark:text-emerald-400",
              statusColor === "blue" && "text-blue-600 dark:text-blue-400",
            )}
          >
            Proxy{" "}
            {isMonitoring && <span className="text-xs opacity-70">(监控)</span>}
            {isActive && <span className="text-xs opacity-70">(接管)</span>}
          </span>
        )}

        <Switch
          checked={isRunning}
          onCheckedChange={handleToggle}
          disabled={isPending}
          className="ml-1"
        />
      </div>
    </div>
  );
}
