import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "date-fns";
import { srLatn } from "date-fns/locale";

export function WelcomeHeader() {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const name = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const today = format(new Date(), "EEEE, d MMMM yyyy", { locale: locale === "sr" ? srLatn : undefined });

  const hour = new Date().getHours();
  const greeting = locale === "sr"
    ? hour < 12 ? "Dobro jutro" : hour < 18 ? "Dobar dan" : "Dobro veče"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">
        {greeting}, {name}
      </h1>
      <p className="text-sm text-muted-foreground capitalize">{today}</p>
    </div>
  );
}
