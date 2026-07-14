"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  FileText,
  Folder,
  Home,
  Loader2,
  MinusCircle,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle
} from "lucide-react";
import type { DriveFile } from "@/app/api/drive/arquivos/route";
import { useDriveActions } from "@/hooks/useDriveActions";
import { useDriveNavigation } from "@/hooks/useDriveNavigation";
import { useGoogleDriveUpload, type UploadStep } from "@/hooks/useGoogleDriveUpload";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveBrowserProps = {
  isOpen: boolean;
  rootFolderId: string;
  rootFolderName: string;
  onClose: () => void;
};

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === FOLDER_MIME) return "Pasta";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) return "DOC";
  if (mimeType.includes("spreadsheetml") || mimeType.includes("ms-excel")) return "XLS";
  if (mimeType === "application/vnd.google-apps.document") return "GDOC";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "GSHEET";
  return "ARQ";
}

function formatFileSize(size?: string | null): string {
  if (!size) return "—";
  const bytes = Number(size);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

type NewFolderInputProps = {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isLoading: boolean;
};

function NewFolderInput({ onConfirm, onCancel, isLoading }: NewFolderInputProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm(name);
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Nome da nova pasta"
        className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
      />
      <button
        onClick={() => onConfirm(name)}
        disabled={isLoading || !name.trim()}
        className="h-9 rounded-md bg-navy-800 px-4 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-60"
      >
        {isLoading ? "Criando..." : "Criar"}
      </button>
      <button
        onClick={onCancel}
        className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-100"
      >
        Cancelar
      </button>
    </div>
  );
}

type DriveFileRowProps = {
  file: DriveFile;
  isDeleting: boolean;
  onNavigate: (file: DriveFile) => void;
  onDelete: (id: string) => void;
};

function DriveFileRow({ file, isDeleting, onNavigate, onDelete }: DriveFileRowProps) {
  const isDir = file.mimeType === FOLDER_MIME;

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          {isDir
            ? <Folder size={16} className="shrink-0 text-yellow-400" />
            : <FileText size={16} className="shrink-0 text-slate-400" />
          }
          {isDir ? (
            <button
              onClick={() => onNavigate(file)}
              className="font-medium text-navy-800 hover:text-navy-700"
            >
              {file.name}
            </button>
          ) : (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-700 hover:text-navy-800"
            >
              {file.name}
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">{getFileTypeLabel(file.mimeType)}</td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {isDir ? "—" : formatFileSize(file.size)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(file.modifiedTime)}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onDelete(file.id)}
          disabled={isDeleting}
          className="text-slate-300 transition hover:text-red-500 disabled:opacity-40"
          title="Deletar"
        >
          {isDeleting
            ? <Loader2 size={15} className="animate-spin" />
            : <Trash2 size={15} />
          }
        </button>
      </td>
    </tr>
  );
}

function UploadTimeline({ steps }: { steps: UploadStep[] }) {
  return (
    <div className="mx-5 mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Processamento do robô
      </p>
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            {step.status === "done" && <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />}
            {step.status === "active" && <Loader2 size={15} className="shrink-0 animate-spin text-navy-700" />}
            {step.status === "pending" && <Circle size={14} className="shrink-0 text-slate-300" />}
            {step.status === "skip" && <MinusCircle size={15} className="shrink-0 text-slate-300" />}
            {step.status === "error" && <XCircle size={15} className="shrink-0 text-red-500" />}
            <span
              className={
                step.status === "pending"
                  ? "text-slate-400"
                  : step.status === "error"
                  ? "text-red-600"
                  : step.status === "skip"
                  ? "text-slate-400 line-through"
                  : "text-slate-700"
              }
            >
              {step.label}
            </span>
            {step.message && step.status !== "pending" && (
              <span className="text-xs text-slate-400">— {step.message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DriveBrowser({
  isOpen,
  rootFolderId,
  rootFolderName,
  onClose
}: DriveBrowserProps) {
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const {
    breadcrumbs,
    files,
    isLoading,
    error: navError,
    currentFolderId,
    navigateInto,
    navigateTo,
    refresh
  } = useDriveNavigation(rootFolderId, isOpen);

  const {
    isCreatingFolder,
    deletingId,
    createFolder,
    deleteFile
  } = useDriveActions({
    currentFolderId,
    onSuccess: () => {
      refresh();
      setShowNewFolderInput(false);
    },
    onError: setError
  });

  const { isUploading, uploadFile, fileInputRef, steps } = useGoogleDriveUpload();

  useEffect(() => {
    if (navError) setError(navError);
  }, [navError]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  async function handleDelete(fileId: string) {
    const deleted = await deleteFile(fileId);
    if (deleted) {
      refresh();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Documentos</h2>
            <p className="text-xs text-slate-500">
              Navegue pelos documentos armazenados no Google Drive
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewFolderInput((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Plus size={15} />
              Nova Pasta
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-md bg-navy-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-60"
            >
              {isUploading
                ? <Loader2 size={15} className="animate-spin" />
                : <Upload size={15} />
              }
              {isUploading ? "Enviando..." : "Upload Arquivo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadFile(
                    file,
                    currentFolderId,
                    (msg) => { refresh(); setError(null); setAiMessage(msg ?? null); },
                    setError
                  );
                }
              }}
            />
            <button
              onClick={onClose}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {showNewFolderInput && (
          <NewFolderInput
            onConfirm={createFolder}
            onCancel={() => setShowNewFolderInput(false)}
            isLoading={isCreatingFolder}
          />
        )}

        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3 text-sm">
          <button
            onClick={() => navigateTo(-1)}
            className="flex items-center gap-1.5 font-medium text-navy-800 transition hover:text-navy-700"
          >
            <Home size={14} className="text-slate-400" />
            {rootFolderName}
          </button>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-slate-400" />
              <button
                onClick={() => navigateTo(index)}
                className="font-medium text-navy-800 transition hover:text-navy-700"
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {steps.length > 0 && <UploadTimeline steps={steps} />}
          {error && (
            <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {aiMessage && (
            <div className="mx-5 mt-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <Sparkles size={15} className="shrink-0" />
              {aiMessage}
            </div>
          )}

          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Carregando...
            </div>
          ) : files.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Nenhum arquivo encontrado nesta pasta.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Tamanho</th>
                  <th className="px-4 py-3">Modificado</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <DriveFileRow
                    key={file.id}
                    file={file}
                    isDeleting={deletingId === file.id}
                    onNavigate={navigateInto}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
