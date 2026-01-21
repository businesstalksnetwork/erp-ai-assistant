import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContributionData {
  monthlyAmounts: number[];
  recipientAccount: string;
}

interface ParsedPausalniData {
  type: 'porez' | 'doprinosi';
  year: number;
  monthlyAmounts: number[]; // For porez
  contributions?: {
    pio: ContributionData;
    zdravstveno: ContributionData;
    nezaposlenost: ContributionData;
  };
  recipientName: string;
  recipientAccount: string;
  paymentModel: string;
  paymentReference: string;
  paymentCode: string;
  payerName: string;
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

    let systemPrompt: string;
    
    if (type === 'doprinosi') {
      systemPrompt = `Ti si AI asistent za ekstrakciju podataka iz PDF rešenja Poreske uprave Republike Srbije za paušalne doprinose.

Iz PDF teksta treba da ekstrakuješ:
1. Mesečne iznose iz tabele za SVA TRI tipa doprinosa:
   - "Допринос за обавезно ПИО (24%)" - druga kolona u tabeli
   - "Допринос за обавезно ЗДР (10,3%)" - treća kolona u tabeli  
   - "Допринос за НЕЗ (0,75%)" - četvrta kolona u tabeli

2. Poziv na broj (traži "позивом на број" - samo brojevi, bez modela)

3. Godinu iz dokumenta

Računi su fiksni:
- PIO: 840-721313843-74
- Zdravstveno: 840-721325843-61
- Nezaposlenost: 840-721331843-06

Vrati odgovor SAMO kao validan JSON bez markdown formatiranja:
{
  "pio_amounts": [iznos1, iznos2, ..., iznos12],
  "zdravstveno_amounts": [iznos1, iznos2, ..., iznos12],
  "nezaposlenost_amounts": [iznos1, iznos2, ..., iznos12],
  "paymentReference": "samo brojevi bez modela 97",
  "year": 2025,
  "payerName": "ime obveznika ako postoji"
}

VAŽNO: Ako su svi mesečni iznosi jednaki, stavi isti iznos 12 puta u nizu.`;
    } else {
      systemPrompt = `Ti si AI asistent za ekstrakciju podataka iz PDF rešenja Poreske uprave Republike Srbije za paušalni porez.

Iz PDF teksta treba da ekstrakuješ:
- Mesečni iznos poreza (traži "Обрачуната месечна аконтација пореза на доходак грађана" ili slično)
- Račun za uplatu (traži "рачун број" - obično 840-711122843-32)
- Poziv na broj (traži "позивом на број" - samo brojevi, bez modela)
- Godinu iz dokumenta

Vrati odgovor SAMO kao validan JSON bez markdown formatiranja:
{
  "monthlyAmount": 9264.20,
  "recipientAccount": "840-711122843-32",
  "paymentReference": "samo brojevi bez modela 97",
  "year": 2025,
  "payerName": "ime obveznika ako postoji"
}`;
    }

    const userPrompt = `Ekstrakuj podatke iz sledećeg PDF teksta:

${pdfText.substring(0, 30000)}`;

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
      let jsonStr = content;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\s*/g, '');
      }
      parsedData = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      parsedData = {};
    }

    let result: ParsedPausalniData;

    if (type === 'doprinosi') {
      // Process doprinosi (all three types)
      const ensureArray = (amounts: number[] | number | undefined): number[] => {
        if (Array.isArray(amounts)) {
          return amounts.length === 12 ? amounts : Array(12).fill(amounts[0] || 0);
        }
        return Array(12).fill(amounts || 0);
      };

      result = {
        type: 'doprinosi',
        year: parsedData.year || new Date().getFullYear(),
        monthlyAmounts: [], // Not used for doprinosi
        contributions: {
          pio: {
            monthlyAmounts: ensureArray(parsedData.pio_amounts),
            recipientAccount: '840-721313843-74',
          },
          zdravstveno: {
            monthlyAmounts: ensureArray(parsedData.zdravstveno_amounts),
            recipientAccount: '840-721325843-61',
          },
          nezaposlenost: {
            monthlyAmounts: ensureArray(parsedData.nezaposlenost_amounts),
            recipientAccount: '840-721331843-06',
          },
        },
        recipientName: 'Пореска управа Републике Србије',
        recipientAccount: '840-721313843-74', // Default to PIO
        paymentModel: '97',
        paymentReference: parsedData.paymentReference || '',
        paymentCode: '253',
        payerName: parsedData.payerName || '',
      };
    } else {
      // Process porez
      result = {
        type: 'porez',
        year: parsedData.year || new Date().getFullYear(),
        monthlyAmounts: Array(12).fill(parsedData.monthlyAmount || 0),
        recipientName: 'Пореска управа Републике Србије',
        recipientAccount: parsedData.recipientAccount || '840-711122843-32',
        paymentModel: '97',
        paymentReference: parsedData.paymentReference || '',
        paymentCode: '253',
        payerName: parsedData.payerName || '',
      };
    }

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
