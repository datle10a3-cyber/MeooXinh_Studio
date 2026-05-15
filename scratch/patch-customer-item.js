const fs = require('fs');
const file = 'app/components/resources/resource-manager.tsx';
let c = fs.readFileSync(file, 'utf8');
const hasCRLF = c.includes('\r\n');
if (hasCRLF) c = c.replace(/\r\n/g, '\n');

// Replace the group customer rendering (lines 919-987 approx) with a style matching FinancialCompactCard
const oldCustomerItem = `              return (
                <button
                  key={customer.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#F4C7C4] bg-[#FFFDFB] p-3 text-left transition hover:bg-[#FFF8F1] active:scale-[0.99]"
                  onClick={() => setDetail(customer)}
                >
                  {/* Customer avatar */}
                  <span className="relative shrink-0">
                    <span className={\`grid h-11 w-11 place-items-center overflow-hidden rounded-[0.85rem] shadow-sm \${customer.customerImage ? "" : \`bg-gradient-to-br \${avatarGradient}\`}\`}>
                      {customer.customerImage ? (
                        <img src={customer.customerImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[15px] font-black text-white drop-shadow-sm">{customerInitial}</span>
                      )}
                    </span>
                    {/* Package thumbnail overlay */}
                    {images[0] ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="absolute -bottom-1 -right-1 h-6 w-6 overflow-hidden rounded-lg border-2 border-white bg-[#FFF3EC] shadow-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreview({ images, index: 0, alt: customer.packageName });
                        }}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && images.length) {
                            event.preventDefault();
                            event.stopPropagation();
                            setPreview({ images, index: 0, alt: customer.packageName });
                          }
                        }}
                      >
                        <img src={images[0]} alt="" className="h-full w-full object-cover" />
                      </span>
                    ) : null}
                  </span>
                  {/* Customer info */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[#5B342C]">{customer.customerName}</span>
                    <span className="mt-0.5 line-clamp-1 text-xs font-bold leading-4 text-[#9B746B]">{customer.packageName}</span>
                    <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">{customer.status || "COMPLETED"}</span>
                  </span>
                  {/* Price + actions */}
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="whitespace-nowrap text-sm font-black text-[#5B342C]">{formatMoney(customer.totalAmount)}</span>
                    {canPrint ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="rounded-lg border border-[#F4C7C4] bg-white px-2 py-0.5 text-[11px] font-black text-[#EA7188] transition hover:bg-[#FFF0F4]"
                        onClick={(event) => {
                          event.stopPropagation();
                          printGroupCustomerBill(group, customer);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            printGroupCustomerBill(group, customer);
                          }
                        }}
                      >
                        In bill
                      </span>
                    ) : null}
                  </span>
                </button>`;

const newCustomerItem = `              return (
                <div
                  key={customer.id}
                  className="relative mt-4 cursor-pointer rounded-[1.5rem] border border-emerald-300 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/40 p-3.5 shadow-sm ring-1 ring-emerald-200/50 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                  onClick={() => setDetail(customer)}
                >
                  {/* Top badges */}
                  <div className="absolute -top-2.5 left-4 flex gap-1.5">
                    <span className="rounded-full border border-emerald-600 bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                      {customer.status || "COMPLETED"}
                    </span>
                  </div>

                  {/* Main row: avatar + info + price */}
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {/* Avatar */}
                      <span className={\`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[0.85rem] shadow-sm \${customer.customerImage ? "" : \`bg-gradient-to-br \${avatarGradient}\`}\`}>
                        {customer.customerImage ? (
                          <img src={customer.customerImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[15px] font-black text-white drop-shadow-sm">{customerInitial}</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black leading-tight text-[#5B342C]">{customer.customerName}</h3>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <p className="truncate text-sm font-bold text-[#9B746B]">{customer.packageName}</p>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-black text-emerald-700">{formatMoney(customer.totalAmount)}</p>
                      <p className="text-[10px] font-bold text-[#9B746B]">Thanh toán</p>
                    </div>
                  </div>

                  {/* Bottom: package thumb + actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {images[0] ? (
                      <button
                        type="button"
                        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#F4C7C4] bg-white p-0.5 shadow-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreview({ images, index: 0, alt: customer.packageName });
                        }}
                      >
                        <img src={images[0]} alt="" className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-0.5 left-0.5 right-0.5 rounded-full bg-white/95 px-1 py-0.5 text-[8px] font-black text-[#A84E61] shadow-sm">Gói chụp</span>
                      </button>
                    ) : null}
                    <div className="flex flex-1 justify-end gap-2">
                      {canPrint ? (
                        <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label="In bill"
                          onClick={(event) => { event.stopPropagation(); printGroupCustomerBill(group, customer); }}
                        >
                          <Printer size={15} className="text-[#EA7188]" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>`;

if (!c.includes(oldCustomerItem)) {
  console.log('ERROR: oldCustomerItem not found');
  process.exit(1);
}
c = c.replace(oldCustomerItem, newCustomerItem);
console.log('✅ Replaced group customer item with individual-style card');

if (hasCRLF) c = c.replace(/\n/g, '\r\n');
fs.writeFileSync(file, c, 'utf8');
console.log('✅ Done');
