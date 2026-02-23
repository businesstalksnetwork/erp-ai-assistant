-- ============================================================
-- Remove PausalBox Branding - Update Email Templates
-- ============================================================

-- Update email templates to use ERP-AI Assistant branding
UPDATE public.email_templates
SET 
  subject = REPLACE(REPLACE(REPLACE(subject, 'PausalBox', 'ERP-AI Assistant'), 'pausalbox', 'erp-ai-assistant'), 'Paušal Box', 'ERP-AI Assistant'),
  html_content = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(html_content, 'PausalBox', 'ERP-AI Assistant'),
            'pausalbox', 'erp-ai-assistant'
          ),
          'Paušal Box', 'ERP-AI Assistant'
        ),
        'https://pausalbox.lovable.app', 'https://erp-ai-assistant.aiknjigovodja.rs'
      ),
      'https://pausalbox.aiknjigovodja.rs', 'https://erp-ai-assistant.aiknjigovodja.rs'
    ),
    'pausalbox.aiknjigovodja.rs', 'erp-ai-assistant.aiknjigovodja.rs'
  ),
  body_text = REPLACE(REPLACE(REPLACE(body_text, 'PausalBox', 'ERP-AI Assistant'), 'pausalbox', 'erp-ai-assistant'), 'Paušal Box', 'ERP-AI Assistant')
WHERE 
  subject LIKE '%PausalBox%' 
  OR subject LIKE '%pausalbox%'
  OR html_content LIKE '%PausalBox%'
  OR html_content LIKE '%pausalbox%'
  OR body_text LIKE '%PausalBox%'
  OR body_text LIKE '%pausalbox%';
