const fs = require('fs');
const file = 'app/components/resources/resource-manager.tsx';
let c = fs.readFileSync(file, 'utf8');
const hasCRLF = c.includes('\r\n');
if (hasCRLF) c = c.replace(/\r\n/g, '\n');

// 1. Fix printGroupInvoiceClean rows - per-customer discount
const old1 = 'const rows = group.customers.map((customer, index) => `\n    <div class="item">\n      <div class="row"><span class="left">${index + 1}. ${receiptEscape(customer.customerName)}</span><span class="right">${receiptEscape(formatMoney(customer.totalAmount))}</span></div>\n      <div class="small muted">${receiptEscape(customer.packageName)}</div>\n    </div>\n  `).join("");';

const new1 = 'const rows = group.customers.map((customer, index) => {\n    const sub = Number(customer.subtotal ?? customer.totalAmount);\n    const fin = Number(customer.totalAmount);\n    const disc = fin < sub;\n    return `<div class="item"><div class="row"><span class="left">${index + 1}. ${receiptEscape(customer.customerName)}</span><span class="right">${disc ? `<span style="text-decoration:line-through;color:#7a5750;font-size:11px">${receiptEscape(formatMoney(sub))}</span> ` : ""}${receiptEscape(formatMoney(fin))}</span></div><div class="small muted">${receiptEscape(customer.packageName)}</div>${disc ? `<div class="small" style="color:#e86b88">🏷️ Giảm ${receiptEscape(formatMoney(sub - fin))}</div>` : ""}</div>`;\n  }).join("");';

if (!c.includes(old1)) { console.log('ERR1'); process.exit(1); }
c = c.replace(old1, new1);
console.log('✅ 1/3 rows with per-customer discount');

// 2. Remove subtotal/discount from bottom
const old2 = '<div class="row info"><span>Tạm tính</span><span class="right">${receiptEscape(formatMoney(group.subtotal))}</span></div>${group.discount > 0 ? `<div class="row info"><span>🏷️ Giảm giá</span><span class="right">-${receiptEscape(formatMoney(group.discount))}</span></div>` : ""}${group.extraFee > 0';

const new2 = '${group.extraFee > 0';

if (!c.includes(old2)) { console.log('ERR2'); process.exit(1); }
c = c.replace(old2, new2);
console.log('✅ 2/3 removed subtotal/discount');

// 3. Add QR before "Cảm ơn"
const old3 = '<div class="status">ĐÃ THANH TOÁN ✓</div><div class="sep"></div><div class="center thanks">';

const new3 = '<div class="status">ĐÃ THANH TOÁN ✓</div><div class="sep"></div><div class="center qr"><img src="${receiptEscape(buildPaymentQrUrl(group.totalAmount, code))}" alt="QR" style="width:128px;height:128px;object-fit:contain;margin:4px auto;display:block"/><div class="small bold">Quét mã để thanh toán</div></div><div class="sep"></div><div class="center thanks">';

if (!c.includes(old3)) { console.log('ERR3 - looking for alternative...'); 
  // Try finding it in printGroupInvoiceClean specifically
  const alt = 'ĐÃ THANH TOÁN ✓</div><div class="sep"></div><div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO</span></div></div><script>';
  if (c.includes(alt)) {
    c = c.replace(alt, 'ĐÃ THANH TOÁN ✓</div><div class="sep"></div><div class="center qr"><img src="${receiptEscape(buildPaymentQrUrl(group.totalAmount, code))}" alt="QR" style="width:128px;height:128px;object-fit:contain;margin:4px auto;display:block"/><div class="small bold">Quét mã để thanh toán</div></div><div class="sep"></div><div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO</span></div></div><script>');
    console.log('✅ 3/3 added QR (alt match)');
  } else {
    console.log('ERR3 final'); process.exit(1);
  }
} else {
  c = c.replace(old3, new3);
  console.log('✅ 3/3 added QR');
}

if (hasCRLF) c = c.replace(/\n/g, '\r\n');
fs.writeFileSync(file, c, 'utf8');
console.log('✅ All patches applied to resource-manager.tsx');
