import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import {
  bankingReceiptStatusLabel,
  bankingReceiptStatusRows,
  drawBankingReceiptLogoWatermark,
  getBankingDepositInsuranceNotice,
  getBankingTimeZone,
  renderTransferReceiptPdf,
} from "./transferReceiptPdf.js";

type LogoAsset = { buffer: Buffer; aspectRatio: number };

type ReceiptPdfInput = {
  receipt: {
    receiptNumber: string;
    transactionKind: string;
    amount: string;
    currency: string;
    status: string;
    issuedAt: Date;
    paymentMethod?: string | null;
    reference?: string | null;
    grossAmount?: string;
    fee?: string;
    netAmount?: string;
    direction?: string;
    description?: string | null;
    rejectionReason?: string | null;
    bankingRegion?: "USA" | "EUROPE" | null;
    bankingCountry?: string | null;
    timeZone?: string | null;
    transferType?: string | null;
    beneficiaryBankName?: string | null;
    recipientIban?: string | null;
    swiftBic?: string | null;
    routingNumber?: string | null;
    paymentReference?: string | null;
    orderAt?: Date | string | null;
    executionAt?: Date | string | null;
    accountNumber?: string | null;
    accountType?: string | null;
    verificationUrl?: string | null;
    senderName?: string;
    senderAccount?: string;
    senderPlatform?: string;
    recipientName?: string;
    recipientAccount?: string;
    recipientPlatform?: string;
  };
  context: {
    customerName: string;
    websiteName: string;
    primaryColor?: string | null;
    verificationUrl?: string | null;
    websiteType?: string | null;
    bankingRegion?: "USA" | "EUROPE" | null;
    bankingCountry?: string | null;
    websiteLogoUrl?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
    privacyPolicyUrl?: string | null;
  };
};

async function loadBankingLogo(rawUrl: string | null | undefined): Promise<LogoAsset | null> {
  try {
    let source: Buffer;
    if (rawUrl?.startsWith("data:image/")) {
      const match = /^data:image\/(?:png|jpeg|jpg|svg\+xml|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(rawUrl);
      if (!match || match[1]!.length % 4 !== 0) return null;
      source = Buffer.from(match[1]!, "base64");
      if (!source.length || source.length > 5 * 1024 * 1024 || source.toString("base64") !== match[1]) return null;
    } else if (rawUrl?.startsWith("/assets/")) {
      const parts = rawUrl.slice("/assets/".length).split("/");
      if (parts.some((part) => !part || part === "." || part === ".." || !/^[A-Za-z0-9._-]+$/.test(part))) return null;
      const assetRoot = process.env.NODE_ENV === "production"
        ? resolve(process.cwd(), "dist", "client", "assets")
        : resolve(process.cwd(), "client", "public", "assets");
      const assetPath = resolve(assetRoot, ...parts);
      if (!assetPath.startsWith(assetRoot + sep)) return null;
      source = await readFile(assetPath);
      if (!source.length || source.length > 5 * 1024 * 1024) return null;
    } else {
      return null;
    }

    const image = sharp(source, { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    const aspectRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 1;
    return {
      buffer: await image.rotate().resize(320, 320, { fit: "inside", withoutEnlargement: true }).png().toBuffer(),
      aspectRatio,
    };
  } catch {
    return null;
  }
}

function addMoney(left: string, right: string): string {
  const units = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    if (!/^\d+(?:\.\d{1,4})?$/.test(value)) throw new Error("Invalid receipt amount");
    return BigInt(whole) * 10_000n + BigInt((fraction + "0000").slice(0, 4));
  };
  const value = units(left) + units(right);
  return (value / 10_000n).toString() + "." + (value % 10_000n).toString().padStart(4, "0");
}

export async function renderStandaloneBankingReceiptPdf({ receipt, context }: ReceiptPdfInput): Promise<Buffer> {
  const logo = await loadBankingLogo(context.websiteLogoUrl);
  if (receipt.transactionKind === "transfer") {
    return renderTransferReceiptPdf({
      receipt: {
        ...receipt,
        totalDebit: addMoney(receipt.grossAmount ?? receipt.amount, receipt.fee ?? "0"),
        transferType: receipt.transferType ?? receipt.paymentMethod,
      },
      context: {
        websiteName: context.websiteName,
        websiteType: "banking",
        bankingRegion: context.bankingRegion ?? null,
        bankingCountry: context.bankingCountry ?? null,
        timeZone: context.timeZone ?? null,
        supportEmail: context.supportEmail,
        supportPhone: context.supportPhone,
        privacyPolicyUrl: context.privacyPolicyUrl,
        logo,
      },
    });
  }

  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const width = 495;
  drawBankingReceiptLogoWatermark(doc, logo);
  const locale = context.bankingRegion === "EUROPE" ? "de-DE" : "en-US";
  const timeZone = getBankingTimeZone(context.bankingRegion ?? null, context.bankingCountry, context.timeZone);
  const primaryColor = context.primaryColor || "#1a56db";

  doc.rect(50, 40, width, 60).fill(primaryColor);
  doc.fontSize(20).fillColor("#ffffff").font("Helvetica-Bold").text(context.websiteName, 65, 58, { width: width - 30 });
  doc.fontSize(9).fillColor("#93c5fd").font("Helvetica").text("OFFICIAL PAYMENT RECEIPT", 65, 82);
  doc.fillColor("#ffffff").text(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), 65, 82, { align: "right", width: width - 30 });

  const boxY = 120;
  doc.rect(50, boxY, width, 54).fillAndStroke("#eff6ff", "#bfdbfe");
  doc.fontSize(8).fillColor("#1d4ed8").font("Helvetica-Bold").text("RECEIPT NUMBER", 65, boxY + 7);
  doc.fontSize(16).fillColor("#1e3a8a").font("Helvetica-Bold").text(receipt.receiptNumber, 65, boxY + 18);
  doc.rect(370, boxY + 13, 90, 28).fill(primaryColor);
  doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold")
    .text(receipt.transactionKind.toUpperCase(), 380, boxY + 21, { width: 70, align: "center" });

  const verificationUrl = context.verificationUrl ?? receipt.verificationUrl ?? null;
  if (verificationUrl) {
    try {
      const qr = await QRCode.toDataURL(verificationUrl, {
        width: 240,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      doc.image(qr, 495, boxY + 3, { width: 40, height: 40 });
      doc.fontSize(5.5).fillColor("#475569").font("Helvetica-Bold").text("SCAN TO VERIFY", 483, boxY + 45, { width: 64, align: "center" });
    } catch {
      // QR generation is additive and must not prevent the receipt download.
    }
  }

  doc.y = boxY + 84;
  const rows: Array<[string, string]> = [
    ["Customer", context.customerName],
    ["Company / Website", context.websiteName],
    ["Amount", `${receipt.currency} ${Number(receipt.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`],
    ["Gross Amount", `${receipt.currency} ${Number(receipt.grossAmount ?? receipt.amount).toFixed(4)}`],
    ["Fee", `${receipt.currency} ${Number(receipt.fee ?? 0).toFixed(4)}`],
    ["Net Amount", `${receipt.currency} ${Number(receipt.netAmount ?? receipt.amount).toFixed(4)}`],
    ["Direction", receipt.direction ?? "outgoing"],
  ];
  if (receipt.accountNumber) rows.push(["Account", `${receipt.accountType ?? "Account"} · ${receipt.accountNumber}`]);
  if (receipt.description) rows.push(["Description", receipt.description]);
  rows.push(
    ["Transaction Date/Time", new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "medium", timeZone }).format(receipt.issuedAt)],
    ...bankingReceiptStatusRows(receipt.status, receipt.rejectionReason),
  );
  const parties: Array<[string, string | undefined]> = [
    ["Sender", receipt.senderName],
    ["Sender Account", receipt.senderAccount],
    ["Sender Platform", receipt.senderPlatform],
    ["Recipient", receipt.recipientName],
    ["Recipient Account", receipt.recipientAccount],
    ["Recipient Platform", receipt.recipientPlatform],
  ];
  rows.splice(1, 0, ...parties.filter((row): row is [string, string] => Boolean(row[1])));
  if (receipt.paymentMethod) rows.splice(3, 0, ["Payment Method", receipt.paymentMethod]);
  if (receipt.reference) rows.splice(1, 0, ["Payment Tracking Number", receipt.reference]);

  let rowY = doc.y;
  for (const [index, [label, value]] of rows.entries()) {
    doc.rect(50, rowY, width, 30).fill(index % 2 === 0 ? "#f8fafc" : "#ffffff");
    doc.rect(50, rowY, 165, 30).fill(index % 2 === 0 ? "#f1f5f9" : "#f8fafc");
    doc.fontSize(9).fillColor("#475569").font("Helvetica-Bold").text(label, 65, rowY + 10, { width: 150 });
    doc.fontSize(9).fillColor("#111827").font("Helvetica").text(value, 220, rowY + 10, { width: width - 170 });
    rowY += 30;
  }

  rowY += 20;
  const isApproved = ["approved", "completed", "paid"].includes(receipt.status.toLowerCase());
  const bannerColor = isApproved ? "#16a34a" : receipt.status.toLowerCase() === "pending" ? "#d97706" : "#dc2626";
  doc.rect(50, rowY, width, 36).fill(bannerColor);
  doc.fontSize(13).fillColor("#ffffff").font("Helvetica-Bold")
    .text(`Status: ${bankingReceiptStatusLabel(receipt.status)}`, 50, rowY + 11, { width, align: "center" });

  const insuranceNotice = getBankingDepositInsuranceNotice("banking", context.bankingRegion, receipt.status);
  let footerY = Math.max(706 - (insuranceNotice ? 48 : 30), rowY + 56);
  if (footerY + (insuranceNotice ? 62 : 44) > doc.page.height - 40) {
    doc.addPage();
    footerY = 54;
  }
  if (insuranceNotice) {
    doc.fontSize(7).fillColor("#64748b").font("Helvetica").text(insuranceNotice, 50, footerY, { width, align: "center", lineGap: 1 });
    footerY = doc.y + 4;
  }
  doc.fontSize(7.5).fillColor("#64748b").font("Helvetica")
    .text(`© ${new Date().getFullYear()} ${context.websiteName}. All rights reserved.`, 50, footerY, { width, align: "center" });
  footerY = doc.y + 3;
  if (context.privacyPolicyUrl) {
    doc.fontSize(7.5).fillColor("#475569").font("Helvetica")
      .text("Privacy Policy", 50, footerY, { width, align: "center", link: context.privacyPolicyUrl, underline: true });
    footerY = doc.y + 3;
  }
  doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
    .text("This receipt is permanently stored and can be downloaded at any time.", 50, footerY, { width, align: "center" });
  doc.end();
  return done;
}
