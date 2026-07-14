"use client";

import { useCallback, useRef, useState } from "react";

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

export function useGoogleDriveUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [steps, setSteps] = useState<UploadStep[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStep = useCallback((id: UploadStepId, status: UploadStepStatus, message?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, message } : s)));
  }, []);

  const uploadFile = useCallback(
    async (file: File, folderId: string, onDone: (msg?: string) => void, onError: (msg: string) => void) => {
      setIsUploading(true);
      setSteps(initialSteps());
      updateStep("upload", "active");
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("parentId", folderId);

        const response = await fetch("/api/drive/upload", {
          method: "POST",
          body: form
        });

        const data = (await response.json()) as { file?: { id: string; name: string }; message?: string };

        if (!response.ok || !data.file) {
          throw new Error(data.message ?? "Falha ao enviar o arquivo.");
        }

        updateStep("upload", "done");

        await notifyReadFile(data.file.id, data.file.name ?? file.name, folderId, onDone, updateStep);
        setSteps((prev) => prev.map((s) => (s.status === "pending" ? { ...s, status: "skip" } : s)));
      } catch (err) {
        updateStep("upload", "error", err instanceof Error ? err.message : "Erro no upload.");
        onError(err instanceof Error ? err.message : "Erro no upload.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [updateStep]
  );

  return { isUploading, uploadFile, fileInputRef, steps };
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
