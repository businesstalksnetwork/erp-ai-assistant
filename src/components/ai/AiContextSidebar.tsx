import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Bot, Send, Loader2, Sparkles, ChevronRight, ChevronLeft, MessageSquare } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAiStream } from "@/hooks/useAiStream";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

function getModuleFromPath(path: string): string | undefined {
  const segments = path.split("/").filter(Boolean);
  const moduleMap: Record<string, string> = {
    dashboard: "dashboard",
    analytics: "analytics",
    accounting: "accounting",
    inventory: "inventory",
    crm: "crm",
    sales: "sales",
    purchasing: "purchasing",
    hr: "hr",
    production: "production",
    pos: "pos",
    documents: "documents",
    settings: "settings",
  };
  return moduleMap[segments[0]] || segments[0];
}

function getNarrativeContext(path: string): string | null {
  const contextMap: Record<string, string> = {
    "/analytics/working-capital": "working_capital",
    "/analytics/ratios": "ratios",
    "/analytics/profitability": "profitability",
    "/analytics/margin-bridge": "margin_bridge",
    "/analytics/customer-risk": "customer_risk",
    "/analytics/supplier-risk": "supplier_risk",
    "/analytics/vat-trap": "vat_trap",
    "/analytics/early-warning": "early_warning",
    "/analytics/inventory-health": "inventory_health",
    "/analytics/payroll-benchmark": "payroll_benchmark",
    "/analytics/cashflow-forecast": "cashflow",
    "/analytics/budget": "budget",
    "/analytics/break-even": "breakeven",
    "/dashboard": "dashboard",
  };
  for (const [prefix, ctx] of Object.entries(contextMap)) {
    if (path.startsWith(prefix)) return ctx;
  }
  return null;
}

interface AiContextSidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function AiContextSidebar({ open, onToggle }: AiContextSidebarProps) {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const location = useLocation();
  const { messages, isLoading, send, clear } = useAiStream({ tenantId, locale });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sr = locale === "sr";

  const module = getModuleFromPath(location.pathname);
  const narrativeCtx = getNarrativeContext(location.pathname);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Collapsed rail
  if (!open) {
    return (
      <TooltipProvider>
        <aside className="w-10 border-l bg-card/50 backdrop-blur-sm flex flex-col items-center py-3 gap-3 h-full shrink-0 print:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
                <Sparkles className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{sr ? "Otvori AI Copilot" : "Open AI Copilot"}</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-[10px] font-bold text-muted-foreground tracking-widest [writing-mode:vertical-lr] rotate-180 select-none">
            AI
          </span>
        </aside>
      </TooltipProvider>
    );
  }

  // Expanded panel
  return (
    <aside className="w-[280px] xl:w-[300px] border-l bg-card/50 backdrop-blur-sm flex flex-col h-full shrink-0 print:hidden overflow-hidden">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>AI Copilot</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {/* Module Insights */}
          {tenantId && module && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider group">
                <span>{sr ? "Uvidi" : "Insights"}</span>
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <AiModuleInsights tenantId={tenantId} module={module} compact />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* AI Narrative */}
          {tenantId && narrativeCtx && (
            <>
              <Separator />
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider group">
                  <span>{sr ? "AI Analiza" : "AI Analysis"}</span>
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <AiAnalyticsNarrative
                    tenantId={tenantId}
                    contextType={narrativeCtx as any}
                    data={{}}
                  />
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          {/* Quick Ask Chat */}
          <Separator />
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider group">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                {sr ? "Brzi upit" : "Quick Ask"}
              </span>
              <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-2">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    {sr ? "Pitajte o vašim podacima..." : "Ask about your data..."}
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[90%] rounded-md px-2 py-1.5 text-xs whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                    <div className="bg-muted rounded-md px-2 py-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  </div>
                )}
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 w-full" onClick={clear}>
                    {sr ? "Obriši razgovor" : "Clear chat"}
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Chat Input */}
      <div className="border-t p-2 flex gap-1.5 shrink-0">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sr ? "Pitajte AI..." : "Ask AI..."}
          className="min-h-[32px] max-h-[80px] resize-none text-xs"
          rows={1}
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!input.trim() || isLoading}>
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </div>
    </aside>
  );
}
