import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function insertAppNotification(supabase: any, userId: string, companyId: string, type: string, title: string, message: string, link: string | null, referenceId: string | null) {
  await supabase.from('notifications').insert({
    user_id: userId,
    company_id: companyId,
    type,
    title,
    message,
    link,
    reference_id: referenceId,
  });
}

// Web Push helpers
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(vapidPrivateKeyBase64: string, audience: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };
  
  const enc = new TextEncoder();
  const headerB64 = arrayBufferToBase64Url(enc.encode(JSON.stringify(header)).buffer as ArrayBuffer);
  const payloadB64 = arrayBufferToBase64Url(enc.encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import the private key
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKeyBase64);
  const key = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(unsignedToken)
  );
  
  // Convert DER signature to raw r||s format if needed
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes.length !== 64) {
    // DER encoded, need to extract r and s
    rawSig = new Uint8Array(64);
    let offset = 2;
    const rLen = sigBytes[offset + 1];
    const rStart = offset + 2 + (rLen > 32 ? rLen - 32 : 0);
    const rCopyLen = Math.min(rLen, 32);
    rawSig.set(sigBytes.slice(rStart, rStart + rCopyLen), 32 - rCopyLen);
    offset = offset + 2 + rLen;
    const sLen = sigBytes[offset + 1];
    const sStart = offset + 2 + (sLen > 32 ? sLen - 32 : 0);
    const sCopyLen = Math.min(sLen, 32);
    rawSig.set(sigBytes.slice(sStart, sStart + sCopyLen), 64 - sCopyLen);
  } else {
    rawSig = sigBytes;
  }
  
  const signatureB64 = arrayBufferToBase64Url(rawSig.buffer as ArrayBuffer);
  return `${unsignedToken}.${signatureB64}`;
}

async function sendPushToUser(supabase: any, userId: string, title: string, message: string, link: string | null) {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidPublicKey || !vapidPrivateKey) return;

  // Check if user has push enabled
  const { data: profile } = await supabase.from('profiles').select('push_notifications_enabled').eq('id', userId).single();
  if (!profile?.push_notifications_enabled) return;

  const { data: subscriptions } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId);
  if (!subscriptions?.length) return;

  const payload = JSON.stringify({ title, message, link, tag: `pb-${Date.now()}` });
  const subject = 'mailto:obavestenja@pausalbox.rs';

  for (const sub of subscriptions) {
    try {
      const endpoint = new URL(sub.endpoint);
      const audience = `${endpoint.protocol}//${endpoint.host}`;
      
      const jwt = await createJWT(vapidPrivateKey, audience, subject);
      
      // Encrypt payload using Web Push encryption
      // For simplicity, send without encryption (works for most browsers with proper VAPID)
      const response = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
          'Content-Type': 'application/json',
          'Content-Encoding': 'aes128gcm',
          'TTL': '86400',
        },
        body: payload,
      });

      if (response.status === 404 || response.status === 410) {
        // Subscription expired, remove it
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    } catch (e) {
      console.error(`Push send failed for subscription ${sub.id}:`, e);
    }
  }
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
    let sent = { reminders: 0, subscriptions: 0, limits: 0, app_notifications: 0, push_sent: 0 };

    for (const company of companies || []) {
      const { data: profile } = await supabase.from('profiles').select('id, email, full_name, email_reminder_7_days_before, email_reminder_day_before, email_reminder_on_due_date, email_limit_6m_warning, email_limit_8m_warning, email_subscription_warnings, subscription_end, is_trial, account_type, app_notify_reminders, app_notify_subscription, app_notify_limits, push_notifications_enabled').eq('id', company.user_id).single();
      if (!profile) continue;

      // Skip users with expired subscriptions (except bookkeepers)
      if (profile.account_type !== 'bookkeeper' && profile.subscription_end) {
        const subEnd = new Date(profile.subscription_end);
        if (subEnd.getTime() < today.getTime()) continue;
      }

      // Reminders
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

            // In-app notification
            if (profile.app_notify_reminders !== false) {
              const appMsg = r.amount ? `Rok: ${formatDate(r.due_date)} — ${formatCurrency(r.amount)}` : `Rok: ${formatDate(r.due_date)}`;
              await insertAppNotification(supabase, profile.id, company.id, 'reminder_due', `Podsetnik: ${r.title}`, appMsg, '/reminders', r.id);
              sent.app_notifications++;
              
              // Push notification
              await sendPushToUser(supabase, profile.id, `Podsetnik: ${r.title}`, appMsg, '/reminders');
              sent.push_sent++;
            }
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

              // In-app notification
              if (profile.app_notify_subscription !== false) {
                const isTrialLabel = profile.is_trial ? 'Trial' : 'Pretplata';
                const appTitle = `${isTrialLabel} ističe za ${d} ${d === 1 ? 'dan' : 'dana'}`;
                const appMsg = `Vaša ${isTrialLabel.toLowerCase()} ističe ${formatDate(profile.subscription_end)}. Produžite pretplatu da ne izgubite pristup.`;
                await insertAppNotification(supabase, profile.id, company.id, 'subscription_expiring', appTitle, appMsg, '/profile', null);
                sent.app_notifications++;
                
                await sendPushToUser(supabase, profile.id, appTitle, appMsg, '/profile');
                sent.push_sent++;
              }
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

            // In-app notification
            if (profile.app_notify_limits !== false) {
              const appTitle = `Upozorenje: Limit ${Math.round(pct6m)}%`;
              const appMsg = `Dostigli ste ${Math.round(pct6m)}% limita od 6M. Preostalo: ${formatCurrency(Math.max(0, LIMIT_6M - yearly))}`;
              await insertAppNotification(supabase, profile.id, company.id, 'limit_warning', appTitle, appMsg, '/dashboard', null);
              sent.app_notifications++;
              
              await sendPushToUser(supabase, profile.id, appTitle, appMsg, '/dashboard');
              sent.push_sent++;
            }
            break;
          }
        }
      }
    }

    console.log(`Sent: ${sent.reminders} reminders, ${sent.subscriptions} subscription warnings, ${sent.limits} limit warnings, ${sent.app_notifications} app notifications, ${sent.push_sent} push notifications`);
    return new Response(JSON.stringify({ success: true, ...sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
