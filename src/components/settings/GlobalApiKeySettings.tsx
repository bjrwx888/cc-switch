import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";

interface GlobalApiKeySettingsProps {
  value: string;
  onChange: (value: string) => void;
  isProxyTakeover?: boolean;
}

interface GlobalApiConfig {
  api_key: string;
  external_ip?: string | null;
}

export function GlobalApiKeySettings({
  value,
  onChange,
  isProxyTakeover = false,
}: GlobalApiKeySettingsProps) {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(value || "");
  const [externalIp, setExternalIp] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await invoke<GlobalApiConfig>("load_global_api_config");
        if (config.api_key) {
          setApiKey(config.api_key);
          onChange(config.api_key);
        }
        if (config.external_ip) {
          setExternalIp(config.external_ip);
        }
      } catch (error) {
        console.error("Failed to load global API config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      // Save to config file
      await invoke("save_global_api_config", {
        apiKey: apiKey,
        externalIp: externalIp || null,
      });

      // Update parent component state
      onChange(apiKey);

      toast.success(
        t(
          "settings.globalApiKeySaved",
          "全局 API KEY 已保存到 Claude、Codex 和 Gemini 配置文件，并设置到系统环境变量 ANTHROPIC_AUTH_TOKEN"
        )
      );
    } catch (error) {
      console.error("Failed to save global API config:", error);
      toast.error(t("settings.globalApiKeySaveFailed", "保存失败，请重试"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="space-y-3">
        <header className="space-y-1">
          <h3 className="text-sm font-medium">
            {t("settings.globalApiKey", "全局 API KEY")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(
              "settings.globalApiKeyHint",
              "配置统一的 API KEY，可供所有 AI 工具使用"
            )}
          </p>
        </header>
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">
          {t("settings.globalApiKey", "全局 API KEY")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "settings.globalApiKeyHint",
            "配置统一的 API KEY，可供所有 AI 工具使用"
          )}
        </p>
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Input
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t(
              "settings.globalApiKeyPlaceholder",
              "输入您的 API KEY..."
            )}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div>
          <Input
            type="text"
            value={externalIp}
            onChange={(e) => setExternalIp(e.target.value)}
            placeholder={t(
              "settings.externalIpPlaceholder",
              "输入对外 IP 地址（可选）..."
            )}
          />
        </div>

        <Button
          onClick={handleConfirm}
          disabled={isSaving || !apiKey}
          className={cn(
            "w-full",
            isProxyTakeover
              ? "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          )}
          size="sm"
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t("common.saving", "保存中...")}
            </span>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {t("common.confirm", "确定")}
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
