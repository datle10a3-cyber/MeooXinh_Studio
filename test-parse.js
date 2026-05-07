const fs = require('fs');

const payload = JSON.parse(fs.readFileSync('test-backup.json', 'utf8'));

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function validateBackup(input) {
  const backup = asRecord(input);
  if (!backup || !asRecord(backup.data)) throw new Error("File JSON không đúng định dạng backup của Mèoo Xinhh.");
  return backup;
}

try {
  validateBackup(payload);
  console.log("Validation passed!");
  
  const sectionOrder = [
    "categories",
    "packages",
    "customers",
    "wallets",
    "walletShifts",
    "bookings",
    "projects",
    "invoices",
    "transactions",
    "employees",
    "equipment",
    "notifications",
    "media",
  ];
  
  function rowsOf(backup, section) {
    const rows = backup.data?.[section];
    return Array.isArray(rows) ? rows.filter((row) => asRecord(row)) : [];
  }
  
  const sections = sectionOrder.filter((key) => rowsOf(payload, key).length > 0);
  console.log("Sections to import:", sections);
  
} catch (e) {
  console.error("Error:", e.message);
}
