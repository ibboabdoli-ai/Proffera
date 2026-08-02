import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PublicWorkspaceQuoteOfferPdfData = {
  status: "sent" | "accepted" | "rejected";
  companyName: string;
  quoteReferenceId: string;
  customerName: string;
  currency: string;
  subtotalMinor: number;
  vatRateBasisPoints: number;
  vatAmountMinor: number;
  totalMinor: number;
  title: string;
  terms: string;
  validUntil: string;
  sentAt: string;
  acceptedAt: string;
  rejectedAt: string;
};

export type PublicWorkspaceQuoteOfferPdfLocale = "sv" | "en";

const a4 = { width: 595.28, height: 841.89 };
const margin = 48;
const bottomContentEdge = 70;
const darkGreen = rgb(16 / 255, 42 / 255, 28 / 255);
const forest = rgb(23 / 255, 62 / 255, 43 / 255);
const paleGreen = rgb(242 / 255, 248 / 255, 242 / 255);
const softInk = rgb(75 / 255, 91 / 255, 82 / 255);
const mutedInk = rgb(102 / 255, 113 / 255, 104 / 255);
const lineColor = rgb(220 / 255, 229 / 255, 218 / 255);

const copy = {
  sv: {
    document: "OFFERT",
    customer: "KUND",
    reference: "REFERENS",
    sent: "SKICKAD",
    validUntil: "GILTIG TILL",
    offer: "Offert",
    terms: "Villkor",
    subtotal: "Exkl. moms",
    vat: "Moms",
    total: "Totalt",
    secureNotice: "Dokumentet kommer från en säker personlig offertlänk.",
    statuses: { sent: "Skickad", accepted: "Accepterad", rejected: "Avslagen" },
  },
  en: {
    document: "QUOTE",
    customer: "CUSTOMER",
    reference: "REFERENCE",
    sent: "SENT",
    validUntil: "VALID UNTIL",
    offer: "Quote",
    terms: "Terms",
    subtotal: "Excluding VAT",
    vat: "VAT",
    total: "Total",
    secureNotice: "This document is available through a secure personal quote link.",
    statuses: { sent: "Sent", accepted: "Accepted", rejected: "Declined" },
  },
} as const;

function cleanPdfText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/€/g, "EUR")
    .replace(/£/g, "GBP")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}

function formatMoney(amountMinor: number, currency: string, locale: PublicWorkspaceQuoteOfferPdfLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string, locale: PublicWorkspaceQuoteOfferPdfLocale) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "long" }).format(parsed);
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  const parts: string[] = [];
  let current = "";

  for (const character of word) {
    const candidate = `${current}${character}`;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) parts.push(current);
  return parts;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];

  for (const paragraph of cleanPdfText(value).split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const fragments = font.widthOfTextAtSize(word, size) > maxWidth
        ? splitLongWord(word, font, size, maxWidth)
        : [word];

      for (const fragment of fragments) {
        const candidate = line ? `${line} ${fragment}` : fragment;
        if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          lines.push(line);
          line = fragment;
        } else {
          line = candidate;
        }
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function drawText(page: PDFPage, value: string, x: number, y: number, size: number, font: PDFFont, color = softInk) {
  page.drawText(cleanPdfText(value), { x, y, size, font, color });
}

function drawPageFooter(page: PDFPage, pageNumber: number, pageCount: number, locale: PublicWorkspaceQuoteOfferPdfLocale, regular: PDFFont) {
  const text = copy[locale];
  page.drawLine({ start: { x: margin, y: 52 }, end: { x: a4.width - margin, y: 52 }, color: lineColor, thickness: 0.7 });
  drawText(page, "Proffera", margin, 36, 8, regular, mutedInk);
  const pageText = `${pageNumber} / ${pageCount}`;
  drawText(page, pageText, a4.width - margin - regular.widthOfTextAtSize(pageText, 8), 36, 8, regular, mutedInk);
  drawText(page, text.secureNotice, margin, 22, 7, regular, mutedInk);
}

export function publicWorkspaceQuoteOfferPdfFilename(referenceId: string) {
  const safeReference = cleanPdfText(referenceId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `offert-${safeReference || "offer"}.pdf`;
}

export async function createPublicWorkspaceQuoteOfferPdf(
  offer: PublicWorkspaceQuoteOfferPdfData,
  locale: PublicWorkspaceQuoteOfferPdfLocale,
) {
  const text = copy[locale];
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`${text.offer} ${offer.quoteReferenceId}`);
  pdf.setAuthor(offer.companyName || "Proffera");
  pdf.setSubject(offer.title || text.offer);
  pdf.setCreator("Proffera");
  pdf.setProducer("Proffera");

  let page = pdf.addPage([a4.width, a4.height]);
  let y = 0;

  const startPage = (firstPage: boolean) => {
    if (!firstPage) page = pdf.addPage([a4.width, a4.height]);
    const headerHeight = firstPage ? 154 : 72;
    page.drawRectangle({ x: 0, y: a4.height - headerHeight, width: a4.width, height: headerHeight, color: darkGreen });
    drawText(page, text.document, margin, a4.height - 38, 9, bold, rgb(169 / 255, 219 / 255, 185 / 255));

    if (firstPage) {
      const companyLines = wrapText(offer.companyName || "Proffera", bold, 24, a4.width - margin * 2);
      let companyY = a4.height - 76;
      for (const line of companyLines.slice(0, 2)) {
        drawText(page, line, margin, companyY, 24, bold, rgb(1, 1, 1));
        companyY -= 29;
      }
      y = a4.height - headerHeight - 36;
    } else {
      drawText(page, offer.quoteReferenceId, margin, a4.height - 58, 12, bold, rgb(1, 1, 1));
      y = a4.height - headerHeight - 32;
    }
  };

  const ensureSpace = (height: number) => {
    if (y - height < bottomContentEdge) startPage(false);
  };

  const drawSectionTitle = (label: string) => {
    ensureSpace(30);
    drawText(page, label, margin, y, 12, bold, forest);
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: a4.width - margin, y }, color: lineColor, thickness: 0.8 });
    y -= 20;
  };

  const drawParagraph = (value: string, size = 10.5, lineHeight = 16) => {
    const lines = wrapText(value, regular, size, a4.width - margin * 2);
    for (const line of lines) {
      if (!line) {
        y -= lineHeight / 2;
        continue;
      }
      ensureSpace(lineHeight);
      drawText(page, line, margin, y, size, regular);
      y -= lineHeight;
    }
  };

  const drawInfoRow = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) => {
    const gap = 14;
    const cellWidth = (a4.width - margin * 2 - gap) / 2;
    const leftLines = wrapText(leftValue || "-", regular, 10.5, cellWidth - 24);
    const rightLines = wrapText(rightValue || "-", regular, 10.5, cellWidth - 24);
    const lineCount = Math.max(leftLines.length, rightLines.length, 1);
    const height = 42 + lineCount * 15;
    ensureSpace(height + 10);
    const top = y;

    for (const [x, label, lines] of [[margin, leftLabel, leftLines], [margin + cellWidth + gap, rightLabel, rightLines]] as const) {
      page.drawRectangle({ x, y: top - height, width: cellWidth, height, color: paleGreen, borderColor: lineColor, borderWidth: 0.6 });
      drawText(page, label, x + 12, top - 17, 7.5, bold, mutedInk);
      let valueY = top - 36;
      for (const line of lines) {
        drawText(page, line, x + 12, valueY, 10.5, regular);
        valueY -= 15;
      }
    }
    y -= height + 12;
  };

  startPage(true);
  drawInfoRow(text.customer, offer.customerName, text.reference, offer.quoteReferenceId);
  drawInfoRow(text.sent, formatDate(offer.sentAt, locale), text.validUntil, formatDate(offer.validUntil, locale));

  ensureSpace(86);
  const titleLines = wrapText(offer.title || text.offer, bold, 18, a4.width - margin * 2 - 36);
  const titleHeight = Math.max(78, 42 + titleLines.length * 23);
  page.drawRectangle({ x: margin, y: y - titleHeight, width: a4.width - margin * 2, height: titleHeight, color: paleGreen, borderColor: lineColor, borderWidth: 0.8 });
  let titleY = y - 28;
  for (const line of titleLines) {
    drawText(page, line, margin + 18, titleY, 18, bold, forest);
    titleY -= 23;
  }
  y -= titleHeight + 26;

  drawSectionTitle(text.terms);
  drawParagraph(offer.terms || "-", 10.5, 16);
  y -= 14;

  const totalBoxHeight = 130;
  ensureSpace(totalBoxHeight + 46);
  page.drawRectangle({ x: margin, y: y - totalBoxHeight, width: a4.width - margin * 2, height: totalBoxHeight, color: darkGreen });
  const totalRows = [
    [text.subtotal, formatMoney(offer.subtotalMinor, offer.currency, locale), 10.5, regular],
    [`${text.vat} (${offer.vatRateBasisPoints / 100}%)`, formatMoney(offer.vatAmountMinor, offer.currency, locale), 10.5, regular],
    [text.total, formatMoney(offer.totalMinor, offer.currency, locale), 16, bold],
  ] as const;
  let totalY = y - 28;
  for (const [label, value, size, font] of totalRows) {
    drawText(page, label, margin + 18, totalY, size, font, rgb(1, 1, 1));
    const valueWidth = font.widthOfTextAtSize(cleanPdfText(value), size);
    drawText(page, value, a4.width - margin - 18 - valueWidth, totalY, size, font, rgb(1, 1, 1));
    totalY -= size === 16 ? 26 : 21;
  }
  y -= totalBoxHeight + 20;

  ensureSpace(26);
  const statusLabel = `${text.statuses[offer.status]}`;
  drawText(page, `${text.offer}: ${statusLabel}`, margin, y, 9, bold, mutedInk);

  const pages = pdf.getPages();
  pages.forEach((documentPage, index) => drawPageFooter(documentPage, index + 1, pages.length, locale, regular));

  return pdf.save();
}
