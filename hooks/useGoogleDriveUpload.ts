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
const ACCOUNT_HINT = process.env.NEXT_PUBLIC_GOOGLE_UPLOAD_ACCOUNT_HINT;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const LS_CONSENTED_KEY = "gd_consented";

export type UploadStepId = "upload" | "context" | "download" | "ai" | "match" | "save";
export type UploadStepStatus = "pending" | "active" | "done" | "skip" | "error";
export type UploadStep = { id: UploadStepId; label: string; status: UploadStepStatus; message?: string };

const STEP_LABELS: Record<UploadStepId, string> = {
  upload: "Enviando arquivo para o Drive",
  context: "Identificando pasta e tipo de documento",
  download: "Baixando conteúdo do arquivo",
  ai: "Lendo documento com IA",
  match: "Localizando cliente/processo",
  save: "Salvando dados extraídos"
};

const STEP_ORDER: UploadStepId[] = ["upload", "context", "download", "ai", "match", "save"];

function initialSteps(): UploadStep[] {
  return STEP_ORDER.map((id) => ({ id, label: STEP_LABELS[id], status: "pending" as const }));
}

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
  const [steps, setSteps] = useState<UploadStep[]>([]);
  const accessTokenRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStep = useCallback((id: UploadStepId, status: UploadStepStatus, message?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, message } : s)));
  }, []);

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
          ...(ACCOUNT_HINT ? { login_hint: ACCOUNT_HINT } : {}),
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
      setSteps(initialSteps());
      updateStep("upload", "active");
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

        updateStep("upload", "done");

        const uploaded = await response.json() as { id: string; name: string };
        await notifyReadFile(uploaded.id, uploaded.name ?? file.name, folderId, onDone, updateStep);
        setSteps((prev) => prev.map((s) => (s.status === "pending" ? { ...s, status: "skip" } : s)));
      } catch (err) {
        updateStep("upload", "error", err instanceof Error ? err.message : "Erro no upload.");
        onError(err instanceof Error ? err.message : "Erro no upload.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [getToken, updateStep]
  );

  return { isUploading, isAuthorized, isAuthorizing, requestAuthorization, uploadFile, fileInputRef, steps };
}

type ReadFileResult = {
  ok: boolean;
  skipped?: boolean;
  skipReason?: string;
  fieldsExtracted?: string[];
  error?: string;
};

async function notifyReadFile(
  fileId: string,
  fileName: string,
  folderId: string,
  onDone: (msg?: string) => void,
  updateStep: (id: UploadStepId, status: UploadStepStatus, message?: string) => void
) {
  try {
    const resp = await fetch("/api/drive/read-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, fileName, parentFolderId: folderId })
    });

    if (!resp.body) {
      onDone("Arquivo enviado.");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: ReadFileResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        if (!json) continue;

        try {
          const parsed = JSON.parse(json) as
            | { type: "progress"; step: UploadStepId; status: UploadStepStatus; message?: string }
            | ({ type: "result" } & ReadFileResult);

          if (parsed.type === "progress") {
            updateStep(parsed.step, parsed.status, parsed.message);
          } else {
            result = parsed;
          }
        } catch {
          // ignora eventos malformados
        }
      }
    }

    if (!result) {
      onDone("Arquivo enviado.");
    } else if (result.skipped) {
      onDone(`Arquivo enviado. Leitura ignorada: ${result.skipReason ?? "tipo não suportado"}`);
    } else if (result.fieldsExtracted?.length) {
      onDone(`Arquivo enviado e lido pela IA. Campos preenchidos: ${result.fieldsExtracted.join(", ")}`);
    } else if (result.error) {
      onDone(`Arquivo enviado. Erro na leitura: ${result.error}`);
    } else {
      onDone("Arquivo enviado. Nenhum campo extraído.");
    }
  } catch {
    onDone("Arquivo enviado.");
  }
}
