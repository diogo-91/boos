"use client";

import { useEffect, useState } from "react";
import { FileText, Folder, Loader2 } from "lucide-react";
import type { DriveFile } from "@/app/api/drive/arquivos/route";

type DriveFileListProps = {
  folderId?: string | null;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getFileTypeLabel(mimeType: string, name: string): string {
  if (mimeType === FOLDER_MIME) return "PASTA";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) return "DOC";
  if (mimeType.includes("spreadsheetml") || mimeType.includes("ms-excel")) return "XLS";
  if (mimeType === "application/vnd.google-apps.document") return "GDOC";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "GSHEET";

  const ext = name.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 4 ? ext : "ARQ";
}

export function DriveFileList({ folderId }: DriveFileListProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folderId) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/drive/arquivos?folderId=${folderId}`);
        const data = (await response.json()) as { files?: DriveFile[]; message?: string };

        if (!response.ok) throw new Error(data.message ?? "Erro ao carregar arquivos.");
        if (!cancelled) setFiles(data.files ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar arquivos.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [folderId]);

  if (!folderId) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Pasta no Drive ainda não criada.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" />
        Carregando arquivos...
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (!files.length) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Nenhum arquivo encontrado nesta pasta.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {files.map((file) => (
        <li key={file.id}>
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 transition hover:border-navy-700 hover:bg-white"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">
              {file.mimeType === FOLDER_MIME
                ? <Folder size={16} className="text-yellow-400" />
                : <FileText size={16} className="text-slate-400" />
              }
            </span>
            <div className="min-w-0">
              <p className="truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{getFileTypeLabel(file.mimeType, file.name)}</p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
