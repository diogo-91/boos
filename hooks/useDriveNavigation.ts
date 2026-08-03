"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  // Só a navegação mais recente pode aplicar seu resultado ao estado — sem
  // isso, se a resposta da pasta clicada primeiro chegar depois da resposta
  // da pasta clicada em seguida, a listagem mostra o conteúdo antigo com o
  // breadcrumb novo, até a próxima navegação.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadFiles = useCallback(async (folderId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/drive/arquivos?folderId=${folderId}`, {
        signal: controller.signal
      });
      const data = (await response.json()) as { files?: DriveFile[]; message?: string };

      if (requestId !== requestIdRef.current) return;
      if (!response.ok) throw new Error(data.message ?? "Erro ao carregar arquivos.");
      setFiles(data.files ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar arquivos.");
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
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
