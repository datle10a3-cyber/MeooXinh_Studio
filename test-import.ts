import { POST } from "./app/api/backup/import/route";

async function run() {
  const fs = require('fs');
  const payload = JSON.parse(fs.readFileSync('test-backup.json', 'utf8'));
  
  // Mock requireUser to bypass auth
  const authModule = require("./app/lib/auth");
  authModule.requireUser = async () => ({
    id: "cmosdxcor00051hp76agp7oyg",
    name: "Mèo Xinh",
    email: "datle10a3@gmail.com",
    role: "ADMIN",
    studioId: "cmosdxcmx00011hp715xc0pi1",
  });

  const req = {
    json: async () => ({
      action: "import",
      backup: payload,
      strategy: "merge",
      sections: []
    })
  };

  try {
    const response = await POST(req as any);
    const body = await response.json();
    console.log("Status:", response.status);
    console.dir(body, { depth: null });
  } catch (err) {
    console.error("Uncaught error:", err);
  }
}

run();
