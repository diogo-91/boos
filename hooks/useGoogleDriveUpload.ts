"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const LS_CONSENTED_KEY = "gd_consented";

function hasConsented(): boolean {
  try { return localStorage.getItem(LS_CONSENTED_KEY) === "1"; } catch { return false; }
}

function markConsented() {
  try { localStorage.setItem(LS_CONSENTED_KEY, "1"); } catch {}
}

export function useGoogleDriveUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const accessTokenRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!CLIENT_ID || document.getElementById("gsi-script")) return;
    const script = document.createElement("script");
    script.id = "gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const getToken = useCallback((silent: boolean): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const tryInit = () => {
        if (!window.google?.accounts?.oauth2) {
          setTimeout(tryInit, 300);
          return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          // @ts-expect-error login_hint is supported but not typed
          login_hint: "eclgestao25@gmail.com",
          callback: (response) => {
            if (response.access_token) {
              accessTokenRef.current = response.access_token;
              markConsented();
              setIsAuthorized(true);
              resolve(response.access_token);
            } else {
              reject(new Error(silent ? "silent_fail" : "Autorização negada pelo Google."));
            }
          }
        });

        client.requestAccessToken({ prompt: silent ? "" : "select_account" });
      };

      tryInit();
    });
  }, []);

  useEffect(() => {
    if (!hasConsented()) return;
    const id = setTimeout(() => {
      getToken(true).catch(() => setIsAuthorized(false));
    }, 800);
    return () => clearTimeout(id);
  }, [getToken]);

  const requestAuthorization = useCallback(async (onError: (msg: string) => void) => {
    setIsAuthorizing(true);
    try {
      await getToken(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao autorizar.");
    } finally {
      setIsAuthorizing(false);
    }
  }, [getToken]);

  const uploadFile = useCallback(
    async (file: File, folderId: string, onDone: (msg?: string) => void, onError: (msg: string) => void) => {
      let token = accessTokenRef.current;
      if (!token && hasConsented()) {
        try { token = await getToken(true); } catch {}
      }

      if (!token) {
        onError("Autorize o acesso ao Google Drive primeiro.");
        return;
      }

      setIsUploading(true);
      try {
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify({ name: file.name, parents: [folderId] })], { type: "application/json" })
        );
        form.append("file", file);

        const upload = (t: string) =>
          fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
            method: "POST",
            headers: { Authorization: `Bearer ${t}` },
            body: form
          });

        let response = await upload(token);

        if (response.status === 401) {
          accessTokenRef.current = null;
          const newToken = await getToken(true);
          response = await upload(newToken);
        }

        if (!response.ok) {
          const data = await response.json() as { error?: { message?: string } };
          throw new Error(data.error?.message ?? "Falha ao enviar o arquivo.");
        }

        const uploaded = await response.json() as { id: string; name: string };
        await notifyReadFile(uploaded.id, uploaded.name ?? file.name, folderId, onDone);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Erro no upload.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [getToken]
  );

  return { isUploading, isAuthorized, isAuthorizing, requestAuthorization, uploadFile, fileInputRef };
}

async function notifyReadFile(
  fileId: string,
  fileName: string,
  folderId: string,
  onDone: (msg?: string) => void
) {
  try {
    const resp = await fetch("/api/drive/read-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, fileName, parentFolderId: folderId })
    });
    const data = await resp.json() as {
      ok: boolean;
      skipped?: boolean;
      skipReason?: string;
      fieldsExtracted?: string[];
      error?: string;
    };

    if (data.skipped) {
      onDone(`Arquivo enviado. Leitura ignorada: ${data.skipReason ?? "tipo não suportado"}`);
    } else if (data.fieldsExtracted?.length) {
      onDone(`Arquivo enviado e lido pela IA. Campos preenchidos: ${data.fieldsExtracted.join(", ")}`);
    } else if (data.error) {
      onDone(`Arquivo enviado. Erro na leitura: ${data.error}`);
    } else {
      onDone("Arquivo enviado. Nenhum campo extraído.");
    }
  } catch {
    onDone("Arquivo enviado.");
  }
}
