"use client";

import { useState } from "react";

type UseDriveActionsProps = {
  currentFolderId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export function useDriveActions({
  currentFolderId,
  onSuccess,
  onError
}: UseDriveActionsProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function createFolder(name: string) {
    setIsCreatingFolder(true);
    try {
      const response = await fetch("/api/drive/pastas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentFolderId })
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? "Erro ao criar pasta.");
      }

      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao criar pasta.");
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function deleteFile(fileId: string): Promise<boolean> {
    setDeletingId(fileId);
    try {
      const response = await fetch(`/api/drive/arquivos/${fileId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? "Erro ao deletar.");
      }

      return true;
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao deletar.");
      return false;
    } finally {
      setDeletingId(null);
    }
  }

  return {
    isCreatingFolder,
    deletingId,
    createFolder,
    deleteFile
  };
}
