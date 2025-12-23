import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";

interface ThemeSettingsProps {
  isProxyTakeover?: boolean;
}

export function ThemeSettings({ isProxyTakeover = false }: ThemeSettingsProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-2">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">{t("settings.theme")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.themeHint")}
        </p>
      </header>
      <div className="inline-flex gap-1 rounded-md border border-border-default bg-background p-1">
        <ThemeButton
          active={theme === "light"}
          onClick={() => setTheme("light")}
          icon={Sun}
          isProxyTakeover={isProxyTakeover}
        >
          {t("settings.themeLight")}
        </ThemeButton>
        <ThemeButton
          active={theme === "dark"}
          onClick={() => setTheme("dark")}
          icon={Moon}
          isProxyTakeover={isProxyTakeover}
        >
          {t("settings.themeDark")}
        </ThemeButton>
        <ThemeButton
          active={theme === "system"}
          onClick={() => setTheme("system")}
          icon={Monitor}
          isProxyTakeover={isProxyTakeover}
        >
          {t("settings.themeSystem")}
        </ThemeButton>
      </div>
    </section>
  );
}

interface ThemeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  isProxyTakeover?: boolean;
}

function ThemeButton({
  active,
  onClick,
  icon: Icon,
  children,
  isProxyTakeover = false,
}: ThemeButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      size="sm"
      variant={active ? "default" : "ghost"}
      className={cn(
        "min-w-[96px] gap-1.5",
        active
          ? cn(
              "shadow-sm",
              isProxyTakeover
                ? "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            )
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Button>
  );
}
