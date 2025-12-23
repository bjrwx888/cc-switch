import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type LanguageOption = "zh" | "en" | "ja";

interface LanguageSettingsProps {
  value: LanguageOption;
  onChange: (value: LanguageOption) => void;
  isProxyTakeover?: boolean;
}

export function LanguageSettings({ value, onChange, isProxyTakeover = false }: LanguageSettingsProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-2">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">{t("settings.language")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.languageHint")}
        </p>
      </header>
      <div className="inline-flex gap-1 rounded-md border border-border-default bg-background p-1">
        <LanguageButton active={value === "zh"} onClick={() => onChange("zh")} isProxyTakeover={isProxyTakeover}>
          {t("settings.languageOptionChinese")}
        </LanguageButton>
        <LanguageButton active={value === "en"} onClick={() => onChange("en")} isProxyTakeover={isProxyTakeover}>
          {t("settings.languageOptionEnglish")}
        </LanguageButton>
        <LanguageButton active={value === "ja"} onClick={() => onChange("ja")} isProxyTakeover={isProxyTakeover}>
          {t("settings.languageOptionJapanese")}
        </LanguageButton>
      </div>
    </section>
  );
}

interface LanguageButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  isProxyTakeover?: boolean;
}

function LanguageButton({ active, onClick, children, isProxyTakeover = false }: LanguageButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      size="sm"
      variant={active ? "default" : "ghost"}
      className={cn(
        "min-w-[96px]",
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
      {children}
    </Button>
  );
}
