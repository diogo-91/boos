"use client";

import { useCallback, useEffect, useState } from "react";
import type { DriveFile } from "@/app/api/drive/arquivos/route";

type BreadcrumbEntry = { id: string; name: string };

export function useDriveNavigation(rootFolderId: string, isOpen: boolean) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFolderId =
    breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1].id
      : rootFolderId;

  const loadFiles = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/drive/arquivos?folderId=${folderId}`);
      const data = (await response.json()) as { files?: DriveFile[]; message?: string };

      if (!response.ok) throw new Error(data.message ?? "Erro ao carregar arquivos.");
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar arquivos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setBreadcrumbs([]);
    loadFiles(rootFolderId);
  }, [isOpen, rootFolderId, loadFiles]);

  function navigateInto(file: DriveFile) {
    setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
    loadFiles(file.id);
  }

  function navigateTo(index: number) {
    if (index === -1) {
      setBreadcrumbs([]);
      loadFiles(rootFolderId);
    } else {
      const next = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(next);
      loadFiles(next[next.length - 1].id);
    }
  }

  function refresh() {
    loadFiles(currentFolderId);
  }

  return {
    breadcrumbs,
    files,
    isLoading,
    error,
    currentFolderId,
    navigateInto,
    navigateTo,
    refresh
  };
}
