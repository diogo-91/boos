"use client";

import { useState } from "react";
import { todayInputValue } from "@/lib/date-utils";
import { FormField } from "@/components/forms/FormField";
import { FormModalFooter } from "@/components/forms/FormModalFooter";
import { DateInput } from "@/components/forms/inputs";
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
      <FormModalFooter onCancel={onClose} onConfirm={handleConfirm} isSaving={isSaving} />
    </Modal>
  );
}
