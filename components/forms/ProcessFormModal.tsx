"use client";

import { useMemo, useState } from "react";
import type { Client } from "@/lib/types";
import type { ProcessFormValues } from "@/components/OperationalDataProvider";
import { STATUS_OPTIONS } from "@/lib/domain";
import { isValidMoney, isValidPercent } from "@/lib/validation";
import { FormField } from "@/components/forms/FormField";
import {
  DateInput,
  MoneyInput,
  SelectInput,
  TextareaInput,
  TextInput
} from "@/components/forms/inputs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type ProcessFormModalProps = {
  clients: Client[];
  fixedClientId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ProcessFormValues) => Promise<unknown>;
};

type ProcessFormErrors = Partial<Record<keyof ProcessFormValues, string>>;

function getInitialValues(fixedClientId?: string): ProcessFormValues {
  return {
    clientId: fixedClientId ?? "",
    number: "",
    opposingParty: "",
    actionType: "",
    status: "Ativo",
    court: "",
    filingDate: "",
    closingDate: "",
    billingModel: "",
    entryValue: "R$ 0,00",
    successFee: "",
    location: "",
    notes: ""
  };
}

export function ProcessFormModal({
  clients,
  fixedClientId,
  isOpen,
  onClose,
  onSubmit
}: ProcessFormModalProps) {
  const initialValues = useMemo(() => getInitialValues(fixedClientId), [fixedClientId]);
  const [values, setValues] = useState<ProcessFormValues>(initialValues);
  const [errors, setErrors] = useState<ProcessFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function updateField<K extends keyof ProcessFormValues>(
    field: K,
    value: ProcessFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const next: ProcessFormErrors = {};

    if (!values.clientId) {
      next.clientId = "Selecione o cliente vinculado.";
    }
    // CNJ é opcional — pode ser preenchido depois quando disponível
    if (!isValidMoney(values.entryValue)) {
      next.entryValue = "Informe o valor em formato de moeda. Ex.: R$ 1.500,00";
    }
    if (!isValidPercent(values.successFee)) {
      next.successFee = "Informe um percentual entre 0 e 100.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleClose() {
    setValues(initialValues);
    setErrors({});
    onClose();
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSaving(true);
    try {
      await onSubmit(values);
      handleClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo Processo"
      description="Cadastre um processo vinculado a um cliente da base."
    >
      <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Cliente Vinculado" error={errors.clientId}>
          <SelectInput
            disabled={Boolean(fixedClientId)}
            value={values.clientId}
            onChange={(e) => updateField("clientId", e.target.value)}
          >
            <option value="">Selecione</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Nº do Processo (CNJ)" error={errors.number}>
          <TextInput
            value={values.number}
            onChange={(e) => updateField("number", e.target.value)}
          />
        </FormField>

        <FormField label="Parte Contrária">
          <TextInput
            value={values.opposingParty}
            onChange={(e) => updateField("opposingParty", e.target.value)}
          />
        </FormField>

        <FormField label="Tipo de Ação">
          <TextInput
            value={values.actionType}
            onChange={(e) => updateField("actionType", e.target.value)}
          />
        </FormField>

        <FormField label="Status do Processo">
          <SelectInput
            value={values.status}
            onChange={(e) => updateField("status", e.target.value as ProcessFormValues["status"])}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Vara">
          <TextInput
            placeholder="Ex.: Juizado Especial da Fazenda Pública de Sarandi/PR"
            value={values.court}
            onChange={(e) => updateField("court", e.target.value)}
          />
        </FormField>

        <FormField label="Data de Protocolo">
          <DateInput
            value={values.filingDate}
            onChange={(e) => updateField("filingDate", e.target.value)}
          />
        </FormField>

        <FormField label="Data de Encerramento">
          <DateInput
            value={values.closingDate}
            onChange={(e) => updateField("closingDate", e.target.value)}
          />
        </FormField>

        <FormField label="Modelo de Cobrança">
          <SelectInput
            value={values.billingModel}
            onChange={(e) => updateField("billingModel", e.target.value)}
          >
            <option value="">—</option>
            <option>Indefinido</option>
            <option>Entrada</option>
            <option>Êxito</option>
            <option>Entrada + Êxito</option>
            <option>Recorrente</option>
          </SelectInput>
        </FormField>

        <FormField label="Valor de Entrada" error={errors.entryValue}>
          <MoneyInput
            value={values.entryValue}
            onChange={(e) => updateField("entryValue", e.target.value)}
          />
        </FormField>

        <FormField label="% de Êxito" error={errors.successFee}>
          <TextInput
            inputMode="decimal"
            value={values.successFee}
            onChange={(e) => updateField("successFee", e.target.value)}
          />
        </FormField>

        <FormField label="Localização do Processo">
          <SelectInput
            value={values.location}
            onChange={(e) => updateField("location", e.target.value)}
          >
            <option value="">—</option>
            <option>Projudi</option>
            <option>Eproc PR</option>
            <option>Eproc SP</option>
            <option>Outro</option>
          </SelectInput>
        </FormField>

        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Anotações">
            <TextareaInput
              value={values.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </FormField>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 sm:py-4">
        <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </Modal>
  );
}
