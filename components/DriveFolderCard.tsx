import { FolderOpen } from "lucide-react";

type DriveFolderCardProps = {
  path: string;
  folderId?: string | null;
  onOpenBrowser?: () => void;
};

export function DriveFolderCard({ path, folderId, onOpenBrowser }: DriveFolderCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <FolderOpen size={18} className="shrink-0 text-slate-400" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Caminho
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-950">
            {path || "—"}
          </p>
        </div>
      </div>
      {folderId && onOpenBrowser ? (
        <button
          onClick={onOpenBrowser}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-navy-800 bg-white px-4 text-sm font-semibold text-navy-800 transition hover:bg-slate-100"
        >
          <FolderOpen size={14} />
          Abrir no Google Drive
        </button>
      ) : (
        <span className="text-sm text-slate-400">Pasta ainda não criada</span>
      )}
    </div>
  );
}
