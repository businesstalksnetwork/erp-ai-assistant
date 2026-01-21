import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedPausalniData {
  type: 'porez' | 'pio' | 'zdravstveno' | 'nezaposlenost';
  year: number;
  monthlyAmounts: number[]; // 12 amounts for each month
  recipientName: string;
  recipientAccount: string;
  paymentModel: string;
  paymentReference: string;
  paymentCode: string;
  payerName: string;
}

// Helper to parse Serbian number format (1.234,56 or 1,234.56)
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  // Remove spaces
  let cleaned = amountStr.trim().replace(/\s/g, '');
  // Handle Serbian format: 1.234,56 -> 1234.56
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // If comma comes after dot, it's Serbian format
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Serbian: dots are thousands, comma is decimal
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // English: commas are thousands, dot is decimal
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma - check position
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal comma
      cleaned = cleaned.replace(',', '.');
    } else {
      // Thousands separator
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  return parseFloat(cleaned) || 0;
}

// Extract account number from text
function extractAccount(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  if (match) {
    // Clean and format account
    const account = match[1].replace(/\s/g, '');
    return account;
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText, type } = await req.json();
    
    if (!pdfText || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing pdfText or type parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing PDF for type: ${type}`);
    console.log(`PDF text length: ${pdfText.length}`);

    // Call Lovable AI to extract structured data
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Ti si AI asistent za ekstrakciju podataka iz PDF rešenja Poreske uprave Republike Srbije za paušalna plaćanja.

Iz teksta treba da ekstrakuješ sledeće podatke u zavisnosti od tipa dokumenta:

Za tip "porez":
- Mesečni iznos poreza na dohodak građana (traži "Обрачуната месечна аконтација пореза на доходак грађана" ili slično)
- Račun za uplatu (traži "рачун број" ili u uplatnici)
- Model (obično 97)
- Poziv na broj (traži "позивом на број" ili slično)
- Godinu (traži godinu u tekstu)

Za tip "pio":
- Mesečne iznose iz kolone "Допринос за обавезно ПИО (24%)" za svih 12 meseci
- Račun: 840-721313843-74
- Model: 97
- Poziv na broj

Za tip "zdravstveno":
- Mesečne iznose iz kolone "Допринос за обавезно ЗДР (10,3%)" za svih 12 meseci
- Račun: 840-721325843-61
- Model: 97
- Poziv na broj

Za tip "nezaposlenost":
- Mesečne iznose iz kolone "Допринос за НЕЗ (0,75%)" za svih 12 meseci
- Račun: 840-721331843-06
- Model: 97
- Poziv na broj

Vrati odgovor SAMO kao validan JSON bez markdown formatiranja, sa strukturom:
{
  "monthlyAmounts": [iznos1, iznos2, ..., iznos12], // 12 brojeva za svaki mesec, ako su svi isti stavi isti iznos 12 puta
  "recipientAccount": "XXX-XXXXXXXXXXXXX-XX",
  "paymentReference": "samo brojevi bez modela",
  "year": 2025,
  "payerName": "ime obveznika ako postoji"
}`;

    const userPrompt = `Ekstrakuj podatke za tip "${type}" iz sledećeg PDF teksta:

${pdfText}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse JSON from AI response
    let parsedData;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\s*/g, '');
      }
      parsedData = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      // Try to extract data manually as fallback
      parsedData = {
        monthlyAmounts: [],
        recipientAccount: '',
        paymentReference: '',
        year: new Date().getFullYear(),
        payerName: ''
      };
    }

    // Set default recipient names based on type
    const recipientNames: Record<string, string> = {
      'porez': 'Пореска управа Републике Србије',
      'pio': 'Републички фонд за ПИО',
      'zdravstveno': 'Републички фонд за здравствено осигурање',
      'nezaposlenost': 'Национална служба за запошљавање',
    };

    // Set default accounts based on type if not extracted
    const defaultAccounts: Record<string, string> = {
      'porez': '840-711122843-32',
      'pio': '840-721313843-74',
      'zdravstveno': '840-721325843-61',
      'nezaposlenost': '840-721331843-06',
    };

    const result: ParsedPausalniData = {
      type: type as ParsedPausalniData['type'],
      year: parsedData.year || new Date().getFullYear(),
      monthlyAmounts: parsedData.monthlyAmounts?.length === 12 
        ? parsedData.monthlyAmounts 
        : Array(12).fill(parsedData.monthlyAmounts?.[0] || 0),
      recipientName: recipientNames[type] || 'Пореска управа Републике Србије',
      recipientAccount: parsedData.recipientAccount || defaultAccounts[type] || '',
      paymentModel: '97',
      paymentReference: parsedData.paymentReference || '',
      paymentCode: '253', // Šifra za poreze i doprinose
      payerName: parsedData.payerName || '',
    };

    console.log('Parsed result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
