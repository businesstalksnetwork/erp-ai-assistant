import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function PageErrorFallbackUI({
  error,
  onRetry,
  onGoBack,
}: {
  error: Error | null;
  onRetry: () => void;
  onGoBack: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-lg w-full border-destructive/30">
        <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {t("somethingWentWrong")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {error?.message || t("unexpectedError")}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={onGoBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
            <Button size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("tryAgain")}
            </Button>
          </div>
        </CardContent>
      </Card>
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

class PageErrorBoundaryInner extends React.Component<
  Props & { onGoBack: () => void; renderFallback: (error: Error | null, onRetry: () => void) => React.ReactNode },
  State
> {
  constructor(props: Props & { onGoBack: () => void; renderFallback: (error: Error | null, onRetry: () => void) => React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PageErrorBoundary caught:", error, errorInfo);
    logFrontendError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.renderFallback(
        this.state.error,
        () => this.setState({ hasError: false, error: null })
      );
    }
    return this.props.children;
  }
}

export function PageErrorBoundary({ children }: Props) {
  const navigate = useNavigate();
  return (
    <PageErrorBoundaryInner
      onGoBack={() => navigate(-1)}
      renderFallback={(error, onRetry) => (
        <PageErrorFallbackUI error={error} onRetry={onRetry} onGoBack={() => navigate(-1)} />
      )}
    >
      {children}
    </PageErrorBoundaryInner>
  );
}
