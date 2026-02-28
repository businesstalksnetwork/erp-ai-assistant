import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallbackUI({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold text-foreground">{t("somethingWentWrong")}</h2>
      <p className="text-muted-foreground text-sm text-center max-w-md">
        {error?.message || t("unexpectedError")}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onRetry}>
          {t("tryAgain")}
        </Button>
        <Button onClick={() => window.location.assign("/dashboard")}>
          {t("dashboard")}
        </Button>
      </div>
    </div>
  );
}

async function logFrontendError(error: Error, errorInfo: React.ErrorInfo) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();
    if (!membership) return;
    await supabase.from("audit_log").insert({
      tenant_id: membership.tenant_id,
      user_id: user.id,
      action: "frontend_error",
      entity_type: "ui",
      entity_id: null,
      details: {
        message: error.message,
        stack: error.stack?.slice(0, 2000),
        componentStack: errorInfo.componentStack?.slice(0, 2000),
        url: window.location.href,
      },
    });
  } catch {
    // Silent — no user impact
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    logFrontendError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorFallbackUI
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}
