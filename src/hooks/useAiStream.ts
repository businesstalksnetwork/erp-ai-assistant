import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

interface UseAiStreamOptions {
  tenantId: string | null;
  locale: string;
}

export function useAiStream({ tenantId, locale }: UseAiStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (data) setConversations(data as Conversation[]);
  }, [tenantId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load a specific conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from("ai_conversations")
      .select("messages")
      .eq("id", conversationId)
      .maybeSingle();

    if (data?.messages) {
      const msgs = (data.messages as any[]).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content as string,
      }));
      setMessages(msgs);
      setActiveConversationId(conversationId);
    }
  }, []);

  // Save conversation to DB
  const saveConversation = useCallback(async (msgs: ChatMessage[]) => {
    if (!tenantId || msgs.length === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const title = msgs[0]?.content?.substring(0, 50) || "New Chat";

    if (activeConversationId) {
      await supabase
        .from("ai_conversations")
        .update({
          messages: msgs as any,
          title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeConversationId);
    } else {
      const { data } = await supabase
        .from("ai_conversations")
        .insert({
          tenant_id: tenantId,
          user_id: session.user.id,
          messages: msgs as any,
          title,
        })
        .select("id")
        .maybeSingle();

      if (data) setActiveConversationId(data.id);
    }

    loadConversations();
  }, [tenantId, activeConversationId, loadConversations]);

  const send = useCallback(async (input: string) => {
    if (!input.trim() || !tenantId || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: locale === "sr"
            ? "Morate biti prijavljeni da biste koristili AI asistenta."
            : "You must be logged in to use the AI assistant.",
        }]);
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMessages,
          tenant_id: tenantId,
          language: locale,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to connect to AI");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const updateAssistant = (snapshot: string) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
          }
          return [...prev, { role: "assistant", content: snapshot }];
        });
      };

      const processLine = (line: string) => {
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") return false;
        if (!line.startsWith("data: ")) return false;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return true;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            updateAssistant(assistantSoFar);
          }
        } catch {
          return false;
        }
        return false;
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          const line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (processLine(line)) { streamDone = true; break; }
        }
      }

      if (textBuffer.trim()) {
        for (const raw of textBuffer.split("\n")) {
          if (raw) processLine(raw);
        }
      }

      // Save conversation after successful exchange
      const finalMessages = [...allMessages, { role: "assistant" as const, content: assistantSoFar }];
      saveConversation(finalMessages);

    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("AI chat error:", e);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: locale === "sr"
            ? "Došlo je do greške. Pokušajte ponovo."
            : "An error occurred. Please try again.",
        }]);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [tenantId, isLoading, messages, locale, saveConversation]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
    setActiveConversationId(null);
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
    setActiveConversationId(null);
  }, []);

  return { messages, isLoading, send, clear, newChat, conversations, loadConversation, activeConversationId };
}
