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

// Extract readable text from PDF binary data
function extractTextFromPdf(data: Uint8Array): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
  
  const extractedParts: string[] = [];
  
  // Extract text between stream and endstream markers
  let pos = 0;
  while (pos < text.length) {
    const streamStart = text.indexOf('stream', pos);
    if (streamStart === -1) break;
    
    const streamEnd = text.indexOf('endstream', streamStart);
    if (streamEnd === -1) break;
    
    const content = text.substring(streamStart + 6, streamEnd);
    // Look for text in parentheses (PDF text operators)
    const textMatches = content.match(/\(([^)]+)\)/g);
    if (textMatches) {
      extractedParts.push(...textMatches.map(m => m.slice(1, -1)));
    }
    pos = streamEnd + 9;
  }
  
  // Also try to find Unicode/Cyrillic text patterns directly
  const cyrillicMatches = text.match(/[\u0400-\u04FF\u0020-\u007F]{3,}/g);
  if (cyrillicMatches) {
    extractedParts.push(...cyrillicMatches);
  }
  
  // Extract numbers that look like amounts (e.g., 22.234,09 or 9264.20)
  const amountMatches = text.match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g);
  if (amountMatches) {
    extractedParts.push(...amountMatches);
  }
  
  // Extract year patterns
  const yearMatches = text.match(/20[2-3]\d/g);
  if (yearMatches) {
    extractedParts.push(...yearMatches);
  }
  
  // Join all extracted parts
  let extracted = extractedParts.join(' ');
  
  // If we got very little text, also include cleaned raw content
  if (extracted.length < 500) {
    const cleanedRaw = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
      .replace(/[^\u0000-\u007F\u0400-\u04FF\s.,;:!?()-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    extracted = extracted + ' ' + cleanedRaw.substring(0, 40000);
  }
  
  return extracted;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { pdfBase64, pdfText: legacyPdfText, type } = body;
    
    if ((!pdfBase64 && !legacyPdfText) || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing pdfBase64/pdfText or type parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing PDF for type: ${type}`);

    let pdfText: string;
    
    if (pdfBase64) {
      // Decode base64 to buffer
      console.log(`PDF base64 length: ${pdfBase64.length}`);
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Extract text from PDF
      pdfText = extractTextFromPdf(bytes);
      console.log('Extracted text length:', pdfText.length);
      console.log('First 2000 chars:', pdfText.substring(0, 2000));
    } else {
      // Legacy support for pdfText parameter
      pdfText = legacyPdfText;
      console.log(`Legacy PDF text length: ${pdfText.length}`);
    }

    if (!pdfText || pdfText.length < 50) {
      throw new Error('PDF ne sadrži dovoljno teksta za obradu.');
    }

    // Try to extract year directly from text first
    let detectedYear: number | null = null;
    const yearPatterns = [
      /за\s*(\d{4})\.\s*годин/i,
      /(\d{4})\.\s*ГОДИН/i,
      /у\s*(\d{4})\.\s*годин/i,
      /za\s*(\d{4})\.\s*godin/i,
      /(\d{4})\.\s*godin/i,
    ];
    
    for (const pattern of yearPatterns) {
      const match = pdfText.match(pattern);
      if (match) {
        detectedYear = parseInt(match[1], 10);
        console.log('Detected year from regex:', detectedYear);
        break;
      }
    }
    
    // Also look for standalone year in expected range
    if (!detectedYear) {
      const allYears = pdfText.match(/20[2][0-9]/g);
      if (allYears && allYears.length > 0) {
        // Find most common year
        const yearCounts: Record<string, number> = {};
        allYears.forEach(y => {
          yearCounts[y] = (yearCounts[y] || 0) + 1;
        });
        const sortedYears = Object.entries(yearCounts).sort((a, b) => b[1] - a[1]);
        if (sortedYears.length > 0) {
          detectedYear = parseInt(sortedYears[0][0], 10);
          console.log('Detected year from frequency:', detectedYear, 'count:', sortedYears[0][1]);
        }
      }
    }

    // Call Lovable AI to extract structured data
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt: string;
    
    if (type === 'doprinosi') {
      systemPrompt = `Ti si AI asistent za ekstrakciju podataka iz PDF rešenja Poreske uprave Republike Srbije za paušalne doprinose (PAUS-RESDOP).

Iz PDF teksta treba da ekstrakuješ:

1. GODINU - OVO JE KRITIČNO! ${detectedYear ? `Detektovana godina iz dokumenta je: ${detectedYear}` : 'Traži eksplicitno godinu u dokumentu.'}
   NIKADA ne koristi trenutnu godinu! Godina MORA biti iz dokumenta.

2. Mesečne iznose iz tabele za SVA TRI tipa doprinosa:
   - "Допринос за обавезно ПИО (24%)" - PIO doprinos
   - "Допринос за обавезно ЗДР (10,3%)" - Zdravstveno doprinos  
   - "Допринос за НЕЗ (0,75%)" - Nezaposlenost doprinos
   
   Iznosi su obično u formatu "22.234,09" (sa tačkom kao separator hiljada i zarezom za decimale).
   Konvertuj u decimalni broj: 22234.09

3. Poziv na broj (traži "позивом на број" - samo brojevi, bez modela 97)

Vrati odgovor SAMO kao validan JSON bez markdown formatiranja:
{
  "pio_amounts": [iznos1, iznos2, ..., iznos12],
  "zdravstveno_amounts": [iznos1, iznos2, ..., iznos12],
  "nezaposlenost_amounts": [iznos1, iznos2, ..., iznos12],
  "paymentReference": "samo brojevi bez modela 97",
  "year": ${detectedYear || 2025},
  "payerName": "ime obveznika ako postoji"
}

VAŽNO: 
- Ako su svi mesečni iznosi jednaki, stavi isti iznos 12 puta u nizu.
- Iznosi moraju biti brojevi (ne stringovi), npr. 22234.09 ne "22.234,09"
- Godina: ${detectedYear || 'izvuci iz dokumenta'}`;
    } else {
      systemPrompt = `Ti si AI asistent za ekstrakciju podataka iz PDF rešenja Poreske uprave Republike Srbije za paušalni porez (PAUS-RESPOR).

Iz PDF teksta treba da ekstrakuješ:

1. GODINU - OVO JE KRITIČNO! ${detectedYear ? `Detektovana godina iz dokumenta je: ${detectedYear}` : 'Traži eksplicitno godinu u dokumentu.'}
   NIKADA ne koristi trenutnu godinu! Godina MORA biti iz dokumenta.

2. Mesečni iznos poreza - traži:
   - "Обрачуната месечна аконтација пореза на доходак грађана"
   - "месечна аконтација" 
   - Iznos u formatu "9.264,20" ili slično
   - Konvertuj u decimalni broj: 9264.20

3. Račun za uplatu (traži "рачун број" - obično 840-711122843-32)

4. Poziv na broj (traži "позивом на број" - samo brojevi, bez modela 97)

Vrati odgovor SAMO kao validan JSON bez markdown formatiranja:
{
  "monthlyAmount": 9264.20,
  "recipientAccount": "840-711122843-32",
  "paymentReference": "samo brojevi bez modela 97",
  "year": ${detectedYear || 2025},
  "payerName": "ime obveznika ako postoji"
}

VAŽNO:
- monthlyAmount mora biti broj (ne string), npr. 9264.20 ne "9.264,20"
- Godina: ${detectedYear || 'izvuci iz dokumenta'}`;
    }

    const userPrompt = `Ekstrakuj podatke iz sledećeg PDF teksta rešenja Poreske uprave:

${pdfText.substring(0, 30000)}`;

    console.log('Calling AI API...');
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
      console.error('Raw content:', content);
      throw new Error('Greška pri parsiranju odgovora. Pokušajte ponovo.');
    }

    // Use detected year if AI didn't find one
    if (!parsedData.year || parsedData.year < 2020 || parsedData.year > 2030) {
      parsedData.year = detectedYear || 2025;
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
        year: parsedData.year,
        monthlyAmounts: [],
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
        recipientAccount: '840-721313843-74',
        paymentModel: '97',
        paymentReference: parsedData.paymentReference || '',
        paymentCode: '253',
        payerName: parsedData.payerName || '',
      };
    } else {
      // Process porez
      result = {
        type: 'porez',
        year: parsedData.year,
        monthlyAmounts: Array(12).fill(parsedData.monthlyAmount || 0),
        recipientName: 'Пореска управа Републике Србије',
        recipientAccount: parsedData.recipientAccount || '840-711122843-32',
        paymentModel: '97',
        paymentReference: parsedData.paymentReference || '',
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
