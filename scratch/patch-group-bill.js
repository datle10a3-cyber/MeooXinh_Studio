const fs = require('fs');
const file = 'app/components/catalog/booking-page.tsx';
let c = fs.readFileSync(file, 'utf8');

// Normalize to LF for matching, then restore CRLF at end
const hasCRLF = c.includes('\r\n');
if (hasCRLF) c = c.replace(/\r\n/g, '\n');

// 1. Fix estimate items - per-customer discount inline
const est1 = 'const subtotal = rows.reduce((sum, row) => sum + moneyNumber(row.price), 0);\n  const total = rows.reduce((sum, row) => sum + moneyNumber(row.total ?? row.price), 0);\n  const discount = Math.max(0, subtotal - total);\n  const items = rows.map((row, index) => `\n    <div class="item">\n      <div>${index + 1}. ${receiptEscape(row.customerName || "Khách hàng")}</div>\n      <div class="small muted">${receiptEscape(row.packageName || "Gói dịch vụ")}</div>\n      <div class="row qty"><span>x1</span><span class="right">${receiptEscape(formatMoney(row.total ?? row.price))}</span></div>\n    </div>\n  `).join("");';

const est1new = 'const total = rows.reduce((sum, row) => sum + moneyNumber(row.total ?? row.price), 0);\n  const items = rows.map((row, index) => {\n    const orig = moneyNumber(row.price);\n    const final_ = moneyNumber(row.total ?? row.price);\n    const disc = final_ < orig;\n    return `<div class="item"><div>${index + 1}. ${receiptEscape(row.customerName || "Khách hàng")}</div><div class="small muted">${receiptEscape(row.packageName || "Gói dịch vụ")}</div><div class="row qty"><span>x1</span><span class="right">${disc ? `<span style="text-decoration:line-through;color:#7a5750;font-size:11px">${receiptEscape(formatMoney(orig))}</span> ` : ""}${receiptEscape(formatMoney(final_))}</span></div>${disc ? `<div class="small" style="color:#e86b88;padding-left:12px">🏷️ Giảm ${receiptEscape(formatMoney(orig - final_))}</div>` : ""}</div>`;\n  }).join("");';

if (!c.includes(est1)) { console.log('ERR1'); process.exit(1); }
c = c.replace(est1, est1new);
console.log('✅ 1/5 estimate items');

// 2. Fix estimate HTML - remove subtotal/discount, add QR
const est2 = '${items}<div class="solid"></div><div class="row info"><span>Tạm tính</span><span class="right">${receiptEscape(formatMoney(subtotal))}</span></div>${discount > 0 ? `<div class="row info"><span>🏷️ Giảm giá</span><span class="right">-${receiptEscape(formatMoney(discount))}</span></div>` : ""}<div class="row bold total"><span>TỔNG TẠM TÍNH</span><span class="right">${receiptEscape(formatMoney(total))}</span></div><div class="sep"></div><div class="center thanks">';

const est2new = '${items}<div class="solid"></div><div class="row bold total"><span>TỔNG TẠM TÍNH</span><span class="right">${receiptEscape(formatMoney(total))}</span></div><div class="sep"></div><div class="center qr"><img src="${receiptEscape(buildPaymentQrUrl(total, `TT-${groupName.replace(/\\\\s+/g, "").slice(0, 10)}`))}\" alt="QR" style="width:128px;height:128px;object-fit:contain;margin:4px auto;display:block"/><div class="small bold">Quét mã để thanh toán</div></div><div class="sep"></div><div class="center thanks">';

if (!c.includes(est2)) { console.log('ERR2'); process.exit(1); }
c = c.replace(est2, est2new);
console.log('✅ 2/5 estimate HTML');

// 3. Fix group invoice rows - per-customer discount
const grp1 = 'const rows = groupBooking.customers.map((customer, index) => `\n    <div class="item">\n      <div class="row"><span class="left">${index + 1}. ${receiptEscape(customer.customerName)}</span><span class="right">${receiptEscape(formatMoney(customer.totalAmount))}</span></div>\n      <div class="small muted">${receiptEscape(customer.packageName)}</div>\n    </div>\n  `).join("");';

const grp1new = 'const rows = groupBooking.customers.map((customer, index) => {\n    const sub = Number(customer.subtotal ?? customer.totalAmount);\n    const fin = Number(customer.totalAmount);\n    const disc = fin < sub;\n    return `<div class="item"><div class="row"><span class="left">${index + 1}. ${receiptEscape(customer.customerName)}</span><span class="right">${disc ? `<span style="text-decoration:line-through;color:#7a5750;font-size:11px">${receiptEscape(formatMoney(sub))}</span> ` : ""}${receiptEscape(formatMoney(fin))}</span></div><div class="small muted">${receiptEscape(customer.packageName)}</div>${disc ? `<div class="small" style="color:#e86b88">🏷️ Giảm ${receiptEscape(formatMoney(sub - fin))}</div>` : ""}</div>`;\n  }).join("");';

if (!c.includes(grp1)) { console.log('ERR3'); process.exit(1); }
c = c.replace(grp1, grp1new);
console.log('✅ 3/5 group invoice rows');

// 4. Remove subtotal/discount from group invoice bottom
const grp2 = '<div class="row info"><span>Tạm tính</span><span class="right">${receiptEscape(formatMoney(groupBooking.subtotal))}</span></div>\n    ${groupBooking.discount > 0 ? `<div class="row info"><span>🏷️ Giảm giá</span><span class="right">-${receiptEscape(formatMoney(groupBooking.discount))}</span></div>` : ""}\n    ${groupBooking.extraFee > 0';

const grp2new = '${groupBooking.extraFee > 0';

if (!c.includes(grp2)) { console.log('ERR4'); process.exit(1); }
c = c.replace(grp2, grp2new);
console.log('✅ 4/5 removed group subtotal/discount');

// 5. Add QR to group invoice
const grp3 = '<div class="status">ĐÃ THANH TOÁN ✓</div>\n    <div class="sep"></div>\n    <div class="center thanks">';

const grp3new = '<div class="status">ĐÃ THANH TOÁN ✓</div>\n    <div class="sep"></div>\n    <div class="center qr"><img src="${receiptEscape(buildPaymentQrUrl(groupBooking.totalAmount, invoiceCode))}" alt="QR" style="width:128px;height:128px;object-fit:contain;margin:4px auto;display:block"/><div class="small bold">Quét mã để thanh toán</div></div>\n    <div class="sep"></div>\n    <div class="center thanks">';

if (!c.includes(grp3)) { console.log('ERR5'); process.exit(1); }
c = c.replace(grp3, grp3new);
console.log('✅ 5/5 added QR to group invoice');

// Restore CRLF if needed
if (hasCRLF) c = c.replace(/\n/g, '\r\n');
fs.writeFileSync(file, c, 'utf8');
console.log('✅ All patches applied to booking-page.tsx');
