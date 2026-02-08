INSERT INTO email_templates (template_key, name, subject, html_content, description, placeholders)
VALUES (
  'trial_expired_admin',
  'Istekao Trial - Admin',
  'Vaš probni period na PausalBox-u je istekao',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#1a1a2e;padding:30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">PausalBox</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <h2 style="color:#1a1a2e;margin:0 0 20px;">Zdravo {{full_name}},</h2>
              <p style="color:#374151;font-size:16px;line-height:1.6;">
                Vaš besplatni probni period na PausalBox-u je istekao.
              </p>
              <p style="color:#374151;font-size:16px;line-height:1.6;">
                Nadamo se da ste uživali u korišćenju aplikacije! Da biste nastavili sa svim funkcijama — fakturisanje, KPO knjiga, fiskalna kasa, SEF integracija i još mnogo toga — aktivirajte svoju pretplatu.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="https://pausalbox.lovable.app" style="background-color:#6366f1;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;display:inline-block;">
                  Aktiviraj pretplatu
                </a>
              </div>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;">
                Ako imate bilo kakva pitanja, slobodno nas kontaktirajte odgovorom na ovaj email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:20px 30px;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                © 2026 PausalBox. Sva prava zadržana.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  'Email koji admin šalje korisnicima kojima je istekao trial period',
  ARRAY['full_name']
)
ON CONFLICT (template_key) DO NOTHING;