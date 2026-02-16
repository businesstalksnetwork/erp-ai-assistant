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

type SuggestedQ = { sr: string; en: string };

const SUGGESTED_QUESTIONS: { prefix: string; questions: SuggestedQ[] }[] = [
  // Analytics sub-pages
  { prefix: "/analytics/ratios", questions: [
    { sr: "Koji su mi najslabiji finansijski pokazatelji?", en: "Which ratios need attention?" },
    { sr: "Kako da poboljšam likvidnost?", en: "How can I improve liquidity?" },
    { sr: "Uporedi pokazatelje sa prošlom godinom", en: "Compare ratios with last year" },
  ]},
  { prefix: "/analytics/cashflow-forecast", questions: [
    { sr: "Da li ću imati problema sa likvidnošću?", en: "Will I face cash shortfalls?" },
    { sr: "Koji su najveći dolazni prilivi?", en: "What are the largest expected inflows?" },
  ]},
  { prefix: "/analytics/budget", questions: [
    { sr: "Gde najviše prekoračujem budžet?", en: "Where am I most over budget?" },
    { sr: "Koji troškovi najbrže rastu?", en: "Which costs are growing fastest?" },
  ]},
  { prefix: "/analytics/profitability", questions: [
    { sr: "Koji kupci donose najviše profita?", en: "Which customers are most profitable?" },
    { sr: "Gde gubim maržu?", en: "Where am I losing margin?" },
  ]},
  { prefix: "/analytics/break-even", questions: [
    { sr: "Koliko mi treba do tačke pokrića?", en: "How far am I from break-even?" },
    { sr: "Šta ako povećam cene za 5%?", en: "What if I raise prices by 5%?" },
  ]},
  { prefix: "/analytics/customer-risk", questions: [
    { sr: "Koji kupci su najrizičniji?", en: "Which customers are highest risk?" },
    { sr: "Koliko imam prekоročenih potraživanja?", en: "How much in overdue receivables?" },
  ]},
  { prefix: "/analytics/inventory-health", questions: [
    { sr: "Koji artikli imaju najsporiji obrt?", en: "Which items have slowest turnover?" },
    { sr: "Koliko imam mrtvog lagera?", en: "How much dead stock do I have?" },
  ]},
  { prefix: "/analytics", questions: [
    { sr: "Sumiraj ključne analitičke pokazatelje", en: "Summarize key analytics metrics" },
    { sr: "Gde su najveći rizici?", en: "Where are the biggest risks?" },
  ]},
  // CRM sub-pages
  { prefix: "/crm/companies", questions: [
    { sr: "Koji su najaktivniji kupci?", en: "Who are the most active customers?" },
    { sr: "Koliko imam novih firmi ovog meseca?", en: "How many new companies this month?" },
  ]},
  { prefix: "/crm/contacts", questions: [
    { sr: "Koji kontakti nemaju aktivnost?", en: "Which contacts have no activity?" },
    { sr: "Koliko imam kontakata bez firme?", en: "How many contacts without a company?" },
  ]},
  { prefix: "/crm/leads", questions: [
    { sr: "Koji lidovi su najduže neaktivni?", en: "Which leads are stale longest?" },
    { sr: "Kakva je konverzija po izvoru?", en: "What's conversion rate by source?" },
  ]},
  { prefix: "/crm/opportunities", questions: [
    { sr: "Koje prilike su najbliže zatvaranju?", en: "Which deals are closest to closing?" },
    { sr: "Kolika je prosečna vrednost prilike?", en: "What's the average deal value?" },
  ]},
  { prefix: "/crm/meetings", questions: [
    { sr: "Koliko imam zakazanih sastanaka ove nedelje?", en: "How many meetings this week?" },
    { sr: "Koji sastanci nemaju beleške?", en: "Which meetings have no notes?" },
  ]},
  { prefix: "/crm", questions: [
    { sr: "Koji lidovi su najbliži konverziji?", en: "Which leads are closest to conversion?" },
    { sr: "Kakav je trend win/loss racija?", en: "What's the win/loss ratio trend?" },
  ]},
  // Sales sub-pages
  { prefix: "/sales/quotes", questions: [
    { sr: "Koliko ponuda čeka odobrenje?", en: "How many quotes pending approval?" },
    { sr: "Koja ponuda ima najveću vrednost?", en: "Which quote has the highest value?" },
  ]},
  { prefix: "/sales/sales-orders", questions: [
    { sr: "Koji nalozi kasne sa isporukom?", en: "Which orders are late on delivery?" },
    { sr: "Kakav je trend naloga ovog meseca?", en: "What's the order trend this month?" },
  ]},
  { prefix: "/sales", questions: [
    { sr: "Koji su top kupci ovog meseca?", en: "Who are top customers this month?" },
    { sr: "Kakav je trend prodaje?", en: "What's the sales trend?" },
  ]},
  // Purchasing
  { prefix: "/purchasing/orders", questions: [
    { sr: "Koje nabavke kasne?", en: "Which purchases are overdue?" },
    { sr: "Ko su najveći dobavljači?", en: "Who are the top suppliers?" },
  ]},
  { prefix: "/purchasing", questions: [
    { sr: "Koje nabavke kasne?", en: "Which purchases are overdue?" },
    { sr: "Kakav je trend nabavnih cena?", en: "What's the procurement price trend?" },
  ]},
  // Accounting sub-pages
  { prefix: "/accounting/invoices", questions: [
    { sr: "Koliko faktura je neplaćeno?", en: "How many invoices are unpaid?" },
    { sr: "Koji kupci najviše kasne?", en: "Which customers are most overdue?" },
  ]},
  { prefix: "/accounting/journal", questions: [
    { sr: "Ima li neknjiženih stavki?", en: "Any unposted entries?" },
    { sr: "Sumiraj poslednja knjiženja", en: "Summarize recent postings" },
  ]},
  { prefix: "/accounting", questions: [
    { sr: "Ima li neusklađenih stavki?", en: "Are there unreconciled items?" },
    { sr: "Sumiraj stanje knjiženja", en: "Summarize posting status" },
  ]},
  // Inventory sub-pages
  { prefix: "/inventory/products", questions: [
    { sr: "Koji proizvodi imaju najmanji lager?", en: "Which products have lowest stock?" },
    { sr: "Koliko artikala je bez cene?", en: "How many items have no price?" },
  ]},
  { prefix: "/inventory/stock", questions: [
    { sr: "Koji magacini su najpuniji?", en: "Which warehouses are fullest?" },
    { sr: "Ima li negativnih zaliha?", en: "Any negative stock levels?" },
  ]},
  { prefix: "/inventory", questions: [
    { sr: "Koji artikli imaju najsporiji obrt?", en: "Which items have slowest turnover?" },
    { sr: "Da li imam kritično niske zalihe?", en: "Do I have critically low stock?" },
  ]},
  // HR sub-pages
  { prefix: "/hr/employees", questions: [
    { sr: "Koliko zaposlenih imam po odeljenju?", en: "How many employees per department?" },
    { sr: "Ko ima ugovor koji uskoro ističe?", en: "Who has contracts expiring soon?" },
  ]},
  { prefix: "/hr/payroll", questions: [
    { sr: "Kakav je ukupan trošak plata?", en: "What's the total payroll cost?" },
    { sr: "Ima li anomalija u obračunu?", en: "Any anomalies in payroll?" },
  ]},
  { prefix: "/hr", questions: [
    { sr: "Kakav je trend troškova plata?", en: "What's the payroll cost trend?" },
    { sr: "Koliko imam otvorenih odsustvovanja?", en: "How many open leave requests?" },
  ]},
  // Production sub-pages
  { prefix: "/production/orders", questions: [
    { sr: "Koji nalozi su u kašnjenju?", en: "Which orders are delayed?" },
    { sr: "Koliko je iskorišćenost kapaciteta?", en: "What's the capacity utilization?" },
  ]},
  { prefix: "/production", questions: [
    { sr: "Gde su uska grla u proizvodnji?", en: "Where are production bottlenecks?" },
    { sr: "Koji nalozi kasne?", en: "Which orders are behind schedule?" },
  ]},
  // POS
  { prefix: "/pos/terminal", questions: [
    { sr: "Kolika je današnja prodaja?", en: "What's today's sales total?" },
    { sr: "Koji artikli se najviše prodaju?", en: "Which items sell most?" },
  ]},
  { prefix: "/pos", questions: [
    { sr: "Kolika je današnja prodaja?", en: "What's today's sales total?" },
    { sr: "Koji artikli se najviše prodaju?", en: "Which items sell most?" },
  ]},
  // Documents
  { prefix: "/documents", questions: [
    { sr: "Koliko dokumenata čeka odobrenje?", en: "How many docs pending approval?" },
    { sr: "Koji dokumenti uskoro ističu?", en: "Which docs expire soon?" },
  ]},
  // Returns
  { prefix: "/returns", questions: [
    { sr: "Koliko imam otvorenih reklamacija?", en: "How many open returns?" },
    { sr: "Koji proizvodi imaju najviše povrata?", en: "Which products have most returns?" },
  ]},
  // Web
  { prefix: "/web", questions: [
    { sr: "Koliko imam online porudžbina?", en: "How many online orders?" },
    { sr: "Kakav je trend web prodaje?", en: "What's the web sales trend?" },
  ]},
  // Settings
  { prefix: "/settings", questions: [
    { sr: "Koji korisnici su neaktivni?", en: "Which users are inactive?" },
    { sr: "Ima li nedovršenih podešavanja?", en: "Any incomplete settings?" },
  ]},
  // Dashboard
  { prefix: "/dashboard", questions: [
    { sr: "Koji su danas najvažniji trendovi?", en: "What are today's key trends?" },
    { sr: "Sumiraj trenutno stanje", en: "Summarize current status" },
    { sr: "Ima li anomalija koje treba proveriti?", en: "Any anomalies to check?" },
  ]},
];

const FALLBACK_QUESTIONS: SuggestedQ[] = [
  { sr: "Sumiraj trenutno stanje", en: "Summarize current status" },
  { sr: "Ima li nešto što zahteva pažnju?", en: "Anything that needs attention?" },
];

function getSuggestedQuestions(path: string, sr: boolean): string[] {
  const match = SUGGESTED_QUESTIONS.find(entry => path.startsWith(entry.prefix));
  const qs = match ? match.questions : FALLBACK_QUESTIONS;
  return qs.map(q => sr ? q.sr : q.en);
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
