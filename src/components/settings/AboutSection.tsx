import { useCallback, useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getVersion } from "@tauri-apps/api/app";
import { settingsApi } from "@/lib/api";
import { useUpdate } from "@/contexts/UpdateContext";
import { relaunchApp } from "@/lib/updater";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AboutSectionProps {
  isPortable: boolean;
  isProxyTakeover?: boolean;
}

interface ToolVersion {
  name: string;
  version: string | null;
  latest_version: string | null;
  path: string | null;
  error: string | null;
}

export function AboutSection({ isPortable, isProxyTakeover = false }: AboutSectionProps) {
  // ... (use hooks as before) ...
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toolVersions, setToolVersions] = useState<ToolVersion[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(true);

  const {
    hasUpdate,
    updateInfo,
    updateHandle,
    checkUpdate,
    resetDismiss,
    isChecking,
  } = useUpdate();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [appVersion, tools] = await Promise.all([
          getVersion(),
          settingsApi.getToolVersions(),
        ]);

        if (active) {
          setVersion(appVersion);
          setToolVersions(tools);
        }
      } catch (error) {
        console.error("[AboutSection] Failed to load info", error);
        if (active) {
          setVersion(null);
        }
      } finally {
        if (active) {
          setIsLoadingVersion(false);
          setIsLoadingTools(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  // ... (handlers like handleOpenReleaseNotes, handleCheckUpdate) ...

  const handleOpenReleaseNotes = useCallback(async () => {
    try {
      const targetVersion = updateInfo?.availableVersion ?? version ?? "";
      const displayVersion = targetVersion.startsWith("v")
        ? targetVersion
        : targetVersion
          ? `v${targetVersion}`
          : "";

      if (!displayVersion) {
        await settingsApi.openExternal(
          "https://github.com/bjrwx888/cc-switch/releases",
        );
        return;
      }

      await settingsApi.openExternal(
        `https://github.com/bjrwx888/cc-switch/releases/tag/${displayVersion}`,
      );
    } catch (error) {
      console.error("[AboutSection] Failed to open release notes", error);
      toast.error(t("settings.openReleaseNotesFailed"));
    }
  }, [t, updateInfo?.availableVersion, version]);

  const handleCheckUpdate = useCallback(async () => {
    if (hasUpdate && updateHandle) {
      if (isPortable) {
        try {
          await settingsApi.checkUpdates();
        } catch (error) {
          console.error("[AboutSection] Portable update failed", error);
        }
        return;
      }

      setIsDownloading(true);
      try {
        resetDismiss();
        await updateHandle.downloadAndInstall();
        await relaunchApp();
      } catch (error) {
        console.error("[AboutSection] Update failed", error);
        toast.error(t("settings.updateFailed"));
        try {
          await settingsApi.checkUpdates();
        } catch (fallbackError) {
          console.error(
            "[AboutSection] Failed to open fallback updater",
            fallbackError,
          );
        }
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    try {
      const available = await checkUpdate();
      if (!available) {
        toast.success(t("settings.upToDate"));
      }
    } catch (error) {
      console.error("[AboutSection] Check update failed", error);
      toast.error(t("settings.checkUpdateFailed"));
    }
  }, [checkUpdate, hasUpdate, isPortable, resetDismiss, t, updateHandle]);

  const displayVersion = version ?? t("common.unknown");

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">{t("common.about")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.aboutHint")}
        </p>
      </header>

      <div className="p-6 space-y-6 border rounded-xl border-border bg-card/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-foreground">CC Switch</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <span className="text-muted-foreground">
                  {t("common.version")}
                </span>
                {isLoadingVersion ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="font-medium">{`v${displayVersion}`}</span>
                )}
              </Badge>
              {isPortable && (
                <Badge variant="secondary" className="gap-1.5">
                  <Info className="w-3 h-3" />
                  {t("settings.portableMode")}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenReleaseNotes}
              className="h-9"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {t("settings.releaseNotes")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCheckUpdate}
              disabled={isChecking || isDownloading}
              className={cn(
                "min-w-[140px] h-9",
                isProxyTakeover
                  ? "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {isDownloading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("settings.updating")}
                </span>
              ) : hasUpdate ? (
                <span className="inline-flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  {t("settings.updateTo", {
                    version: updateInfo?.availableVersion ?? "",
                  })}
                </span>
              ) : isChecking ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t("settings.checking")}
                </span>
              ) : (
                t("settings.checkForUpdates")
              )}
            </Button>
          </div>
        </div>

        {hasUpdate && updateInfo && (
          <div className="px-4 py-3 text-sm border rounded-lg bg-primary/10 border-primary/20">
            <p className="mb-1 font-medium text-primary">
              {t("settings.updateAvailable", {
                version: updateInfo.availableVersion,
              })}
            </p>
            {updateInfo.notes && (
              <p className="leading-relaxed text-muted-foreground line-clamp-3">
                {updateInfo.notes}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="px-1 text-sm font-medium text-muted-foreground">
          本地环境检查
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          {isLoadingTools
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 border rounded-xl border-border bg-card/50 animate-pulse"
                />
              ))
            : toolVersions.map((tool) => (
                <div
                  key={tool.name}
                  className="flex flex-col gap-2 p-4 transition-colors border rounded-xl border-border bg-card/50 hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">
                        {tool.name}
                      </span>
                    </div>
                    {tool.version ? (
                      <div className="flex items-center gap-1.5">
                        {tool.latest_version &&
                          tool.version !== tool.latest_version && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
                              Update: {tool.latest_version}
                            </span>
                          )}
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div
                      className="font-mono text-xs truncate"
                      title={tool.version || tool.error || "Unknown"}
                    >
                      {tool.version ? tool.version : tool.error || "未安装"}
                    </div>
                    {tool.path && (
                      <div
                        className="text-[10px] text-muted-foreground font-mono truncate"
                        title={tool.path}
                      >
                        {tool.path}
                      </div>
                    )}
                  </div>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
