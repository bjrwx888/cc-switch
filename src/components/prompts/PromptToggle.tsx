import React from "react";
import { cn } from "@/lib/utils";
import { useProxyStatus } from "@/hooks/useProxyStatus";

interface PromptToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Toggle 开关组件（提示词专用）
 * 根据代理状态自动切换颜色
 */
const PromptToggle: React.FC<PromptToggleProps> = ({
  enabled,
  onChange,
  disabled = false,
}) => {
  const { isRunning, isTakeoverActive } = useProxyStatus();
  const isProxyTakeover = isRunning && isTakeoverActive;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2",
        enabled
          ? isProxyTakeover
            ? "bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-500/20"
            : "bg-blue-500 dark:bg-blue-600 focus:ring-blue-500/20"
          : "bg-gray-300 dark:bg-gray-600",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          enabled ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
};

export default PromptToggle;
