import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class PageErrorBoundaryInner extends React.Component<
  Props & { onGoBack: () => void },
  State
> {
  constructor(props: Props & { onGoBack: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PageErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <Card className="max-w-lg w-full border-destructive/30">
            <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Došlo je do greške
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {this.state.error?.message ||
                    "Neočekivana greška. Pokušajte ponovo ili se vratite nazad."}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => this.props.onGoBack()}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Nazad
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    this.setState({ hasError: false, error: null })
                  }
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Pokušaj ponovo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Page-level error boundary with friendly recovery UI.
 * Wraps route pages to catch rendering errors gracefully.
 */
export function PageErrorBoundary({ children }: Props) {
  const navigate = useNavigate();
  return (
    <PageErrorBoundaryInner onGoBack={() => navigate(-1)}>
      {children}
    </PageErrorBoundaryInner>
  );
}
