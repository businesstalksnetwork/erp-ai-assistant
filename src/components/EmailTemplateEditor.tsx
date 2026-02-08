import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Mail, Edit2, Eye, Save, X, RefreshCw, Clock, Bell, AlertTriangle, CreditCard } from "lucide-react";

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  html_content: string;
  description: string | null;
  placeholders: string[] | null;
  created_at: string;
  updated_at: string;
}

const TEMPLATE_CATEGORIES = {
  reminders: {
    label: "Podsetnici",
    icon: Bell,
    keys: ["reminder_7_days", "reminder_day_before", "reminder_on_due_date"],
  },
  trial: {
    label: "Trial",
    icon: Clock,
    keys: ["trial_expiring_7_days", "trial_expiring_3_days", "trial_expiring_1_day", "trial_expired_admin"],
  },
  subscription: {
    label: "Pretplata",
    icon: CreditCard,
    keys: ["subscription_expiring_7_days", "subscription_expiring_3_days", "subscription_expiring_1_day"],
  },
  limits: {
    label: "Limiti",
    icon: AlertTriangle,
    keys: ["limit_80_6m", "limit_90_6m", "limit_80_8m", "limit_90_8m"],
  },
};

export function EmailTemplateEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedHtml, setEditedHtml] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("reminders");

  // Fetch all templates
  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("template_key");
      
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async ({ id, subject, html_content }: { id: string; subject: string; html_content: string }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ subject, html_content })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({
        title: "Šablon sačuvan",
        description: "Email šablon je uspešno ažuriran.",
      });
      setSelectedTemplate(null);
    },
    onError: (error) => {
      toast({
        title: "Greška",
        description: "Nije moguće sačuvati šablon: " + error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (selectedTemplate) {
      setEditedSubject(selectedTemplate.subject);
      setEditedHtml(selectedTemplate.html_content);
    }
  }, [selectedTemplate]);

  const handleSave = () => {
    if (!selectedTemplate) return;
    updateTemplate.mutate({
      id: selectedTemplate.id,
      subject: editedSubject,
      html_content: editedHtml,
    });
  };

  const getTemplatesByCategory = (categoryKey: string) => {
    const category = TEMPLATE_CATEGORIES[categoryKey as keyof typeof TEMPLATE_CATEGORIES];
    return templates?.filter((t) => category.keys.includes(t.template_key)) || [];
  };

  const renderPreviewHtml = () => {
    // Replace placeholders with sample data for preview
    let html = editedHtml;
    const sampleData: Record<string, string> = {
      full_name: "Petar Petrović",
      reminder_title: "Plaćanje doprinosa",
      due_date: "31.01.2026",
      amount: "15.000,00 RSD",
      days_left: "7",
      subscription_end_date: "15.02.2026",
      current_amount: "4.800.000,00 RSD",
      limit_amount: "6.000.000,00 RSD",
      remaining_amount: "1.200.000,00 RSD",
      limit_percent: "80",
    };

    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, "g"), value);
    });

    // Handle simple conditionals
    html = html.replace(/{{#if amount}}(.*?){{\/if}}/gs, "$1");

    return html;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email šabloni</h3>
          <p className="text-sm text-muted-foreground">
            Prilagodite sadržaj email notifikacija koje se šalju korisnicima
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Osveži
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(TEMPLATE_CATEGORIES).map(([key, category]) => {
            const Icon = category.icon;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{category.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.keys(TEMPLATE_CATEGORIES).map((categoryKey) => (
          <TabsContent key={categoryKey} value={categoryKey} className="mt-4">
            <div className="grid gap-4">
              {getTemplatesByCategory(categoryKey).map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {template.name}
                        </CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Uredi
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded mt-1">
                          {template.subject}
                        </p>
                      </div>
                      {template.placeholders && template.placeholders.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Placeholderi:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.placeholders.map((p) => (
                              <Badge key={p} variant="secondary" className="text-xs font-mono">
                                {`{{${p}}}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Uredi šablon: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject (naslov emaila)</Label>
                <Input
                  id="subject"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  placeholder="Naslov emaila..."
                  className="font-mono text-sm"
                />
              </div>

              {selectedTemplate?.placeholders && selectedTemplate.placeholders.length > 0 && (
                <div>
                  <Label>Dostupni placeholderi (kopirajte u šablon):</Label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedTemplate.placeholders.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="text-xs font-mono cursor-pointer hover:bg-primary hover:text-primary-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${p}}}`);
                          toast({
                            title: "Kopirano",
                            description: `{{${p}}} je kopiran u clipboard`,
                          });
                        }}
                      >
                        {`{{${p}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="html">HTML sadržaj</Label>
                  <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
                <ScrollArea className="h-[300px] border rounded-md">
                  <Textarea
                    id="html"
                    value={editedHtml}
                    onChange={(e) => setEditedHtml(e.target.value)}
                    placeholder="HTML sadržaj emaila..."
                    className="min-h-[300px] font-mono text-xs border-0 resize-none"
                  />
                </ScrollArea>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              <X className="h-4 w-4 mr-2" />
              Otkaži
            </Button>
            <Button onClick={handleSave} disabled={updateTemplate.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateTemplate.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview emaila</DialogTitle>
            <DialogDescription>
              Prikaz sa demo podacima (placeholderi su zamenjeni test vrednostima)
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="bg-muted px-4 py-2 border-b">
              <p className="text-sm">
                <span className="font-medium">Subject:</span>{" "}
                {editedSubject
                  .replace(/{{full_name}}/g, "Petar Petrović")
                  .replace(/{{reminder_title}}/g, "Plaćanje doprinosa")
                  .replace(/{{due_date}}/g, "31.01.2026")}
              </p>
            </div>
            <ScrollArea className="h-[400px]">
              <div
                className="p-4"
                dangerouslySetInnerHTML={{ __html: renderPreviewHtml() }}
              />
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
