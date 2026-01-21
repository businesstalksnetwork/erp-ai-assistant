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
  monthlyAmounts: number[];
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

// Fixed account numbers for Serbian tax authority
const ACCOUNTS = {
  porez: '840-711122843-32',
  pio: '840-721313843-74',
  zdravstveno: '840-721325843-61',
  nezaposlenost: '840-721331843-06',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { pdfBase64, type } = body;
    
    if (!pdfBase64 || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing pdfBase64 or type parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing PDF for type: ${type}, base64 length: ${pdfBase64.length}`);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt: string;
    
    if (type === 'doprinosi') {
      systemPrompt = `Ti si AI asistent za ekstrakciju podataka iz PDF rešenja Poreske uprave Republike Srbije za paušalne doprinose (PAUS-RESDOP).

KRITIČNO - TAČNI PODACI koje treba ekstraktovati:

1. GODINA: Pronađi "за период од 01.01.YYYY. до 31.12.YYYY. године" - to je godina dokumenta (npr. 2025)

2. MESEČNI IZNOSI sa DVE DECIMALE:
   - "Допринос за обавезно ПИО (24%)" - npr. 22234.09
   - "Допринос за обавезно ЗДР (10,3%)" - npr. 9542.13
   - "Допринос за НЕЗ (0,75%)" - npr. 694.82
   
   Iznosi u PDF-u su formatirani kao "22.234,09" - konvertuj u broj: 22234.09

3. POZIV NA BROJ: Pronađi "позивом на број: 97 XXXXXXXXXXXXXXXXXXX" 
   - Uzmi SAMO brojeve posle "97", bez samog "97"
   - Primer: ako piše "97 2322390000006200242", vrati "2322390000006200242"

4. IME OBVEZNIKA: Pronađi ime poreskog obveznika

Vrati odgovor SAMO kao validan JSON bez markdown formatiranja:
{
  "year": 2025,
  "pio_amount": 22234.09,
  "zdravstveno_amount": 9542.13,
  "nezaposlenost_amount": 694.82,
  "paymentReference": "2322390000006200242",
  "payerName": "Ime Prezime PR"
}

VAŽNO:
- Svi iznosi moraju biti BROJEVI sa dve decimale (ne stringovi)
- Godina mora biti 4-cifreni broj (2024, 2025, 2026...)
- paymentReference je SAMO brojevi, bez modela "97"`;
    } else {
      systemPrompt = `Ti si AI asistent za ekstrakciju podataka iz PDF rešenja Poreske uprave Republike Srbije za paušalni porez (PAUS-RESPOR).

KRITIČNO - TAČNI PODACI koje treba ekstraktovati:

1. GODINA: Pronađi "за период од 01.01.YYYY. до 31.12.YYYY. године" - to je godina dokumenta (npr. 2025)

2. MESEČNI IZNOS POREZA sa DVE DECIMALE:
   - "Обрачуната месечна аконтација пореза на доходак грађана"
   - Iznos u PDF-u je formatiran kao "9.264,20" - konvertuj u broj: 9264.20

3. POZIV NA BROJ: Pronađi "позивом на број: 97 XXXXXXXXXXXXXXXXXXX"
   - Uzmi SAMO brojeve posle "97", bez samog "97"
   - Primer: ako piše "97 2322390000006200242", vrati "2322390000006200242"

4. IME OBVEZNIKA: Pronađi ime poreskog obveznika

Vrati odgovor SAMO kao validan JSON bez markdown formatiranja:
{
  "year": 2025,
  "monthlyAmount": 9264.20,
  "paymentReference": "2322390000006200242",
  "payerName": "Ime Prezime PR"
}

VAŽNO:
- monthlyAmount mora biti BROJ sa dve decimale (ne string)
- Godina mora biti 4-cifreni broj (2024, 2025, 2026...)
- paymentReference je SAMO brojevi, bez modela "97"`;
    }

    console.log('Calling AI API with multimodal PDF input...');
    
    // Use multimodal input - send PDF directly to Gemini
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
          { 
            role: 'user', 
            content: [
              {
                type: 'file',
                file: {
                  filename: 'resenje.pdf',
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              },
              {
                type: 'text',
                text: 'Ekstrakuj podatke iz ovog PDF rešenja Poreske uprave Srbije. Pročitaj dokument pažljivo i vrati tačne vrednosti.'
              }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
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
      console.error('Raw content:', content);
      throw new Error('Greška pri parsiranju odgovora. Pokušajte ponovo.');
    }

    // Validate year
    if (!parsedData.year || parsedData.year < 2024 || parsedData.year > 2030) {
      console.warn('Invalid year detected:', parsedData.year, '- using current year');
      parsedData.year = new Date().getFullYear();
    }

    let result: ParsedPausalniData;

    if (type === 'doprinosi') {
      // Validate amounts
      const pioAmount = Number(parsedData.pio_amount) || 0;
      const zdravstvenoAmount = Number(parsedData.zdravstveno_amount) || 0;
      const nezaposlenostAmount = Number(parsedData.nezaposlenost_amount) || 0;

      if (pioAmount < 1000) {
        console.warn('PIO amount seems too low:', pioAmount);
      }

      result = {
        type: 'doprinosi',
        year: parsedData.year,
        monthlyAmounts: [],
        contributions: {
          pio: {
            monthlyAmounts: Array(12).fill(pioAmount),
            recipientAccount: ACCOUNTS.pio,
          },
          zdravstveno: {
            monthlyAmounts: Array(12).fill(zdravstvenoAmount),
            recipientAccount: ACCOUNTS.zdravstveno,
          },
          nezaposlenost: {
            monthlyAmounts: Array(12).fill(nezaposlenostAmount),
            recipientAccount: ACCOUNTS.nezaposlenost,
          },
        },
        recipientName: 'Пореска управа Републике Србије',
        recipientAccount: ACCOUNTS.pio,
        paymentModel: '97',
        paymentReference: String(parsedData.paymentReference || '').replace(/\s/g, ''),
        paymentCode: '253',
        payerName: parsedData.payerName || '',
      };
    } else {
      // Process porez
      const monthlyAmount = Number(parsedData.monthlyAmount) || 0;

      if (monthlyAmount < 1000) {
        console.warn('Tax amount seems too low:', monthlyAmount);
      }

      result = {
        type: 'porez',
        year: parsedData.year,
        monthlyAmounts: Array(12).fill(monthlyAmount),
        recipientName: 'Пореска управа Републике Србије',
        recipientAccount: ACCOUNTS.porez,
        paymentModel: '97',
        paymentReference: String(parsedData.paymentReference || '').replace(/\s/g, ''),
        paymentCode: '253',
        payerName: parsedData.payerName || '',
      };
    }

    console.log('Parsed result:', JSON.stringify(result, null, 2));

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
