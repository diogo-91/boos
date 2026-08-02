# Base Operacional — Escritório Boos

Sistema interno de gestão de clientes e processos jurídicos, com o Google Drive
como repositório de documentos e leitura automática de documentos por IA.

Cada cliente vive em uma pasta do Drive que corresponde ao status dele. Quando o
status muda no sistema, a pasta se move sozinha; quando alguém mexe direto no
Drive, uma rotina periódica traz a mudança de volta para o banco.

## Documentação

| Documento | Para quem | Conteúdo |
| --- | --- | --- |
| [Manual operacional](docs/manual-operacional.md) | uso diário | Cada tela e cada ação, ponto a ponto |
| [Documentação técnica](docs/documentacao-tecnica.md) | desenvolvimento | Arquitetura, modelo de dados, API, integrações, deploy |

### Versão em PDF

Em `docs/pdf/`, para impressão ou envio: `Documentacao-Completa.pdf` (os dois
documentos), `Manual-Operacional.pdf` e `Documentacao-Tecnica.pdf`.

Os markdown são a fonte da verdade — depois de editá-los, regere os PDFs:

```bash
pip install reportlab && python docs/gerar-pdf.py .
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** em modo estrito
- **Tailwind CSS** para estilo
- **Supabase** (PostgreSQL + Auth por e-mail/senha)
- **Google Drive API v3** via service account
- **Claude Haiku** para extração de dados de documentos

## Rodando localmente

Requer Node 20.

```bash
npm install
```

Copie `.env.local.example` para `.env.local` e preencha as variáveis (a lista
completa, com o que cada uma faz, está na
[documentação técnica](docs/documentacao-tecnica.md#variáveis-de-ambiente)).

```bash
npm run dev
```

A aplicação sobe em `http://localhost:3000`. Sem as variáveis do Supabase, ela
entra em modo local e guarda os dados apenas no navegador — útil para mexer na
interface sem tocar na base real.

## Scripts

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```
