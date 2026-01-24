import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT_6M = 6_000_000;
const LIMIT_8M = 8_000_000;

interface Company {
  id: string;
  user_id: string;
  company_name: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  email_reminders: boolean;
  email_limit_warnings: boolean;
}

interface Reminder {
  id: string;
  company_id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
}

interface Invoice {
  total_amount: number;
  issue_date: string;
  currency: string;
  exchange_rate: number;
}

interface FiscalSummary {
  total_amount: number;
  date: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "RSD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function sendReminderEmail(
  email: string,
  fullName: string,
  reminderTitle: string,
  dueDate: string,
  isDayBefore: boolean
): Promise<boolean> {
  const subject = isDayBefore
    ? `⏰ Podsetnik za sutra: ${reminderTitle}`
    : `📅 Podsetnik za danas: ${reminderTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .reminder-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${isDayBefore ? '#f59e0b' : '#ef4444'}; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">PaušalBox</h1>
          <p style="margin: 10px 0 0;">Sistem za paušalne preduzetnike</p>
        </div>
        <div class="content">
          <p>Pozdrav ${fullName},</p>
          <div class="reminder-box">
            <h2 style="margin: 0 0 10px;">${reminderTitle}</h2>
            <p style="margin: 0; color: #64748b;">
              ${isDayBefore ? "Rok je sutra" : "Rok je danas"}: <strong>${formatDate(dueDate)}</strong>
            </p>
          </div>
          <p>Prijavite se na PaušalBox da biste upravljali vašim obavezama.</p>
          <div class="footer">
            <p>Ovaj email je automatski poslat iz PaušalBox aplikacije.</p>
            <p>Možete isključiti email podsetvnike u podešavanjima profila.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { error } = await resend.emails.send({
      from: "PaušalBox <obavestenja@pausalbox.rs>",
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("Error sending reminder email:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Exception sending reminder email:", error);
    return false;
  }
}

async function sendLimitWarningEmail(
  email: string,
  fullName: string,
  limitType: "6m" | "8m",
  percentage: number,
  currentAmount: number,
  limitAmount: number
): Promise<boolean> {
  const limitLabel = limitType === "6m" ? "6 miliona (godišnji)" : "8 miliona (klizni)";
  const subject = `⚠️ Upozorenje: Dostigli ste ${percentage}% limita od ${limitType === "6m" ? "6M" : "8M"} RSD`;

  const remaining = limitAmount - currentAmount;
  const warningColor = percentage >= 90 ? "#ef4444" : "#f59e0b";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .warning-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${warningColor}; margin: 20px 0; }
        .progress-bar { background: #e2e8f0; border-radius: 999px; height: 12px; overflow: hidden; margin: 15px 0; }
        .progress-fill { background: ${warningColor}; height: 100%; transition: width 0.3s; }
        .stats { display: flex; justify-content: space-between; margin-top: 15px; }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #1e293b; }
        .stat-label { font-size: 12px; color: #64748b; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">PaušalBox</h1>
          <p style="margin: 10px 0 0;">Upozorenje o limitu prometa</p>
        </div>
        <div class="content">
          <p>Pozdrav ${fullName},</p>
          <div class="warning-box">
            <h2 style="margin: 0 0 10px; color: ${warningColor};">
              ⚠️ Limit od ${limitLabel}
            </h2>
            <p style="margin: 0 0 15px;">Dostigli ste <strong>${percentage}%</strong> vašeg limita.</p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%;"></div>
            </div>
            <div class="stats">
              <div class="stat">
                <div class="stat-value">${formatCurrency(currentAmount)}</div>
                <div class="stat-label">Trenutni promet</div>
              </div>
              <div class="stat">
                <div class="stat-value">${formatCurrency(remaining)}</div>
                <div class="stat-label">Preostalo</div>
              </div>
            </div>
          </div>
          ${
            limitType === "6m"
              ? `<p><strong>Napomena:</strong> Prekoračenje limita od 6 miliona RSD znači gubitak prava na paušalno oporezivanje od sledećeg perioda.</p>`
              : `<p><strong>Napomena:</strong> Prekoračenje limita od 8 miliona RSD znači obavezu ulaska u PDV sistem od narednog dana.</p>`
          }
          <div class="footer">
            <p>Ovaj email je automatski poslat iz PaušalBox aplikacije.</p>
            <p>Možete isključiti upozorenja o limitima u podešavanjima profila.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { error } = await resend.emails.send({
      from: "PaušalBox <obavestenja@pausalbox.rs>",
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("Error sending limit warning email:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Exception sending limit warning email:", error);
    return false;
  }
}

async function calculateLimits(supabase: any, companyId: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  // Calculate rolling 365 days
  const rollingStart = new Date(now);
  rollingStart.setDate(rollingStart.getDate() - 365);
  const rollingStartStr = rollingStart.toISOString().split("T")[0];
  const rollingEndStr = now.toISOString().split("T")[0];

  // Fetch yearly invoices (excluding advance and proforma)
  const { data: yearlyInvoices } = await supabase
    .from("invoices")
    .select("total_amount, currency, exchange_rate")
    .eq("company_id", companyId)
    .eq("is_proforma", false)
    .neq("invoice_type", "advance")
    .gte("issue_date", yearStart)
    .lte("issue_date", yearEnd);

  // Fetch yearly fiscal
  const { data: yearlyFiscal } = await supabase
    .from("fiscal_daily_summary")
    .select("total_amount")
    .eq("company_id", companyId)
    .gte("date", yearStart)
    .lte("date", yearEnd);

  // Fetch rolling invoices
  const { data: rollingInvoices } = await supabase
    .from("invoices")
    .select("total_amount, currency, exchange_rate")
    .eq("company_id", companyId)
    .eq("is_proforma", false)
    .neq("invoice_type", "advance")
    .gte("issue_date", rollingStartStr)
    .lte("issue_date", rollingEndStr);

  // Fetch rolling fiscal
  const { data: rollingFiscal } = await supabase
    .from("fiscal_daily_summary")
    .select("total_amount")
    .eq("company_id", companyId)
    .gte("date", rollingStartStr)
    .lte("date", rollingEndStr);

  // Fetch rolling KPO imports (entries without invoice_id and fiscal_entry_id)
  const { data: rollingKpo } = await supabase
    .from("kpo_entries")
    .select("total_amount, entry_date")
    .eq("company_id", companyId)
    .is("invoice_id", null)
    .is("fiscal_entry_id", null)
    .gte("entry_date", rollingStartStr)
    .lte("entry_date", rollingEndStr);

  // Calculate totals
  const yearlyTotal =
    (yearlyInvoices || []).reduce((sum: number, inv: Invoice) => {
      const amount = inv.currency === "RSD" ? inv.total_amount : inv.total_amount * (inv.exchange_rate || 1);
      return sum + amount;
    }, 0) + (yearlyFiscal || []).reduce((sum: number, f: FiscalSummary) => sum + f.total_amount, 0);

  const rollingTotal =
    (rollingInvoices || []).reduce((sum: number, inv: Invoice) => {
      const amount = inv.currency === "RSD" ? inv.total_amount : inv.total_amount * (inv.exchange_rate || 1);
      return sum + amount;
    }, 0) +
    (rollingFiscal || []).reduce((sum: number, f: FiscalSummary) => sum + f.total_amount, 0) +
    (rollingKpo || []).reduce((sum: number, k: any) => sum + (k.total_amount || 0), 0);

  return {
    yearlyTotal,
    rollingTotal,
    yearly6MPercent: (yearlyTotal / LIMIT_6M) * 100,
    rolling8MPercent: (rollingTotal / LIMIT_8M) * 100,
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-notification-emails function started");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    let remindersSent = 0;
    let limitWarningsSent = 0;

    // Get all companies with their users
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, user_id, company_name");

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      throw companiesError;
    }

    console.log(`Processing ${companies?.length || 0} companies`);

    for (const company of companies || []) {
      // Get user profile with email preferences
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, email_reminders, email_limit_warnings")
        .eq("id", company.user_id)
        .single();

      if (profileError || !profile) {
        console.log(`No profile found for user ${company.user_id}`);
        continue;
      }

      // Process reminders if enabled
      if (profile.email_reminders !== false) {
        // Get reminders due tomorrow
        const { data: tomorrowReminders } = await supabase
          .from("reminders")
          .select("id, title, due_date")
          .eq("company_id", company.id)
          .eq("due_date", tomorrowStr)
          .eq("is_completed", false);

        for (const reminder of tomorrowReminders || []) {
          // Check if already sent
          const { data: existingLog } = await supabase
            .from("email_notification_log")
            .select("id")
            .eq("reference_id", reminder.id)
            .eq("notification_type", "reminder_day_before")
            .eq("reference_date", tomorrowStr)
            .single();

          if (!existingLog) {
            const sent = await sendReminderEmail(
              profile.email,
              profile.full_name || "Korisniče",
              reminder.title,
              reminder.due_date,
              true
            );

            if (sent) {
              await supabase.from("email_notification_log").insert({
                company_id: company.id,
                user_id: profile.id,
                notification_type: "reminder_day_before",
                reference_id: reminder.id,
                reference_date: tomorrowStr,
                email_to: profile.email,
                subject: `⏰ Podsetnik za sutra: ${reminder.title}`,
              });
              remindersSent++;
            }
          }
        }

        // Get reminders due today
        const { data: todayReminders } = await supabase
          .from("reminders")
          .select("id, title, due_date")
          .eq("company_id", company.id)
          .eq("due_date", todayStr)
          .eq("is_completed", false);

        for (const reminder of todayReminders || []) {
          // Check if already sent
          const { data: existingLog } = await supabase
            .from("email_notification_log")
            .select("id")
            .eq("reference_id", reminder.id)
            .eq("notification_type", "reminder_due_date")
            .eq("reference_date", todayStr)
            .single();

          if (!existingLog) {
            const sent = await sendReminderEmail(
              profile.email,
              profile.full_name || "Korisniče",
              reminder.title,
              reminder.due_date,
              false
            );

            if (sent) {
              await supabase.from("email_notification_log").insert({
                company_id: company.id,
                user_id: profile.id,
                notification_type: "reminder_due_date",
                reference_id: reminder.id,
                reference_date: todayStr,
                email_to: profile.email,
                subject: `📅 Podsetnik za danas: ${reminder.title}`,
              });
              remindersSent++;
            }
          }
        }
      }

      // Process limit warnings if enabled
      if (profile.email_limit_warnings !== false) {
        const limits = await calculateLimits(supabase, company.id);

        // Check 6M limit (80% and 90%)
        const thresholds6M = [
          { percent: 90, type: "limit_90_6m" },
          { percent: 80, type: "limit_80_6m" },
        ];

        for (const threshold of thresholds6M) {
          if (limits.yearly6MPercent >= threshold.percent) {
            // Check if already sent today
            const { data: existingLog } = await supabase
              .from("email_notification_log")
              .select("id")
              .eq("company_id", company.id)
              .eq("notification_type", threshold.type)
              .eq("reference_date", todayStr)
              .single();

            if (!existingLog) {
              const sent = await sendLimitWarningEmail(
                profile.email,
                profile.full_name || "Korisniče",
                "6m",
                Math.round(limits.yearly6MPercent),
                limits.yearlyTotal,
                LIMIT_6M
              );

              if (sent) {
                await supabase.from("email_notification_log").insert({
                  company_id: company.id,
                  user_id: profile.id,
                  notification_type: threshold.type,
                  reference_date: todayStr,
                  email_to: profile.email,
                  subject: `⚠️ Upozorenje: Dostigli ste ${Math.round(limits.yearly6MPercent)}% limita od 6M RSD`,
                });
                limitWarningsSent++;
              }
              break; // Only send the highest threshold
            }
          }
        }

        // Check 8M limit (80% and 90%)
        const thresholds8M = [
          { percent: 90, type: "limit_90_8m" },
          { percent: 80, type: "limit_80_8m" },
        ];

        for (const threshold of thresholds8M) {
          if (limits.rolling8MPercent >= threshold.percent) {
            // Check if already sent today
            const { data: existingLog } = await supabase
              .from("email_notification_log")
              .select("id")
              .eq("company_id", company.id)
              .eq("notification_type", threshold.type)
              .eq("reference_date", todayStr)
              .single();

            if (!existingLog) {
              const sent = await sendLimitWarningEmail(
                profile.email,
                profile.full_name || "Korisniče",
                "8m",
                Math.round(limits.rolling8MPercent),
                limits.rollingTotal,
                LIMIT_8M
              );

              if (sent) {
                await supabase.from("email_notification_log").insert({
                  company_id: company.id,
                  user_id: profile.id,
                  notification_type: threshold.type,
                  reference_date: todayStr,
                  email_to: profile.email,
                  subject: `⚠️ Upozorenje: Dostigli ste ${Math.round(limits.rolling8MPercent)}% limita od 8M RSD`,
                });
                limitWarningsSent++;
              }
              break; // Only send the highest threshold
            }
          }
        }
      }
    }

    console.log(`Finished: ${remindersSent} reminders, ${limitWarningsSent} limit warnings sent`);

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent,
        limitWarningsSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
