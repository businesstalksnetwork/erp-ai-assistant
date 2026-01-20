// UBL XML Parser for SEF (Serbian e-Invoice System)

// Sanitize XML string to remove invalid characters that break DOMParser
function sanitizeXml(xml: string): string {
  return xml
    // Remove BOM
    .replace(/^\uFEFF/, '')
    // Remove control characters except tab, newline, carriage return
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Fix common encoding issues
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

// Remove large blocks using indexOf/substring (more reliable than regex for huge base64)
function removeBlocksUsingIndexOf(xml: string, startTag: string, endTag: string): string {
  let result = xml;
  let startIdx = result.indexOf(startTag);
  
  while (startIdx !== -1) {
    const endIdx = result.indexOf(endTag, startIdx);
    if (endIdx === -1) break;
    
    // Remove from startIdx to endIdx + endTag.length
    result = result.substring(0, startIdx) + result.substring(endIdx + endTag.length);
    startIdx = result.indexOf(startTag);
  }
  
  return result;
}

// Remove all large PDF/binary blocks using string manipulation
function removePdfAndBinaryBlocks(xml: string): string {
  let result = xml;
  
  // Remove DocumentPdf blocks (with various prefixes)
  result = removeBlocksUsingIndexOf(result, '<env:DocumentPdf', '</env:DocumentPdf>');
  result = removeBlocksUsingIndexOf(result, '<DocumentPdf', '</DocumentPdf>');
  
  // Remove EmbeddedDocumentBinaryObject blocks
  result = removeBlocksUsingIndexOf(result, '<cbc:EmbeddedDocumentBinaryObject', '</cbc:EmbeddedDocumentBinaryObject>');
  result = removeBlocksUsingIndexOf(result, '<EmbeddedDocumentBinaryObject', '</EmbeddedDocumentBinaryObject>');
  
  return result;
}

// Extract Invoice XML directly using indexOf (fastest and most reliable)
function extractInvoiceUsingIndexOf(xml: string): string | null {
  const startPatterns = ['<Invoice ', '<Invoice>'];
  const endTag = '</Invoice>';
  
  for (const startPattern of startPatterns) {
    const startIdx = xml.indexOf(startPattern);
    if (startIdx === -1) continue;
    
    const endIdx = xml.indexOf(endTag, startIdx);
    if (endIdx === -1) continue;
    
    const invoiceXml = xml.substring(startIdx, endIdx + endTag.length);
    if (invoiceXml.length > 100) {
      console.log(`[UBL Parser] Extracted Invoice via indexOf: ${invoiceXml.length} chars (pos ${startIdx}-${endIdx + endTag.length})`);
      return invoiceXml;
    }
  }
  
  return null;
}

// Extract Invoice from DocumentBody boundaries
function extractFromDocumentBody(xml: string): string | null {
  const bodyPatterns = [
    { start: '<env:DocumentBody', end: '</env:DocumentBody>' },
    { start: '<DocumentBody', end: '</DocumentBody>' },
  ];
  
  for (const pattern of bodyPatterns) {
    const bodyStartIdx = xml.indexOf(pattern.start);
    if (bodyStartIdx === -1) continue;
    
    const bodyEndIdx = xml.indexOf(pattern.end, bodyStartIdx);
    if (bodyEndIdx === -1) continue;
    
    const bodyContent = xml.substring(bodyStartIdx, bodyEndIdx + pattern.end.length);
    const invoiceXml = extractInvoiceUsingIndexOf(bodyContent);
    if (invoiceXml) {
      console.log(`[UBL Parser] Extracted Invoice from DocumentBody: ${invoiceXml.length} chars`);
      return invoiceXml;
    }
  }
  
  return null;
}

export interface ParsedSEFInvoice {
  // Basic info
  invoiceNumber: string;
  sefId: string;
  issueDate: string;
  dueDate?: string;
  serviceDate?: string;
  currency: string;
  
  // Supplier
  supplier: {
    name: string;
    address: string;
    city: string;
    postalCode?: string;
    pib: string;
    maticniBroj?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  
  // Customer
  customer: {
    name: string;
    address: string;
    city: string;
    postalCode?: string;
    pib: string;
    maticniBroj?: string;
  };
  
  // Line items
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    unitOfMeasure: string;
    discount?: number;
    netAmount: number;
    vatRate: number;
  }>;
  
  // Amounts
  subtotal: number;
  vatBreakdown: Array<{
    rate: number;
    base: number;
    amount: number;
  }>;
  totalVat: number;
  totalAmount: number;
  payableAmount: number;
  
  // Additional
  note?: string;
  paymentReference?: string;
  bankAccount?: string;
}

// Helper to get text content from XML element
function getTextContent(element: Element | null): string {
  return element?.textContent?.trim() || '';
}

// Helper to find element by tag name (handles namespaces)
function findElement(parent: Element | Document, tagName: string): Element | null {
  // Try with common namespace prefixes
  const prefixes = ['', 'cbc:', 'cac:', 'ubl:', 'Invoice:'];
  for (const prefix of prefixes) {
    const el = parent.getElementsByTagName(prefix + tagName)[0];
    if (el) return el;
  }
  // Try local name match
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === tagName) return all[i];
  }
  return null;
}

// Helper to find all elements by tag name
function findAllElements(parent: Element | Document, tagName: string): Element[] {
  const results: Element[] = [];
  const prefixes = ['', 'cbc:', 'cac:', 'ubl:', 'Invoice:'];
  
  for (const prefix of prefixes) {
    const elements = parent.getElementsByTagName(prefix + tagName);
    for (let i = 0; i < elements.length; i++) {
      results.push(elements[i]);
    }
  }
  
  // Also try by local name
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === tagName && !results.includes(all[i])) {
      results.push(all[i]);
    }
  }
  
  return results;
}

// Parse party (supplier or customer) from XML
function parseParty(partyElement: Element | null): ParsedSEFInvoice['supplier'] {
  if (!partyElement) {
    return { name: '', address: '', city: '', pib: '' };
  }
  
  const partyName = findElement(partyElement, 'PartyName');
  const name = getTextContent(findElement(partyName || partyElement, 'Name'));
  
  const postalAddress = findElement(partyElement, 'PostalAddress');
  const streetName = getTextContent(findElement(postalAddress, 'StreetName'));
  const buildingNumber = getTextContent(findElement(postalAddress, 'BuildingNumber'));
  const address = buildingNumber ? `${streetName} ${buildingNumber}` : streetName;
  const city = getTextContent(findElement(postalAddress, 'CityName'));
  const postalCode = getTextContent(findElement(postalAddress, 'PostalZone'));
  
  const partyTaxScheme = findElement(partyElement, 'PartyTaxScheme');
  const pib = getTextContent(findElement(partyTaxScheme, 'CompanyID'));
  
  const partyLegalEntity = findElement(partyElement, 'PartyLegalEntity');
  const maticniBroj = getTextContent(findElement(partyLegalEntity, 'CompanyID'));
  
  const contact = findElement(partyElement, 'Contact');
  const email = getTextContent(findElement(contact, 'ElectronicMail'));
  const phone = getTextContent(findElement(contact, 'Telephone'));
  
  const website = getTextContent(findElement(partyElement, 'WebsiteURI'));
  
  return {
    name,
    address,
    city,
    postalCode,
    pib,
    maticniBroj,
    email,
    phone,
    website
  };
}

// Parse invoice line items
function parseLineItems(doc: Document): ParsedSEFInvoice['items'] {
  const items: ParsedSEFInvoice['items'] = [];
  const invoiceLines = findAllElements(doc, 'InvoiceLine');
  
  for (const line of invoiceLines) {
    const item = findElement(line, 'Item');
    const description = getTextContent(findElement(item, 'Name')) || 
                       getTextContent(findElement(item, 'Description'));
    
    const quantity = parseFloat(getTextContent(findElement(line, 'InvoicedQuantity'))) || 1;
    
    const price = findElement(line, 'Price');
    const unitPrice = parseFloat(getTextContent(findElement(price, 'PriceAmount'))) || 0;
    
    const quantityEl = findElement(line, 'InvoicedQuantity');
    const unitOfMeasure = quantityEl?.getAttribute('unitCode') || 'kom';
    
    const lineExtensionAmount = parseFloat(getTextContent(findElement(line, 'LineExtensionAmount'))) || 0;
    
    const taxCategory = findElement(item, 'ClassifiedTaxCategory') || findElement(line, 'TaxCategory');
    const vatRate = parseFloat(getTextContent(findElement(taxCategory, 'Percent'))) || 0;
    
    const allowanceCharge = findElement(line, 'AllowanceCharge');
    const discount = allowanceCharge ? 
      parseFloat(getTextContent(findElement(allowanceCharge, 'Amount'))) : undefined;
    
    items.push({
      description,
      quantity,
      unitPrice,
      unitOfMeasure,
      discount,
      netAmount: lineExtensionAmount,
      vatRate
    });
  }
  
  return items;
}

// Parse VAT breakdown
function parseVatBreakdown(doc: Document): ParsedSEFInvoice['vatBreakdown'] {
  const breakdown: ParsedSEFInvoice['vatBreakdown'] = [];
  const taxSubtotals = findAllElements(doc, 'TaxSubtotal');
  
  for (const subtotal of taxSubtotals) {
    const taxCategory = findElement(subtotal, 'TaxCategory');
    const rate = parseFloat(getTextContent(findElement(taxCategory, 'Percent'))) || 0;
    const base = parseFloat(getTextContent(findElement(subtotal, 'TaxableAmount'))) || 0;
    const amount = parseFloat(getTextContent(findElement(subtotal, 'TaxAmount'))) || 0;
    
    if (rate > 0 || base > 0 || amount > 0) {
      breakdown.push({ rate, base, amount });
    }
  }
  
  return breakdown;
}

// Extract Invoice XML from SEF DocumentEnvelope wrapper
export function extractInvoiceFromEnvelope(xmlString: string): string {
  // Check if this is a SEF envelope structure
  const isEnvelope = xmlString.includes('<env:DocumentEnvelope') || 
                     xmlString.includes('DocumentEnvelope') ||
                     xmlString.includes('<env:DocumentBody');
  
  if (!isEnvelope) {
    return xmlString;
  }
  
  console.log(`[UBL Parser] Processing SEF envelope: ${xmlString.length} chars`);
  
  // STEP 1: Try direct extraction FIRST (before removing PDF - fastest path)
  let invoiceXml = extractInvoiceUsingIndexOf(xmlString);
  if (invoiceXml && invoiceXml.length > 100) {
    return sanitizeXml(invoiceXml);
  }
  
  // STEP 2: Try extraction from DocumentBody
  invoiceXml = extractFromDocumentBody(xmlString);
  if (invoiceXml && invoiceXml.length > 100) {
    return sanitizeXml(invoiceXml);
  }
  
  // STEP 3: Remove PDF/binary blocks using indexOf (not regex!)
  console.log('[UBL Parser] Removing PDF/binary blocks...');
  const cleanedXml = removePdfAndBinaryBlocks(xmlString);
  console.log(`[UBL Parser] After removal: ${cleanedXml.length} chars (removed ${xmlString.length - cleanedXml.length} chars)`);
  
  // STEP 4: Try extraction again on cleaned XML
  invoiceXml = extractInvoiceUsingIndexOf(cleanedXml);
  if (invoiceXml && invoiceXml.length > 100) {
    return sanitizeXml(invoiceXml);
  }
  
  // STEP 5: Try DOM parsing on cleaned XML
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizeXml(cleanedXml), 'text/xml');
    
    const parseError = doc.querySelector('parsererror');
    if (!parseError) {
      const allElements = doc.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        if (allElements[i].localName === 'Invoice') {
          const serializer = new XMLSerializer();
          const serialized = serializer.serializeToString(allElements[i]);
          if (serialized && serialized.length > 100) {
            console.log('[UBL Parser] Extracted Invoice via DOM:', serialized.length, 'chars');
            return sanitizeXml(serialized);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[UBL Parser] DOM extraction failed:', e);
  }
  
  // STEP 6: Return cleaned XML as last resort
  console.log('[UBL Parser] Returning cleaned XML:', cleanedXml.length, 'chars');
  return sanitizeXml(cleanedXml);
}

// Main parser function
export function parseUBLInvoice(xmlString: string): ParsedSEFInvoice | null {
  if (!xmlString || xmlString.trim().length === 0) {
    console.warn('Empty XML string provided');
    return null;
  }

  const parser = new DOMParser();

  // Sanitize input first
  const sanitized = sanitizeXml(xmlString);

  // Attempt 1: Extract invoice from envelope with full sanitization
  try {
    const invoiceXml = extractInvoiceFromEnvelope(sanitized);
    const doc = parser.parseFromString(invoiceXml, 'text/xml');
    
    const parseError = doc.querySelector('parsererror');
    if (!parseError) {
      const result = parseFromDocument(doc);
      if (result && result.invoiceNumber) return result;
    }
  } catch (e) {
    console.warn('Attempt 1 failed:', e);
  }

  // Attempt 2: Parse sanitized original XML directly
  try {
    const doc = parser.parseFromString(sanitized, 'text/xml');
    
    const parseError = doc.querySelector('parsererror');
    if (!parseError) {
      const result = parseFromDocument(doc);
      if (result && result.invoiceNumber) return result;
    }
  } catch (e) {
    console.warn('Attempt 2 failed:', e);
  }

  // Attempt 3: Extract from DocumentBody using regex
  try {
    const bodyInvoice = extractFromDocumentBody(sanitized);
    if (bodyInvoice) {
      const doc = parser.parseFromString(sanitizeXml(bodyInvoice), 'text/xml');
      const parseError = doc.querySelector('parsererror');
      if (!parseError) {
        const result = parseFromDocument(doc);
        if (result && result.invoiceNumber) return result;
      }
    }
  } catch (e) {
    console.warn('Attempt 3 failed:', e);
  }

  // Attempt 4: Aggressive regex extraction of Invoice element
  try {
    // Remove all base64 content first
    let cleaned = sanitized.replace(/<[^>]*Binary[^>]*>[^<]*<\/[^>]*Binary[^>]*>/gi, '');
    cleaned = cleaned.replace(/<env:DocumentPdf[^>]*>[\s\S]*?<\/env:DocumentPdf>/gi, '');
    cleaned = cleaned.replace(/<DocumentPdf[^>]*>[\s\S]*?<\/DocumentPdf>/gi, '');
    
    const invoiceMatch = cleaned.match(/<(?:\w+:)?Invoice[^>]*xmlns[^>]*>[\s\S]*?<\/(?:\w+:)?Invoice>/i);
    if (invoiceMatch) {
      const doc = parser.parseFromString(sanitizeXml(invoiceMatch[0]), 'text/xml');
      const parseError = doc.querySelector('parsererror');
      if (!parseError) {
        const result = parseFromDocument(doc);
        if (result) return result;
      }
    }
  } catch (e) {
    console.warn('Attempt 4 failed:', e);
  }

  console.error('All parsing attempts failed for UBL invoice');
  return null;
}

// Parse from DOM Document
function parseFromDocument(doc: Document): ParsedSEFInvoice | null {
  try {
    
    // Basic info
    const invoiceNumber = getTextContent(findElement(doc, 'ID'));
    const sefId = getTextContent(findElement(doc, 'UUID')) || 
                  doc.documentElement.getAttribute('UUID') || '';
    const issueDate = getTextContent(findElement(doc, 'IssueDate'));
    const dueDate = getTextContent(findElement(doc, 'DueDate'));
    
    // Service date (can be in different elements)
    const invoicePeriod = findElement(doc, 'InvoicePeriod');
    const serviceDate = getTextContent(findElement(invoicePeriod, 'EndDate')) ||
                       getTextContent(findElement(doc, 'TaxPointDate'));
    
    // Currency
    const currencyEl = findElement(doc, 'DocumentCurrencyCode');
    const currency = getTextContent(currencyEl) || 'RSD';
    
    // Parties
    const supplierParty = findElement(doc, 'AccountingSupplierParty');
    const supplier = parseParty(findElement(supplierParty, 'Party'));
    
    const customerParty = findElement(doc, 'AccountingCustomerParty');
    const customer = parseParty(findElement(customerParty, 'Party'));
    
    // Line items
    const items = parseLineItems(doc);
    
    // Monetary totals
    const legalMonetaryTotal = findElement(doc, 'LegalMonetaryTotal');
    const subtotal = parseFloat(getTextContent(findElement(legalMonetaryTotal, 'LineExtensionAmount'))) || 
                    parseFloat(getTextContent(findElement(legalMonetaryTotal, 'TaxExclusiveAmount'))) || 0;
    const totalAmount = parseFloat(getTextContent(findElement(legalMonetaryTotal, 'TaxInclusiveAmount'))) || 0;
    const payableAmount = parseFloat(getTextContent(findElement(legalMonetaryTotal, 'PayableAmount'))) || totalAmount;
    
    // VAT
    const taxTotal = findElement(doc, 'TaxTotal');
    const totalVat = parseFloat(getTextContent(findElement(taxTotal, 'TaxAmount'))) || 0;
    const vatBreakdown = parseVatBreakdown(doc);
    
    // Payment info
    const paymentMeans = findElement(doc, 'PaymentMeans');
    const paymentReference = getTextContent(findElement(paymentMeans, 'PaymentID')) ||
                            getTextContent(findElement(doc, 'PaymentMeansCode'));
    
    const payeeAccount = findElement(paymentMeans, 'PayeeFinancialAccount');
    const bankAccount = getTextContent(findElement(payeeAccount, 'ID'));
    
    // Note
    const note = getTextContent(findElement(doc, 'Note'));
    
    return {
      invoiceNumber,
      sefId,
      issueDate,
      dueDate,
      serviceDate,
      currency,
      supplier,
      customer,
      items,
      subtotal,
      vatBreakdown,
      totalVat,
      totalAmount,
      payableAmount,
      note,
      paymentReference,
      bankAccount
    };
  } catch (error) {
    console.error('Error in parseFromDocument:', error);
    return null;
  }
}

// Format date from YYYY-MM-DD to DD.MM.YYYY
export function formatSEFDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

// Format currency amount
export function formatSEFAmount(amount: number, currency: string = 'RSD'): string {
  return new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' ' + currency;
}
