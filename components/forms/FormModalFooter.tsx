import { Button } from "@/components/ui/Button";

type FormModalFooterProps = {
  onCancel: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  confirmLabel?: string;
};

export function FormModalFooter({
  onCancel,
  onConfirm,
  isSaving,
  confirmLabel = "Salvar"
}: FormModalFooterProps) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 sm:py-4">
      <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
        Cancelar
      </Button>
      <Button onClick={onConfirm} disabled={isSaving}>
        {isSaving ? "Salvando..." : confirmLabel}
      </Button>
    </div>
  );
}
