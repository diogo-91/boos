import { google } from "googleapis";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
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
const SHEET_ID = "1ZviC141NY47Xge4ntZFg3E2WngeIMTZGt_WOPz_771Q";

const csv = await drive.files.export(
  { fileId: SHEET_ID, mimeType: "text/csv" },
  { responseType: "text" }
);

const lines = csv.data.trim().split("\n");
console.log(`Total de linhas: ${lines.length}`);
lines.forEach((l, i) => console.log(`L${i+1}: ${l}`));
