import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "date-fns";
import { srLatn } from "date-fns/locale";
import { Sparkles } from "lucide-react";

export function WelcomeHeader() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const name = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const today = format(new Date(), "EEEE, d MMMM yyyy", { locale: locale === "sr" ? srLatn : undefined });

  const hour = new Date().getHours();
  const greeting = locale === "sr"
    ? hour < 12 ? "Dobro jutro" : hour < 18 ? "Dobar dan" : "Dobro veče"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {name}
          <Sparkles className="inline-block ml-2 h-5 w-5 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{today}</p>
      </div>
    </div>
  );
}
