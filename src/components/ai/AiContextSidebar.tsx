import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Bot, Send, Loader2, Sparkles, ChevronRight, MessageSquare, Plus, History, Pin, Search, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAiStream } from "@/hooks/useAiStream";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { SimpleMarkdown } from "@/components/ai/SimpleMarkdown";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

function getModuleFromPath(path: string): string | undefined {
  const segments = path.split("/").filter(Boolean);
  const moduleMap: Record<string, string> = {
    dashboard: "dashboard", analytics: "analytics", accounting: "accounting",
    inventory: "inventory", crm: "crm", sales: "sales", purchasing: "purchasing",
    hr: "hr", production: "production", pos: "pos", documents: "documents", settings: "settings",
  };
  return moduleMap[segments[0]] || segments[0];
}

type SuggestedQ = { sr: string; en: string };

const SUGGESTED_QUESTIONS: { prefix: string; questions: SuggestedQ[] }[] = [
  { prefix: "/analytics/ratios", questions: [
    { sr: "Koji su mi najslabiji finansijski pokazatelji?", en: "Which ratios need attention?" },
    { sr: "Kako da poboljšam likvidnost?", en: "How can I improve liquidity?" },
  ]},
  { prefix: "/analytics/cashflow-forecast", questions: [
    { sr: "Da li ću imati problema sa likvidnošću?", en: "Will I face cash shortfalls?" },
  ]},
  { prefix: "/analytics/budget", questions: [
    { sr: "Gde najviše prekoračujem budžet?", en: "Where am I most over budget?" },
  ]},
  { prefix: "/analytics/profitability", questions: [
    { sr: "Koji kupci donose najviše profita?", en: "Which customers are most profitable?" },
  ]},
  { prefix: "/analytics", questions: [
    { sr: "Sumiraj ključne analitičke pokazatelje", en: "Summarize key analytics metrics" },
  ]},
  { prefix: "/crm/opportunities", questions: [
    { sr: "Koje prilike su najbliže zatvaranju?", en: "Which deals are closest to closing?" },
  ]},
  { prefix: "/crm", questions: [
    { sr: "Koji lidovi su najbliži konverziji?", en: "Which leads are closest to conversion?" },
  ]},
  { prefix: "/sales", questions: [
    { sr: "Koji su top kupci ovog meseca?", en: "Who are top customers this month?" },
  ]},
  { prefix: "/accounting/invoices", questions: [
    { sr: "Koliko faktura je neplaćeno?", en: "How many invoices are unpaid?" },
  ]},
  { prefix: "/accounting", questions: [
    { sr: "Ima li neusklađenih stavki?", en: "Are there unreconciled items?" },
  ]},
  { prefix: "/inventory", questions: [
    { sr: "Da li imam kritično niske zalihe?", en: "Do I have critically low stock?" },
  ]},
  { prefix: "/hr/payroll", questions: [
    { sr: "Kakav je ukupan trošak plata?", en: "What's the total payroll cost?" },
  ]},
  { prefix: "/hr", questions: [
    { sr: "Kakav je trend troškova plata?", en: "What's the payroll cost trend?" },
  ]},
  { prefix: "/production", questions: [
    { sr: "Gde su uska grla u proizvodnji?", en: "Where are production bottlenecks?" },
  ]},
  { prefix: "/dashboard", questions: [
    { sr: "Koji su danas najvažniji trendovi?", en: "What are today's key trends?" },
    { sr: "Ima li anomalija u podacima?", en: "Any anomalies in the data?" },
    { sr: "Prognoza novčanog toka", en: "Cash flow forecast" },
  ]},
];

const FALLBACK_QUESTIONS: SuggestedQ[] = [
  { sr: "Sumiraj trenutno stanje", en: "Summarize current status" },
  { sr: "Ima li nešto što zahteva pažnju?", en: "Anything that needs attention?" },
  { sr: "Pronađi anomalije", en: "Detect anomalies" },
];

function getSuggestedQuestions(path: string, sr: boolean): string[] {
  const match = SUGGESTED_QUESTIONS.find(entry => path.startsWith(entry.prefix));
  const qs = match ? match.questions : FALLBACK_QUESTIONS;
  return qs.map(q => sr ? q.sr : q.en);
}

function getNarrativeContext(path: string): string | null {
  const contextMap: Record<string, string> = {
    "/analytics/working-capital": "working_capital", "/analytics/ratios": "ratios",
    "/analytics/profitability": "profitability", "/analytics/margin-bridge": "margin_bridge",
    "/analytics/customer-risk": "customer_risk", "/analytics/supplier-risk": "supplier_risk",
    "/analytics/vat-trap": "vat_trap", "/analytics/early-warning": "early_warning",
    "/analytics/inventory-health": "inventory_health", "/analytics/payroll-benchmark": "payroll_benchmark",
    "/analytics/cashflow-forecast": "cashflow", "/analytics/budget": "budget",
    "/analytics/break-even": "breakeven", "/dashboard": "dashboard",
    "/crm": "crm_pipeline", "/pos": "pos_performance", "/production": "production",
    "/hr": "hr_overview", "/purchasing": "purchasing", "/inventory": "inventory_health",
    "/sales": "sales_performance", "/accounting/expenses": "expenses",
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
  const {
    messages, isLoading, send, clear, newChat,
    conversations, loadConversation, togglePin, searchConversations, deleteConversation,
  } = useAiStream({ tenantId, locale });
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim()) {
      searchConversations(q);
    } else {
      searchConversations("");
    }
  };

  // Collapsed rail
  if (!open) {
    return (
      <TooltipProvider>
        <aside className="w-10 border-l bg-card/50 backdrop-blur-sm flex flex-col items-center py-3 gap-3 shrink-0 print:hidden">
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
    <aside className="w-[280px] xl:w-[300px] border-l bg-card/50 backdrop-blur-sm flex flex-col shrink-0 print:hidden overflow-hidden">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>AI Copilot</span>
          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">12 tools</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newChat} title={sr ? "Novi razgovor" : "New chat"}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(p => !p)} title={sr ? "Istorija" : "History"}>
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Conversation History */}
      {showHistory && (
        <div className="border-b p-2 max-h-52 overflow-y-auto space-y-1.5">
          <div className="flex items-center gap-1">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder={sr ? "Pretraži..." : "Search..."}
              className="h-6 text-[11px] border-0 bg-muted/50 focus-visible:ring-0 px-1.5"
            />
          </div>
          {conversations.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2">
              {sr ? "Nema razgovora" : "No conversations"}
            </p>
          )}
          {conversations.map(conv => (
            <div key={conv.id} className="flex items-center gap-1 group">
              <button
                onClick={() => { loadConversation(conv.id); setShowHistory(false); }}
                className="flex-1 text-left text-xs truncate px-2 py-1 rounded hover:bg-accent transition-colors"
              >
                {conv.is_pinned && <Pin className="h-2.5 w-2.5 inline mr-1 text-primary" />}
                {conv.title || (sr ? "Bez naslova" : "Untitled")}
              </button>
              <Button
                variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => togglePin(conv.id)}
                title={conv.is_pinned ? (sr ? "Otkači" : "Unpin") : (sr ? "Zakači" : "Pin")}
              >
                <Pin className={`h-2.5 w-2.5 ${conv.is_pinned ? "text-primary" : ""}`} />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => deleteConversation(conv.id)}
                title={sr ? "Obriši" : "Delete"}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3" ref={scrollRef}>
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
                    data={{ _route: location.pathname, _module: module }}
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
                  <div className="space-y-2 py-1">
                    <p className="text-xs text-muted-foreground text-center">
                      {sr ? "Pitajte o vašim podacima..." : "Ask about your data..."}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {getSuggestedQuestions(location.pathname, sr).map((q, i) => (
                        <button
                          key={i}
                          onClick={() => send(q)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                        >
                          <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
                          <span className="text-left">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[90%] rounded-md px-2 py-1.5 text-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                        : "bg-muted"
                    }`}>
                      {msg.role === "assistant" ? <SimpleMarkdown content={msg.content} /> : msg.content}
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
