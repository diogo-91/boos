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

// Upload vai direto pro servidor (/api/drive/upload), que usa a conta de
// serviço — sem OAuth pessoal do usuário. Isso só fazia sentido antes,
// quando a conta de serviço podia não ter acesso a toda a estrutura; agora
// que é tudo Workspace com a mesma conta de serviço, não há motivo pra
// pedir autorização individual a cada pessoa que for enviar um arquivo.
export function useGoogleDriveUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [steps, setSteps] = useState<UploadStep[]>([]);
  const [currentFile, setCurrentFile] = useState<{ index: number; total: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStep = useCallback((id: UploadStepId, status: UploadStepStatus, message?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, message } : s)));
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadSingleFile = useCallback(
    async (file: File, folderId: string): Promise<string> => {
      setSteps(initialSteps());
      updateStep("upload", "active");
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("parentId", folderId);

        const response = await fetch("/api/drive/upload", { method: "POST", body: form });
        const data = (await response.json().catch(() => ({}))) as {
          file?: { id: string; name: string };
          message?: string;
        };

        if (!response.ok || !data.file) {
          throw new Error(data.message ?? "Falha ao enviar o arquivo.");
        }

        updateStep("upload", "done");
        const message = await notifyReadFile(data.file.id, data.file.name ?? file.name, folderId, updateStep);
        setSteps((prev) => prev.map((s) => (s.status === "pending" ? { ...s, status: "skip" } : s)));
        return message;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro no upload.";
        updateStep("upload", "error", message);
        throw new Error(message);
      }
    },
    [updateStep]
  );

  // Processa em sequência, um arquivo de cada vez — evita disparar várias
  // requisições simultâneas pra IA e permite acompanhar o progresso de cada
  // arquivo individualmente na mesma timeline.
  const uploadFiles = useCallback(
    async (
      files: FileList | File[],
      folderId: string,
      onDone: (msg?: string) => void,
      onError: (msg: string) => void
    ) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setIsUploading(true);
      const results: string[] = [];
      const errors: string[] = [];

      try {
        for (let i = 0; i < list.length; i++) {
          const file = list[i];
          setCurrentFile({ index: i + 1, total: list.length, name: file.name });
          try {
            const message = await uploadSingleFile(file, folderId);
            results.push(`${file.name}: ${message}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Erro no upload.";
            errors.push(`${file.name}: ${message}`);
          }
        }

        if (list.length === 1) {
          if (errors.length > 0) onError(errors[0]);
          else onDone(results[0]);
        } else {
          const summary = `${results.length} de ${list.length} arquivo(s) processado(s) com sucesso.${
            errors.length > 0 ? ` ${errors.length} com erro.` : ""
          }`;
          onDone(summary);
        }
      } finally {
        setIsUploading(false);
        setCurrentFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [uploadSingleFile]
  );

  return {
    isUploading,
    currentFile,
    openFilePicker,
    uploadFiles,
    fileInputRef,
    steps
  };
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
  updateStep: (id: UploadStepId, status: UploadStepStatus, message?: string) => void
): Promise<string> {
  try {
    const resp = await fetch("/api/drive/read-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, fileName, parentFolderId: folderId })
    });

    if (!resp.body) {
      return "Arquivo enviado.";
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

    if (!result) return "Arquivo enviado.";
    if (result.skipped) return `Arquivo enviado. Leitura ignorada: ${result.skipReason ?? "tipo não suportado"}`;
    if (result.fieldsExtracted?.length) return `Arquivo enviado e lido pela IA. Campos preenchidos: ${result.fieldsExtracted.join(", ")}`;
    if (result.error) return `Arquivo enviado. Erro na leitura: ${result.error}`;
    return "Arquivo enviado. Nenhum campo extraído.";
  } catch {
    return "Arquivo enviado.";
  }
}
