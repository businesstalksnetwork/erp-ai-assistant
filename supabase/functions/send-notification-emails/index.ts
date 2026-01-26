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

function formatCurrency(amount: number): string {
  return amount.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) + ' RSD';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sr-RS");
}

function renderTemplate(template: string, data: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value?.toString() || '');
  }
  result = result.replace(/{{#if (\w+)}}(.*?){{\/if}}/gs, (_, key, content) => data[key] ? content : '');
  return result;
}

async function getTemplate(supabase: any, key: string) {
  const { data } = await supabase.from('email_templates').select('subject, html_content').eq('template_key', key).single();
  return data;
}

async function wasNotificationSent(supabase: any, companyId: string, userId: string, type: string, refId: string | null, refDate: string | null) {
  let q = supabase.from('email_notification_log').select('id').eq('company_id', companyId).eq('user_id', userId).eq('notification_type', type);
  if (refId) q = q.eq('reference_id', refId);
  if (refDate) q = q.eq('reference_date', refDate);
  const { data } = await q.limit(1);
  return data?.length > 0;
}

async function logNotification(supabase: any, companyId: string, userId: string, type: string, refId: string | null, refDate: string | null, email: string, subject: string) {
  await supabase.from('email_notification_log').insert({ company_id: companyId, user_id: userId, notification_type: type, reference_id: refId, reference_date: refDate, email_to: email, subject });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
    const in7DaysStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

    const { data: companies } = await supabase.from('companies').select('id, user_id, name');
    let sent = { reminders: 0, subscriptions: 0, limits: 0 };

    for (const company of companies || []) {
      const { data: profile } = await supabase.from('profiles').select('id, email, full_name, email_reminder_7_days_before, email_reminder_day_before, email_reminder_on_due_date, email_limit_6m_warning, email_limit_8m_warning, email_subscription_warnings, subscription_end, is_trial, account_type').eq('id', company.user_id).single();
      if (!profile) continue;

      // Reminders - FIXED: using correct table name 'payment_reminders'
      const { data: reminders } = await supabase.from('payment_reminders').select('id, title, due_date, amount').eq('company_id', company.id).eq('is_completed', false).in('due_date', [todayStr, tomorrowStr, in7DaysStr]);
      
      for (const r of reminders || []) {
        const checks = [
          { date: in7DaysStr, pref: profile.email_reminder_7_days_before, type: 'reminder_7_days_before', tpl: 'reminder_7_days' },
          { date: tomorrowStr, pref: profile.email_reminder_day_before, type: 'reminder_day_before', tpl: 'reminder_day_before' },
          { date: todayStr, pref: profile.email_reminder_on_due_date, type: 'reminder_on_due_date', tpl: 'reminder_on_due_date' },
        ];
        for (const c of checks) {
          if (r.due_date === c.date && c.pref && !(await wasNotificationSent(supabase, company.id, profile.id, c.type, r.id, r.due_date))) {
            const tpl = await getTemplate(supabase, c.tpl);
            const data = { full_name: profile.full_name || profile.email, reminder_title: r.title, due_date: formatDate(r.due_date), amount: r.amount ? formatCurrency(r.amount) : null };
            const subject = tpl ? renderTemplate(tpl.subject, data) : `Podsetnik: ${r.title}`;
            const html = tpl ? renderTemplate(tpl.html_content, data) : `<p>Podsetnik: ${r.title} - ${formatDate(r.due_date)}</p>`;
            const emailRes = await resend.emails.send({ from: "PausalBox <obavestenja@pausalbox.rs>", to: [profile.email], subject, html });
            if (emailRes.error) {
              console.error(`Failed to send reminder email to ${profile.email}:`, emailRes.error);
              continue;
            }
            await logNotification(supabase, company.id, profile.id, c.type, r.id, r.due_date, profile.email, subject);
            sent.reminders++;
          }
        }
      }

      // Subscription warnings
      if (profile.email_subscription_warnings && profile.subscription_end && profile.account_type !== 'bookkeeper') {
        const daysLeft = Math.ceil((new Date(profile.subscription_end).getTime() - today.getTime()) / 86400000);
        for (const d of [7, 3, 1]) {
          if (daysLeft === d) {
            const type = `${profile.is_trial ? 'trial' : 'subscription'}_expiring_${d}d`;
            if (!(await wasNotificationSent(supabase, company.id, profile.id, type, null, profile.subscription_end))) {
              const tplKey = `${profile.is_trial ? 'trial' : 'subscription'}_expiring_${d === 7 ? '7_days' : d === 3 ? '3_days' : '1_day'}`;
              const tpl = await getTemplate(supabase, tplKey);
              const data = { full_name: profile.full_name || profile.email, subscription_end_date: formatDate(profile.subscription_end), days_left: d };
              const subject = tpl ? renderTemplate(tpl.subject, data) : `${profile.is_trial ? 'Trial' : 'Pretplata'} ističe za ${d} dana`;
              const html = tpl ? renderTemplate(tpl.html_content, data) : `<p>Vaš nalog ističe ${formatDate(profile.subscription_end)}</p>`;
              const emailRes = await resend.emails.send({ from: "PausalBox <obavestenja@pausalbox.rs>", to: [profile.email], subject, html });
              if (emailRes.error) {
                console.error(`Failed to send subscription email to ${profile.email}:`, emailRes.error);
                continue;
              }
              await logNotification(supabase, company.id, profile.id, type, null, profile.subscription_end, profile.email, subject);
              sent.subscriptions++;
            }
          }
        }
      }

      // Limit warnings (simplified calculation)
      const yearStart = `${today.getFullYear()}-01-01`;
      const { data: yearlyInv } = await supabase.from('invoices').select('total_amount').eq('company_id', company.id).eq('is_proforma', false).gte('service_date', yearStart);
      const { data: yearlyFiscal } = await supabase.from('fiscal_daily_summary').select('daily_total').eq('company_id', company.id).gte('summary_date', yearStart);
      const yearly = (yearlyInv?.reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0) + (yearlyFiscal?.reduce((s: number, f: any) => s + (f.daily_total || 0), 0) || 0);
      const pct6m = (yearly / LIMIT_6M) * 100;

      if (profile.email_limit_6m_warning) {
        for (const t of [{ p: 90, k: 'limit_90_6m', n: 'limit_6m_90' }, { p: 80, k: 'limit_80_6m', n: 'limit_6m_80' }]) {
          if (pct6m >= t.p && !(await wasNotificationSent(supabase, company.id, profile.id, t.n, null, null))) {
            const tpl = await getTemplate(supabase, t.k);
            const data = { full_name: profile.full_name || profile.email, current_amount: formatCurrency(yearly), limit_amount: formatCurrency(LIMIT_6M), remaining_amount: formatCurrency(Math.max(0, LIMIT_6M - yearly)), limit_percent: Math.round(pct6m) };
            const subject = tpl ? renderTemplate(tpl.subject, data) : `Limit 6M - ${t.p}%`;
            const html = tpl ? renderTemplate(tpl.html_content, data) : `<p>Dostigli ste ${t.p}% limita</p>`;
            const emailRes = await resend.emails.send({ from: "PausalBox <obavestenja@pausalbox.rs>", to: [profile.email], subject, html });
            if (emailRes.error) {
              console.error(`Failed to send limit warning email to ${profile.email}:`, emailRes.error);
              continue;
            }
            await logNotification(supabase, company.id, profile.id, t.n, null, null, profile.email, subject);
            sent.limits++;
            break;
          }
        }
      }
    }

    console.log(`Sent: ${sent.reminders} reminders, ${sent.subscriptions} subscription warnings, ${sent.limits} limit warnings`);
    return new Response(JSON.stringify({ success: true, ...sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
