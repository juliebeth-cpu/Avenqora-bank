type LogoAsset = {
  buffer: Buffer;
  aspectRatio: number;
};

type BankingRegion = "USA" | "EUROPE";

type TransferReceiptPdfInput = {
  receipt: {
    receiptNumber: string;
    amount: string;
    grossAmount?: string | null;
    fee?: string | null;
    currency: string;
    status: string;
    issuedAt: Date | string;
    paymentMethod?: string | null;
    reference?: string | null;
    transferType?: string | null;
    senderName?: string | null;
    senderAccount?: string | null;
    accountType?: string | null;
    recipientName?: string | null;
    recipientAccount?: string | null;
    beneficiaryBankName?: string | null;
    recipientIban?: string | null;
    swiftBic?: string | null;
    routingNumber?: string | null;
    paymentReference?: string | null;
    orderAt?: Date | string | null;
    executionAt?: Date | string | null;
    totalDebit?: string;
    rejectionReason?: string | null;
  };
  context: {
    websiteName: string;
    websiteType?: string | null;
    bankingRegion: BankingRegion | null;
    bankingCountry?: string | null;
    timeZone?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
    privacyPolicyUrl?: string | null;
    logo?: LogoAsset | null;
  };
};

function formatMoney(value: string | null | undefined, currency: string, locale: string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch {
    return `${currency.toUpperCase()} ${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue)}`;
  }
}

const COUNTRY_TIME_ZONES: Record<string, string> = {
  AT: "Europe/Vienna", BE: "Europe/Brussels", BG: "Europe/Sofia",
  CH: "Europe/Zurich", CY: "Europe/Nicosia", CZ: "Europe/Prague",
  DE: "Europe/Berlin", DK: "Europe/Copenhagen", EE: "Europe/Tallinn",
  ES: "Europe/Madrid", FI: "Europe/Helsinki", FR: "Europe/Paris",
  GB: "Europe/London", GR: "Europe/Athens", HR: "Europe/Zagreb",
  HU: "Europe/Budapest", IE: "Europe/Dublin", IS: "Atlantic/Reykjavik",
  IT: "Europe/Rome", LI: "Europe/Vaduz", LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg", LV: "Europe/Riga", MC: "Europe/Monaco",
  MD: "Europe/Chisinau", ME: "Europe/Podgorica", MK: "Europe/Skopje",
  MT: "Europe/Malta", NL: "Europe/Amsterdam", NO: "Europe/Oslo",
  PL: "Europe/Warsaw", PT: "Europe/Lisbon", RO: "Europe/Bucharest",
  RS: "Europe/Belgrade", SE: "Europe/Stockholm", SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava", UA: "Europe/Kyiv",
};

export function getBankingTimeZone(
  _bankingRegion: BankingRegion | null | undefined,
  country: string | null | undefined,
  preferredTimeZone?: string | null,
): string {
  const preferred = String(preferredTimeZone ?? "").trim();
  if (preferred) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: preferred });
      return preferred;
    } catch {
      // Ignore invalid client-provided timezone values.
    }
  }
  const code = String(country ?? "").trim().toUpperCase();
  if (COUNTRY_TIME_ZONES[code]) return COUNTRY_TIME_ZONES[code]!;
  return "UTC";
}

export function bankingReceiptStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (isSuccessfulReceiptStatus(normalized)) return "Approved";
  if (["pending", "processing", "confirming", "pending review"].includes(normalized)) {
    return "Pending — Under Review/network";
  }
  if (normalized === "rejected") return "Rejected";
  return statusLabel(status);
}

export function bankingReceiptStatusRows(
  status: string,
  rejectionReason?: string | null,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [["Status", bankingReceiptStatusLabel(status)]];
  if (status.trim().toLowerCase() === "rejected" && rejectionReason?.trim()) {
    rows.push(["Rejection reason", rejectionReason.trim()]);
  }
  return rows;
}

function formatDate(value: Date | string | null | undefined, locale: string, timeZone: string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
  return timeZone === "UTC" ? `${formatted} UTC` : formatted;
}

export function maskReceiptAccount(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[^A-Za-z0-9]/g, "");
  if (!compact) return null;
  const lastFour = compact.slice(-4);
  return `•••• ${lastFour}`;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    processing: "Processing",
    approved: "Approved",
    completed: "Completed",
    failed: "Failed",
    rejected: "Rejected",
    cancelled: "Cancelled",
    reversed: "Reversed",
  };
  return labels[status.toLowerCase()] ?? status.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function transferTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  const labels: Record<string, string> = {
    internal: "Internal account transfer",
    national: "Domestic bank transfer",
    international: "International bank transfer",
  };
  return labels[type.toLowerCase()] ?? type.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isSuccessfulReceiptStatus(status: string | null | undefined): boolean {
  return ["approved", "completed", "paid", "successful"].includes((status ?? "").toLowerCase());
}

export function getBankingDepositInsuranceNotice(
  websiteType: string | null | undefined,
  bankingRegion: BankingRegion | null | undefined,
  status: string | null | undefined,
): string | null {
  if (websiteType !== "banking" || !isSuccessfulReceiptStatus(status)) return null;
  if (bankingRegion === "USA") {
    return "FDIC insurance applies.";
  }
  if (bankingRegion === "EUROPE") {
    return "Eligible deposits may be protected by the applicable national deposit guarantee scheme.";
  }
  return null;
}

export function getTransactionDateTime(receipt: {
  status: string;
  issuedAt: Date | string;
  orderAt?: Date | string | null;
  executionAt?: Date | string | null;
}): Date | string {
  if (isSuccessfulReceiptStatus(receipt.status) && receipt.executionAt) return receipt.executionAt;
  return receipt.orderAt ?? receipt.issuedAt;
}

function safePrivacyPolicyUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function drawFallbackBankMark(doc: any, x: number, y: number, size: number) {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).fill("#e8edf2");
  doc.fillColor("#253342");
  doc.moveTo(x + 10, y + 18).lineTo(x + size / 2, y + 9).lineTo(x + size - 10, y + 18).closePath().fill();
  doc.rect(x + 11, y + 19, size - 22, 3).fill();
  const columnWidth = 4;
  for (const columnX of [x + 14, x + 22, x + 30]) {
    doc.rect(columnX, y + 23, columnWidth, 12).fill();
  }
  doc.rect(x + 11, y + 36, size - 22, 3).fill();
  doc.restore();
}

const BANKING_RECEIPT_WATERMARK_OPACITY = 0.055;

/**
 * Paint a separate, faint logo layer behind receipt content on every page.
 * The source logo is only read; the normal header logo is rendered separately.
 */
export function drawBankingReceiptLogoWatermark(doc: any, logo: LogoAsset | null): void {
  const drawCurrentPage = () => {
    const pageWidth = Number(doc.page?.width) || 595.28;
    const pageHeight = Number(doc.page?.height) || 841.89;
    const tileWidth = 84;
    const tileHeight = 48;
    const horizontalSpacing = 150;
    const verticalSpacing = 120;

    doc.save();
    doc.opacity(BANKING_RECEIPT_WATERMARK_OPACITY);
    for (let row = 0, y = -24; y < pageHeight; row++, y += verticalSpacing) {
      const stagger = row % 2 === 0 ? 0 : -75;
      for (let x = -34 + stagger; x < pageWidth; x += horizontalSpacing) {
        if (logo) {
          doc.image(logo.buffer, x, y, {
            fit: [tileWidth, tileHeight],
            align: "center",
            valign: "center",
          });
        } else {
          drawFallbackBankMark(doc, x + 21, y + 3, 42);
        }
      }
    }
    doc.restore();
  };

  doc.on("pageAdded", drawCurrentPage);
  drawCurrentPage();
}

export async function renderTransferReceiptPdf({ receipt, context }: TransferReceiptPdfInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: 46 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const locale = context.bankingRegion === "EUROPE" ? "de-DE" : "en-US";
  const timeZone = context.websiteType === "banking"
    ? getBankingTimeZone(context.bankingRegion, context.bankingCountry, context.timeZone)
    : "UTC";
  const pageWidth = 595.28;
  const left = 48;
  const right = pageWidth - 48;
  const contentWidth = right - left;
  const isBankingReceipt = context.websiteType === "banking";
  const logo = context.logo;
  if (isBankingReceipt) drawBankingReceiptLogoWatermark(doc, logo ?? null);
  const logoHeight = 42;
  const logoWidth = logo
    ? logo.aspectRatio > 1.55
      ? Math.min(92, Math.max(58, logo.aspectRatio * logoHeight))
      : logoHeight
    : logoHeight;
  const logoX = left;
  const logoY = 38;

  if (logo) {
    doc.save();
    if (logo.aspectRatio > 1.55) {
      doc.roundedRect(logoX, logoY, logoWidth, logoHeight, 8).clip();
      doc.image(logo.buffer, logoX, logoY, { fit: [logoWidth, logoHeight], align: "center", valign: "center" });
    } else {
      doc.circle(logoX + logoHeight / 2, logoY + logoHeight / 2, logoHeight / 2).clip();
      doc.image(logo.buffer, logoX, logoY, { fit: [logoHeight, logoHeight], align: "center", valign: "center" });
    }
    doc.restore();
  } else if (context.websiteType === "banking") {
    drawFallbackBankMark(doc, logoX, logoY, logoHeight);
  } else {
    doc.circle(logoX + logoHeight / 2, logoY + logoHeight / 2, logoHeight / 2).fill("#e8edf2");
    doc.fillColor("#253342").font("Helvetica-Bold").fontSize(18)
      .text(context.websiteName.trim().charAt(0).toUpperCase() || "B", logoX, logoY + 12, {
        width: logoHeight,
        align: "center",
      });
  }

  const nameX = left + logoWidth + 12;
  doc.fillColor("#17212b").font("Helvetica-Bold").fontSize(context.websiteType === "banking" ? 18 : 13)
    .text(context.websiteName, nameX, context.websiteType === "banking" ? logoY + 10 : logoY + 12, { width: right - nameX });

  let y = 106;
  const title = context.websiteType === "banking"
    ? "FUNDS TRANSFER CONFIRMATION"
    : context.bankingRegion === "EUROPE" ? "European Transfer Confirmation" : "Funds Transfer Confirmation";
  doc.fillColor("#111820").font("Helvetica-Bold").fontSize(context.websiteType === "banking" ? 17 : 19)
    .text(title, left, y, { width: contentWidth });
  y = doc.y + 14;

  const line = () => {
    if (isBankingReceipt) return;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.7).strokeColor("#59636d").stroke();
    y += 10;
  };
  const drawRows = (rows: Array<[string, string | null | undefined]>) => {
    for (const [label, rawValue] of rows) {
      if (rawValue === null || rawValue === undefined || rawValue.trim() === "") continue;
      const valueWidth = contentWidth - 198;
      const valueHeight = doc.font("Helvetica").fontSize(9)
        .heightOfString(rawValue, { width: valueWidth, lineGap: 1 });
      const rowHeight = Math.max(19, valueHeight + 6);
      doc.fillColor("#27313a").font("Helvetica-Bold").fontSize(9)
        .text(label, left, y + 3, { width: 184 });
      doc.fillColor("#111820").font("Helvetica").fontSize(9)
        .text(rawValue, left + 198, y + 3, { width: valueWidth, lineGap: 1 });
      y += rowHeight;
      if (!isBankingReceipt) {
        doc.moveTo(left, y).lineTo(right, y).lineWidth(0.35).strokeColor("#c8cdd2").stroke();
      }
    }
    y += 5;
  };

  const transactionDate = formatDate(getTransactionDateTime(receipt), locale, timeZone);
  const topRows: Array<[string, string | null | undefined]> = [
    ["Transaction type", transferTypeLabel(receipt.transferType ?? receipt.paymentMethod)],
    [context.bankingRegion === "EUROPE" ? "Order / reference number" : "Confirmation number", receipt.reference ?? receipt.receiptNumber],
  ];
  if (isBankingReceipt) {
    topRows.push(["Transaction Date/Time", transactionDate]);
  } else {
    const orderDate = formatDate(receipt.orderAt ?? receipt.issuedAt, locale, timeZone);
    const executionDate = formatDate(receipt.executionAt, locale, timeZone);
    topRows.push([context.bankingRegion === "EUROPE" ? "Booking date" : "Order date/time", orderDate]);
    if (receipt.status.toLowerCase() === "completed" && executionDate) {
      topRows.push(["Execution date/time", executionDate]);
    }
  }
  if (isBankingReceipt) {
    topRows.push(...bankingReceiptStatusRows(receipt.status, receipt.rejectionReason));
  } else {
    topRows.push(["Status", statusLabel(receipt.status)]);
  }
  drawRows(topRows);

  line();
  const beneficiaryRows: Array<[string, string | null | undefined]> = [
    ["Sender / account holder", receipt.senderName],
    ["Debit account", receipt.senderAccount ? `${receipt.accountType ? `${receipt.accountType} · ` : ""}${maskReceiptAccount(receipt.senderAccount)}` : null],
    ...(receipt.beneficiaryBankName ? [["Beneficiary bank", receipt.beneficiaryBankName] as [string, string]] : []),
    ["Beneficiary", receipt.recipientName],
    ...(context.bankingRegion === "EUROPE"
      ? [
          ["Beneficiary IBAN", maskReceiptAccount(receipt.recipientIban)] as [string, string | null],
          ["BIC / SWIFT", receipt.swiftBic] as [string, string | null],
        ]
      : [
          ["Beneficiary account", maskReceiptAccount(receipt.recipientAccount)] as [string, string | null],
          ["ABA routing number", receipt.routingNumber] as [string, string | null],
        ]),
    ...(context.bankingRegion === "EUROPE" && receipt.recipientAccount
      ? [["Beneficiary account", maskReceiptAccount(receipt.recipientAccount)] as [string, string]]
      : []),
    ["Payment reference", receipt.paymentReference],
  ];
  drawRows(beneficiaryRows);

  line();
  const principal = receipt.grossAmount ?? receipt.amount;
  const fee = receipt.fee ?? "0";
  const totalDebit = receipt.totalDebit ?? (Number(principal) + Number(fee)).toFixed(2);
  const amountRows: Array<[string, string]> = [
    [context.bankingRegion === "EUROPE" ? "Transfer amount" : "Principal amount", formatMoney(principal, receipt.currency, locale)],
    ["Transfer fee", formatMoney(fee, receipt.currency, locale)],
    [context.bankingRegion === "EUROPE" ? "Total amount" : "Total debit amount", formatMoney(totalDebit, receipt.currency, locale)],
  ];
  for (const [index, [label, value]] of amountRows.entries()) {
    const total = index === amountRows.length - 1;
    doc.fillColor("#17212b").font(total ? "Helvetica-Bold" : "Helvetica").fontSize(total ? 11 : 9)
      .text(label, left, y + 3, { width: 240 });
    doc.fillColor("#111820").font(total ? "Helvetica-Bold" : "Helvetica").fontSize(total ? 11 : 9)
      .text(value, right - 174, y + 3, { width: 174, align: "right" });
    y += total ? 25 : 20;
  }

  if (isBankingReceipt) {
    y += 18;
  } else {
    y += 11;
    line();
    y += 3;
  }
  const supportContacts = [context.supportPhone, context.supportEmail].filter((value): value is string => Boolean(value?.trim()));
  if (supportContacts.length > 0) {
    doc.fillColor("#505b65").font("Helvetica").fontSize(8)
      .text(`Customer care: ${supportContacts.join(" · ")}`, left, y, {
        width: contentWidth,
        lineGap: 2,
      });
    y = doc.y + 7;
  }

  const insuranceNotice = getBankingDepositInsuranceNotice(
    context.websiteType,
    context.bankingRegion,
    receipt.status,
  );
  if (isBankingReceipt) {
    const footerHeight = insuranceNotice ? 62 : 36;
    const footerTop = doc.page.height - 66 - footerHeight;
    if (y > footerTop) {
      doc.addPage();
      y = 46;
    } else {
      y = footerTop;
    }
  }
  if (insuranceNotice) {
    doc.fillColor("#505b65").font("Helvetica").fontSize(7)
      .text(insuranceNotice, left, y, { width: contentWidth, lineGap: 1 });
    y = doc.y + 5;
  }

  if (context.websiteType === "banking") {
    const copyright = `© ${new Date().getFullYear()} ${context.websiteName}. All rights reserved.`;
    doc.fillColor("#68737d").font("Helvetica").fontSize(7)
      .text(copyright, left, y, { width: contentWidth, align: "center" });
    y = doc.y + 3;
    const privacyPolicyUrl = safePrivacyPolicyUrl(context.privacyPolicyUrl);
    if (privacyPolicyUrl) {
      doc.fillColor("#3f566e").font("Helvetica").fontSize(7)
        .text("Privacy Policy", left, y, {
          width: contentWidth,
          align: "center",
          link: privacyPolicyUrl,
          underline: true,
        });
    }
  }

  doc.end();
  return done;
}
