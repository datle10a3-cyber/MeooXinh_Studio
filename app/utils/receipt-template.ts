import { formatMoney } from "@/app/utils/format";

export type StudioReceiptLine = {
  name: string;
  description?: string;
  quantity?: string;
  amount: unknown;
  originalAmount?: unknown;
  discountText?: string;
};

export type StudioReceiptData = {
  title: string;
  code?: string;
  customer: string;
  time: string;
  packageTitle: string;
  packageSubtitle?: string;
  lines: StudioReceiptLine[];
  subtotal?: unknown;
  discount?: unknown;
  extraFee?: unknown;
  total: unknown;
  totalLabel?: string;
  statusText?: string;
  qrUrl?: string;
  qrAmountLabel?: string;
  printButtonLabel?: string;
};

function receiptEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function moneyNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function receiptMoney(value: unknown) {
  return formatMoney(value as string | number | null | undefined);
}

function lineHtml(line: StudioReceiptLine, index: number) {
  const hasDiscount = line.originalAmount != null && moneyNumber(line.originalAmount) > moneyNumber(line.amount);
  return `
    <div class="item">
      <div class="row">
        <span class="left">${index + 1}. ${receiptEscape(line.name)}</span>
        <span class="right">${hasDiscount ? `<span class="strike">${receiptEscape(receiptMoney(line.originalAmount))}</span> ` : ""}${receiptEscape(receiptMoney(line.amount))}</span>
      </div>
      ${line.description ? `<div class="small muted">${receiptEscape(line.description)}</div>` : ""}
      ${line.quantity ? `<div class="row qty"><span>${receiptEscape(line.quantity)}</span><span class="right">${receiptEscape(receiptMoney(line.amount))}</span></div>` : ""}
      ${line.discountText ? `<div class="small discount">${receiptEscape(line.discountText)}</div>` : ""}
    </div>`;
}

export function buildStudioReceiptHtml(data: StudioReceiptData) {
  const rows = data.lines.map(lineHtml).join("");
  const subtotal = data.subtotal != null ? moneyNumber(data.subtotal) : data.lines.reduce((sum, line) => sum + moneyNumber(line.originalAmount ?? line.amount), 0);
  const discount = data.discount != null ? moneyNumber(data.discount) : Math.max(0, subtotal - moneyNumber(data.total));
  const extraFee = moneyNumber(data.extraFee);
  const qrBlock = data.qrUrl
    ? `<div class="sep"></div><div class="center qr"><img src="${receiptEscape(data.qrUrl)}" alt="QR thanh toán" /><div class="small bold">Quét mã để thanh toán</div>${data.qrAmountLabel ? `<div class="small">${receiptEscape(data.qrAmountLabel)}</div>` : ""}</div>`
    : "";

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${receiptEscape(data.title)} ${data.code ? receiptEscape(data.code) : ""}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff7fb; color: #4b2a25; font-family: Arial, "Helvetica Neue", sans-serif; padding-top: 10px; }
    .receipt { width: 80mm; max-width: 310px; margin: 0 auto; padding: 10px 9px; font-size: 12px; line-height: 1.38; background: #fff; border: 1px solid #f6c6d4; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #7a5750; }
    .brand-box { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; border-radius: 14px; background: #fff0f5; border: 1px solid #f5b8ca; }
    .logo { width: 34px; height: 34px; border-radius: 50%; background: #fff; object-fit: contain; border: 1px solid #f5b8ca; }
    .brand { font-size: 15px; font-weight: 900; letter-spacing: .9px; text-transform: uppercase; color: #e86b88; }
    .address { margin-top: 3px; font-size: 10.5px; line-height: 1.35; color: #7a5750; }
    .title { margin: 8px 0 6px; padding: 7px 0; border-radius: 12px; background: #e86b88; color: #fff; font-size: 14px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: .4px; }
    .sep { margin: 8px 0; border-top: 1px dashed #e9a8b8; }
    .solid { margin: 8px 0; border-top: 1px solid #f0b4c1; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .left { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .right { flex: 0 0 auto; text-align: right; white-space: nowrap; }
    .info { margin-top: 4px; }
    .label { flex: 0 0 86px; }
    .section { margin-top: 4px; font-weight: 800; text-transform: uppercase; }
    .item { margin-top: 5px; }
    .qty { padding-left: 12px; }
    .small { font-size: 11px; }
    .strike { text-decoration: line-through; color: #7a5750; font-size: 11px; }
    .discount { color: #e86b88; padding-left: 12px; font-weight: 700; }
    .total { padding: 8px; border-radius: 12px; background: #fff0f5; font-size: 13px; color: #d94f73; }
    .status { text-align: center; font-weight: 900; color: #0f9f6e; }
    .thanks { margin-top: 8px; line-height: 1.45; }
    .qr { margin-top: 8px; padding: 8px; border-radius: 14px; background: #fff; border: 1px solid #f5b8ca; color: #4b2a25; }
    .qr img { width: 128px; height: 128px; object-fit: contain; margin: 2px auto 4px; display: block; }
    .toolbar { display: flex; justify-content: center; gap: 10px; margin: 0 auto 12px; max-width: 310px; width: 100%; padding: 0 4px; }
    .btn { flex: 1; padding: 10px 14px; font-size: 13px; font-weight: bold; border: none; border-radius: 20px; cursor: pointer; font-family: inherit; }
    .btn-print { background: #e86b88; color: white; }
    .btn-close { background: #f3f4f6; color: #4b5563; }
    @page { margin: 0; }
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; margin: 0; padding-top: 0; color: #000; }
      .receipt { width: 100%; max-width: 80mm; margin: 0 auto; padding: 8px 6px; border: none !important; box-shadow: none !important; }
      .brand-box, .total, .qr { background: #fff; border-color: #000; color: #000; }
      .brand, .address, .title, .status { color: #000; }
      .title { background: #fff; border: 1px solid #000; }
      .sep { border-top-color: #777; }
      .solid { border-top-color: #000; }
    }
  </style>
</head>
<body>
  <div class="no-print toolbar">
    <button class="btn btn-print" onclick="window.print()">${receiptEscape(data.printButtonLabel ?? "In hóa đơn")}</button>
    <button class="btn btn-close" onclick="window.close()">Đóng</button>
  </div>
  <div class="receipt">
    <div class="brand-box">
      <img class="logo" src="/be-meo-studio-avatar.svg" alt="Mèoo Xinhh" />
      <div>
        <div class="brand">Mèoo Xinhh Studio</div>
        <div class="address">make & photo</div>
        <div class="address">☎ 0334043870</div>
        <div class="address">⌂ 142 Nguyễn Văn Cừ, Phường Diên Hồng, Tỉnh Gia Lai</div>
      </div>
    </div>
    <div class="title">${receiptEscape(data.title)}</div>
    ${data.code ? `<div class="info row"><span class="label">Mã HĐ</span><span class="left">: ${receiptEscape(data.code)}</span></div>` : ""}
    <div class="info row"><span class="label">Khách</span><span class="left">: ${receiptEscape(data.customer)}</span></div>
    <div class="info row"><span class="label">Giờ</span><span class="left">: ${receiptEscape(data.time)}</span></div>
    <div class="sep"></div>
    <div class="section">GÓI CHỤP</div>
    <div>${receiptEscape(data.packageTitle)}</div>
    ${data.packageSubtitle ? `<div class="small muted">${receiptEscape(data.packageSubtitle)}</div>` : ""}
    <div class="sep"></div>
    <div class="section">CHI TIẾT</div>
    ${rows}
    <div class="solid"></div>
    <div class="row info"><span>Tạm tính</span><span class="right">${receiptEscape(receiptMoney(subtotal))}</span></div>
    ${discount > 0 ? `<div class="row info discount"><span>Giảm giá</span><span class="right">-${receiptEscape(receiptMoney(discount))}</span></div>` : ""}
    ${extraFee > 0 ? `<div class="row info"><span>Phí phát sinh</span><span class="right">${receiptEscape(receiptMoney(extraFee))}</span></div>` : ""}
    <div class="row bold total"><span>${receiptEscape(data.totalLabel ?? "TỔNG THANH TOÁN")}</span><span class="right">${receiptEscape(receiptMoney(data.total))}</span></div>
    ${data.statusText ? `<div class="sep"></div><div class="status">${receiptEscape(data.statusText)}</div>` : ""}
    ${qrBlock}
    <div class="sep"></div>
    <div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO</span></div>
  </div>
  <script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script>
</body>
</html>`;
}

export function openReceiptPrintWindow(html: string, targetWindow?: Window | null) {
  const popup = targetWindow ?? window.open("", "_blank", "width=900,height=1000");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}
