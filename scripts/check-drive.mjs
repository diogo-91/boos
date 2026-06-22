import { google } from "googleapis";
import * as dotenv from "fs";

// Carregar .env.local manualmente
const env = dotenv.readFileSync(".env.local", "utf-8");
for (const line of env.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({ version: "v3", auth });

async function listFolder(folderId, label, depth = 0) {
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: 50
  });
  const indent = "  ".repeat(depth);
  for (const f of data.files ?? []) {
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    console.log(`${indent}${isFolder ? "📁" : "📄"} ${f.name} (${f.id})`);
    if (isFolder && depth < 2) await listFolder(f.id, f.name, depth + 1);
  }
}

const ALESSANDRA_FOLDER = "1EwHO7FBMB_Mw8EAGrocVgy6y2FP9Ehsn";
console.log("📁 Pasta da Alessandra:");
await listFolder(ALESSANDRA_FOLDER, "Alessandra");
