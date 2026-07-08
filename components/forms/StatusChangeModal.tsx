"use client";

import { useState } from "react";
import { todayInputValue } from "@/lib/date-utils";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type StatusChangeModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  dateLabel: string;
  onClose: () => void;
  onConfirm: (date: string) => Promise<unknown> | unknown;
};

export function StatusChangeModal({
  isOpen,
  title,
  description,
  dateLabel,
  onClose,
  onConfirm
}: StatusChangeModalProps) {
  const [date, setDate] = useState(todayInputValue());
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm() {
    setIsSaving(true);
    try {
      await onConfirm(date);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={description}>
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <FormField label={dateLabel}>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 sm:py-4">
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </Modal>
  );
}
