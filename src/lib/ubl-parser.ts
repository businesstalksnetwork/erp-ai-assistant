// UBL XML Parser for SEF (Serbian e-Invoice System)

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

// Extract Invoice XML from SEF DocumentEnvelope wrapper using DOM-based approach
function extractInvoiceFromEnvelope(xmlString: string): string {
  // Check if this is a SEF envelope structure
  const isEnvelope = xmlString.includes('<env:DocumentEnvelope') || 
                     xmlString.includes('DocumentEnvelope') ||
                     xmlString.includes('<env:DocumentBody');
  
  if (!isEnvelope) {
    return xmlString;
  }
  
  console.log('Detected SEF envelope structure, attempting extraction...');
  
  // Method 1: DOM-based extraction (most reliable)
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    // Check for parse errors in envelope
    if (!doc.querySelector('parsererror')) {
      // Find Invoice element by localName (handles any prefix)
      const allElements = doc.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        if (allElements[i].localName === 'Invoice') {
          const invoiceEl = allElements[i];
          const serializer = new XMLSerializer();
          const invoiceXml = serializer.serializeToString(invoiceEl);
          console.log('Extracted Invoice via DOM, length:', invoiceXml.length);
          return invoiceXml;
        }
      }
    }
  } catch (e) {
    console.warn('DOM extraction failed:', e);
  }
  
  // Method 2: Enhanced regex extraction (fallback)
  // First, try to remove the large DocumentPdf block to speed up regex
  let cleanedXml = xmlString;
  const pdfBlockMatch = xmlString.match(/<env:DocumentPdf[^>]*>[\s\S]*?<\/env:DocumentPdf>/);
  if (pdfBlockMatch) {
    cleanedXml = xmlString.replace(pdfBlockMatch[0], '');
    console.log('Removed DocumentPdf block for faster regex processing');
  }
  
  // Try regex patterns with various prefixes
  const patterns = [
    // Standard Invoice with namespace
    /<Invoice\s+[^>]*xmlns[^>]*>[\s\S]*<\/Invoice>/,
    // Invoice without namespace declaration  
    /<Invoice[^>]*>[\s\S]*<\/Invoice>/,
    // Prefixed Invoice (e.g., ubl:Invoice)
    /<\w+:Invoice[^>]*>[\s\S]*<\/\w+:Invoice>/
  ];
  
  for (const pattern of patterns) {
    const match = cleanedXml.match(pattern);
    if (match) {
      console.log('Extracted Invoice via regex, length:', match[0].length);
      return match[0];
    }
  }
  
  // If cleaned XML failed, try original XML
  if (cleanedXml !== xmlString) {
    for (const pattern of patterns) {
      const match = xmlString.match(pattern);
      if (match) {
        console.log('Extracted Invoice from original XML, length:', match[0].length);
        return match[0];
      }
    }
  }
  
  console.warn('Could not extract Invoice from envelope structure');
  return xmlString;
}

// Main parser function
export function parseUBLInvoice(xmlString: string): ParsedSEFInvoice | null {
  try {
    // First, extract Invoice from envelope if needed
    const invoiceXml = extractInvoiceFromEnvelope(xmlString);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(invoiceXml, 'text/xml');
    
    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parse error:', parseError.textContent);
      // If parsing extracted invoice fails, try original
      if (invoiceXml !== xmlString) {
        console.log('Retrying with original XML...');
        const origDoc = parser.parseFromString(xmlString, 'text/xml');
        if (!origDoc.querySelector('parsererror')) {
          return parseFromDocument(origDoc);
        }
      }
      return null;
    }
    
    return parseFromDocument(doc);
  } catch (error) {
    console.error('Error parsing UBL XML:', error);
    return null;
  }
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
