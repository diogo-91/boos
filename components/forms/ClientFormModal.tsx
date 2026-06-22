"use client";

import { useMemo, useState } from "react";
import type { Client, ClientStatus } from "@/lib/types";
import type { ClientFormValues } from "@/components/OperationalDataProvider";
import { toInputDate } from "@/lib/date-utils";
import { isValidEmail, isValidPercent } from "@/lib/validation";
import { FormField } from "@/components/forms/FormField";
import { DateInput, SelectInput, TextInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type ClientFormModalProps = {
  isOpen: boolean;
  client?: Client;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<unknown>;
};

type ClientFormErrors = Partial<Record<keyof ClientFormValues, string>>;

const CLIENT_STATUS_OPTIONS: ClientStatus[] = [
  "Ativo",
  "Em contratação",
  "Sarandi/IPTU",
  "Dativo",
  "Parceiros",
  "Arquivado",
  "Cancelado"
];

function getInitialValues(client?: Client): ClientFormValues {
  return {
    personType: client?.personType ?? "Pessoa Física",
    legalName: client?.legalName ?? "",
    tradeName: client?.tradeName ?? "",
    document: client?.document ?? "",
    secondaryDocument: client?.secondaryDocument ?? "",
    birthOrOpeningDate: toInputDate(client?.birthOrOpeningDate),
    maritalStatus: client?.maritalStatus ?? "",
    status: client?.status ?? "Em contratação",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    address: client?.address ?? "",
    origin: client?.origin ?? "",
    partner: client?.partner === "Nenhum" ? "" : (client?.partner ?? ""),
    partnerFee: client?.partnerFee === "—" ? "" : (client?.partnerFee ?? "")
  };
}

export function ClientFormModal({ isOpen, client, onClose, onSubmit }: ClientFormModalProps) {
  const initialValues = useMemo(() => getInitialValues(client), [client]);
  const [values, setValues] = useState<ClientFormValues>(initialValues);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function updateField<K extends keyof ClientFormValues>(
    field: K,
    value: ClientFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const next: ClientFormErrors = {};

    if (!values.legalName.trim()) {
      next.legalName = "Informe o nome completo ou razão social.";
    }
    if (!values.document.trim()) {
      next.document = "Informe o CPF ou CNPJ.";
    }
    if (!values.status) {
      next.status = "Selecione o status do cliente.";
    }
    if (!isValidEmail(values.email)) {
      next.email = "Informe um e-mail válido.";
    }
    if (!isValidPercent(values.partnerFee)) {
      next.partnerFee = "Informe um percentual entre 0 e 100.";
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
      title={client ? "Editar cliente" : "Novo cliente"}
      description="Preencha os dados operacionais do cliente."
    >
      <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Tipo" error={errors.personType}>
          <SelectInput
            value={values.personType}
            onChange={(e) => updateField("personType", e.target.value as Client["personType"])}
          >
            <option>Pessoa Física</option>
            <option>Pessoa Jurídica</option>
          </SelectInput>
        </FormField>

        <FormField label="Nome completo / Razão social" error={errors.legalName}>
          <TextInput
            value={values.legalName}
            onChange={(e) => updateField("legalName", e.target.value)}
          />
        </FormField>

        <FormField label="Nome fantasia">
          <TextInput
            disabled={values.personType !== "Pessoa Jurídica"}
            value={values.tradeName}
            onChange={(e) => updateField("tradeName", e.target.value)}
          />
        </FormField>

        <FormField label="CPF/CNPJ" error={errors.document}>
          <TextInput
            value={values.document}
            onChange={(e) => updateField("document", e.target.value)}
          />
        </FormField>

        <FormField label="RG / Inscrição Estadual">
          <TextInput
            value={values.secondaryDocument}
            onChange={(e) => updateField("secondaryDocument", e.target.value)}
          />
        </FormField>

        <FormField label="Data de nascimento / abertura">
          <DateInput
            value={values.birthOrOpeningDate}
            onChange={(e) => updateField("birthOrOpeningDate", e.target.value)}
          />
        </FormField>

        <FormField label="Estado civil">
          <SelectInput
            disabled={values.personType !== "Pessoa Física"}
            value={values.maritalStatus}
            onChange={(e) => updateField("maritalStatus", e.target.value)}
          >
            <option value="">—</option>
            <option>Solteiro</option>
            <option>Casado</option>
            <option>Divorciado</option>
            <option>Viúvo</option>
            <option>União estável</option>
          </SelectInput>
        </FormField>

        <FormField label="Status do cliente" error={errors.status}>
          <SelectInput
            value={values.status}
            onChange={(e) => updateField("status", e.target.value as ClientStatus)}
          >
            {CLIENT_STATUS_OPTIONS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Telefone / WhatsApp">
          <TextInput
            value={values.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </FormField>

        <FormField label="E-mail" error={errors.email}>
          <TextInput
            type="email"
            value={values.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </FormField>

        <FormField label="Endereço">
          <TextInput
            value={values.address}
            onChange={(e) => updateField("address", e.target.value)}
          />
        </FormField>

        <FormField label="Origem do cliente">
          <SelectInput
            value={values.origin}
            onChange={(e) => updateField("origin", e.target.value)}
          >
            <option value="">—</option>
            <option>Indicação direta</option>
            <option>Parceiro</option>
            <option>Marketing</option>
            <option>Dativo</option>
            <option>Outro</option>
          </SelectInput>
        </FormField>

        <FormField label="Parceiro de indicação">
          <TextInput
            value={values.partner}
            onChange={(e) => updateField("partner", e.target.value)}
          />
        </FormField>

        <FormField label="% de honorário ao parceiro" error={errors.partnerFee}>
          <TextInput
            inputMode="decimal"
            placeholder="0"
            value={values.partnerFee}
            onChange={(e) => updateField("partnerFee", e.target.value)}
          />
        </FormField>
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
