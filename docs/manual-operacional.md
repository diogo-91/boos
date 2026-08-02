# Manual operacional

Guia de uso do sistema, tela por tela. Para arquitetura e detalhes de
implementação, veja a [documentação técnica](documentacao-tecnica.md).

## Sumário

1. [Como o sistema funciona](#1-como-o-sistema-funciona)
2. [Acesso](#2-acesso)
3. [Dashboard](#3-dashboard)
4. [Lista de clientes](#4-lista-de-clientes)
5. [Cadastro de cliente](#5-cadastro-de-cliente)
6. [Ficha do cliente](#6-ficha-do-cliente)
7. [Cadastro de processo](#7-cadastro-de-processo)
8. [Ficha do processo](#8-ficha-do-processo)
9. [Google Drive](#9-google-drive)
10. [Leitura de documentos por IA](#10-leitura-de-documentos-por-ia)
11. [Rotinas automáticas](#11-rotinas-automáticas)
12. [Status — referência](#12-status--referência)

---

## 1. Como o sistema funciona

Três peças conversando entre si:

- **A interface** (este sistema) — onde se cadastra, consulta e atualiza.
- **O banco de dados** — onde os dados ficam guardados de verdade.
- **O Google Drive** — onde os documentos ficam guardados.

O que amarra os três é o **status do cliente**. Cada status corresponde a uma
pasta na raiz do Drive. Um cliente Ativo tem a pasta dele dentro de `02_ativos`;
se ele for arquivado, a pasta é movida para `01_arquivados` automaticamente.

A ligação funciona nos dois sentidos:

- **Do sistema para o Drive** — ao mudar o status na ficha, a pasta se move.
- **Do Drive para o sistema** — se alguém criar uma pasta de cliente ou arrastar
  uma pasta de um status para outro direto no Drive, uma rotina periódica
  detecta e atualiza o cadastro.

Por isso não é preciso manter as duas pontas alinhadas manualmente.

### Estrutura das pastas

```
Escritório Boos
├── 01_arquivados
├── 02_ativos
│   └── maria_aparecida_souza          ← pasta do cliente
│       ├── documentos_pessoais
│       ├── comunicacao
│       ├── procuracao.pdf
│       ├── contrato_honorarios.pdf
│       └── 0003312-07.2024_acidente_trabalho   ← pasta do processo
│           ├── inicial
│           └── peticoes_subsequentes
├── 03_cancelados
├── 04_contratacao
├── 05_dativos
├── 06_parceiros
└── 07_sarandi
```

No Drive os nomes usam minúsculas e underscore (`maria_aparecida_souza`) — é um
padrão técnico para a automação não quebrar. Na interface o nome sempre aparece
formatado ("Maria Aparecida Souza").

---

## 2. Acesso

O sistema é acessado por link, sem instalação, do computador ou do celular.

1. Abra o endereço do sistema.
2. Informe e-mail e senha.
3. O acesso cai direto no Dashboard.

Qualquer endereço acessado sem estar logado redireciona para a tela de login e,
depois de entrar, o sistema leva de volta para a página que se tentou abrir.

Para sair, use o ícone de saída no canto superior direito.

> As contas de acesso são criadas pelo administrador do sistema, no painel do
> Supabase. Não há autocadastro nem recuperação de senha pela tela de login.

---

## 3. Dashboard

Visão geral da base, dividida em quatro blocos.

### Indicadores do topo

| Indicador | O que mostra |
| --- | --- |
| Total de Clientes | Quantos clientes existem, e quantos já têm pasta vinculada no Drive |
| Total de Processos | Quantos processos existem, e quantos clientes ainda não têm processo |
| Parceiros Ativos | Quantos parceiros distintos aparecem como indicação de algum cliente |

### Clientes por Status / Processos por Status

Barras proporcionais com a contagem de cada status. Os cinco status atuais
aparecem sempre, mesmo zerados. Status legados só aparecem se ainda houver
registros neles.

Abaixo dos processos, a mesma leitura por **Modelo de Cobrança**.

### Top Parceiros e Indicadores Rápidos

Os cinco parceiros com mais clientes indicados e seis leituras de acompanhamento:
percentual de clientes ativos, clientes sem processo, processos ativos, processos
em audiência, clientes em contratação e percentual de clientes com Drive
vinculado.

### Últimos cadastros

Duas listas de atalho — clientes e processos — em que cada linha é clicável e
leva direto para a ficha.

> **Atenção:** apesar do título "Últimos Clientes Cadastrados", hoje essas listas
> **não** mostram os cadastros mais recentes. Os dados chegam ordenados por nome
> (clientes) e por número (processos), e o painel pega os últimos dessa ordem —
> na prática, os finais do alfabeto. Use as listas como atalho, não como registro
> do que entrou por último. Está mapeado para correção.

---

## 4. Lista de clientes

Cada linha é **um cliente**, mesmo que ele tenha vários processos. Para ver os
processos, abra a ficha.

No computador a lista aparece como tabela; no celular, como cartões. O conteúdo é
o mesmo.

### Busca

O campo de busca procura ao mesmo tempo em:

- nome, razão social e nome fantasia do cliente;
- CPF/CNPJ e RG/Inscrição Estadual;
- parceiro de indicação e origem;
- e, nos processos daquele cliente: número, parte contrária, tipo de ação,
  localização e modelo de cobrança.

A busca ignora acentos e maiúsculas — "jose" encontra "José".

### Filtros

| Filtro | Observação |
| --- | --- |
| Status do Cliente | Filtra pelo status atual |
| Status do Processo | Mostra clientes que tenham **pelo menos um** processo nesse status |
| Cobrança | Mesma lógica: pelo menos um processo com aquele modelo |
| Parceiro | Filtra pelo parceiro de indicação |

Os filtros se combinam. Ao filtrar por status de processo ou por cobrança,
clientes sem nenhum processo saem da lista — não haveria como avaliá-los por
esse critério.

Se a combinação não retornar nada, aparece um aviso com o botão **Limpar
filtros**.

### Botões de ação

- **+ Cliente** — abre o cadastro de cliente.
- **+ Processo** — abre o cadastro de processo (com escolha do cliente).
- **Google Drive** — abre o navegador de arquivos na raiz do escritório.

---

## 5. Cadastro de cliente

Aberto pelo botão **+ Cliente**.

### Campos

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| Tipo | — | Pessoa Física ou Pessoa Jurídica |
| Nome Completo / Razão Social | **sim** | — |
| Nome Fantasia | — | Só habilita para Pessoa Jurídica |
| CPF / CNPJ | **sim** | Pode digitar com ou sem pontuação |
| RG / Inscrição Estadual | — | — |
| Data de Nascimento / Abertura | — | — |
| Estado Civil | — | Só habilita para Pessoa Física |
| Status do Cliente | **sim** | Define em qual pasta do Drive o cliente vai morar |
| Telefone / WhatsApp | — | — |
| E-mail | — | Validado se preenchido |
| Endereço | — | — |
| Origem do Cliente | — | Indicação Direta, Parceiro, Marketing, Dativo ou Outro |
| Parceiro de Indicação | — | — |
| % de Honorário ao Parceiro | — | Entre 0 e 100 |

### Controle de duplicidade

Ao salvar, o sistema confere se já existe outro cliente com o mesmo documento ou
o mesmo nome:

- **Mesmo CPF/CNPJ** → bloqueia o cadastro e mostra de quem é o documento. A
  comparação ignora pontuação, então `123.456.789-00` e `12345678900` são
  tratados como o mesmo documento.
- **Mesmo nome** → não bloqueia. Mostra um aviso amarelo dizendo qual cliente já
  existe; clicar em **Salvar** de novo confirma e cadastra assim mesmo. Homônimos
  são comuns e legítimos.

### O que acontece ao salvar

1. O cliente é gravado no banco.
2. A pasta dele é criada no Drive, dentro da pasta do status escolhido, já com
   as subpastas `documentos_pessoais` e `comunicacao`.
3. A lista é atualizada e o cliente aparece no topo.

Se a criação da pasta falhar (Drive fora do ar, por exemplo), **o cadastro não é
perdido** — o cliente fica salvo sem pasta, e ela pode ser criada depois pelo
botão **Drive** na ficha.

---

## 6. Ficha do cliente

Aberta pelo botão **Abrir** na lista.

### Cabeçalho

Nome, status atual e — para clientes ativos — desde quando está ativo. Ao lado, o
seletor de status e três botões: **Editar**, **+ Processo** e **Drive**.

### Mudança de status

Basta escolher o novo status no seletor. Três deles pedem uma data antes de
confirmar:

| Status | Data pedida |
| --- | --- |
| Ativo | Data de Ativação |
| Arquivado | Data de Finalização |
| Cancelado | Data de Finalização |

A data já vem preenchida com a de hoje e pode ser trocada — útil para registrar
uma mudança que aconteceu na semana passada.

Ao confirmar, três coisas acontecem: o status é gravado, a pasta é movida no
Drive para a pasta do novo status, e a mudança entra no Histórico de Status.

### Seções da ficha

| Seção | Conteúdo |
| --- | --- |
| Identificação | Tipo, CPF/CNPJ (formatado), RG/IE, nome, data de nascimento/abertura, estado civil |
| Histórico no Escritório | Datas de cadastro, ativação e finalização |
| Histórico de Status | Todas as mudanças de status, da mais recente para a mais antiga |
| Contato | Telefone, e-mail (clicável) e endereço |
| Origem e Parceria | Origem, parceiro e percentual de repasse |
| Processos Vinculados | Tabela dos processos do cliente, cada um com link para a ficha |
| Pasta no Drive | Caminho da pasta e botão para abrir o navegador de arquivos |

### Botão Drive

- Se o cliente **já tem** pasta, abre o navegador de arquivos nela.
- Se **ainda não tem**, cria a pasta na hora (com as subpastas padrão) e abre.

---

## 7. Cadastro de processo

Aberto pelo botão **+ Processo**, tanto na lista quanto na ficha do cliente.
Quando aberto pela ficha, o cliente já vem preenchido e travado.

### Campos

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| Cliente Vinculado | **sim** | — |
| Nº do Processo (CNJ) | — | Pode ficar vazio; salva como "A definir" |
| Parte Contrária | — | — |
| Tipo de Ação | — | — |
| Status do Processo | — | Começa em Ativo |
| Vara | — | — |
| Data de Protocolo | — | — |
| Data de Encerramento | — | — |
| Modelo de Cobrança | — | Indefinido, Entrada, Êxito, Entrada + Êxito ou Recorrente |
| Valor de Entrada | — | Formato de moeda: `R$ 1.500,00` |
| % de Êxito | — | Entre 0 e 100 |
| Localização do Processo | — | Projudi, Eproc PR, Eproc SP ou Outro |
| Anotações | — | Texto livre |

O número CNJ é opcional de propósito: dá para cadastrar o processo assim que o
caso entra e preencher o número quando o protocolo sair.

### O que acontece ao salvar

O processo é gravado e a pasta dele é criada dentro da pasta do cliente, já com
as subpastas `inicial` e `peticoes_subsequentes`. Se o cliente ainda não tiver
pasta no Drive, o processo é salvo mesmo assim, sem pasta.

---

## 8. Ficha do processo

Aberta pelo número do processo, na ficha do cliente ou no Dashboard.

### Cabeçalho

Número e tipo de ação, o selo de status e o seletor para alterá-lo. O link no
topo volta para a ficha do cliente.

### Mudança de status

Arquivado, Cancelado e Encerrado pedem a **Data de Encerramento** antes de
confirmar. Os demais aplicam direto. Toda mudança entra no Histórico de Status.

### Seções da ficha

| Seção | Conteúdo |
| --- | --- |
| Dados do Processo | Cliente, parte contrária, tipo de ação, vara, localização, datas e duração |
| Histórico de Status | Todas as mudanças registradas |
| Cobrança Acordada | Modelo, valor de entrada e % de êxito |
| Documentos e Anotações | Pasta do processo, lista de arquivos e campo de anotações |

### Duração

Calculada automaticamente a partir da data de protocolo:

- processo em curso → tempo até hoje, com o rótulo `(em curso)`;
- processo encerrado → tempo entre protocolo e encerramento, com `(encerrado)`.

Aparece em anos e meses ("2 anos e 3 meses"); abaixo de um mês, mostra
"menos de 1 mês".

### Anotações

Campo de texto livre para observações internas. O botão **Salvar anotações** só
aparece quando há algo alterado.

---

## 9. Google Drive

O navegador de arquivos abre em janela sobre a tela atual e pode ser fechado pelo
X, clicando fora ou com a tecla Esc.

Onde ele abre depende de onde foi chamado:

| Origem | Abre em |
| --- | --- |
| Lista de clientes | Raiz do escritório |
| Ficha do cliente | Pasta daquele cliente |
| Ficha do processo | Pasta daquele processo |

### O que dá para fazer

- **Navegar** — clique no nome de uma pasta para entrar. O caminho no topo mostra
  onde você está; clique em qualquer parte dele para voltar.
- **Abrir arquivo** — clique no nome; abre em nova aba, no Google Drive.
- **Nova Pasta** — cria uma pasta no local atual.
- **Upload Arquivo** — envia um arquivo para a pasta atual.
- **Excluir** — o ícone de lixeira no fim da linha.

A lista mostra nome, tipo, tamanho e data de modificação.

### Autorização para upload

Na primeira vez, aparece **Autorizar upload**: o Google pede permissão para o
sistema enviar arquivos em seu nome. A autorização fica lembrada no navegador —
não é preciso repetir a cada envio, mas ela vale por navegador e por computador.

Se aparecer "Autorize o acesso ao Google Drive primeiro" no meio de um envio,
clique em **Autorizar upload** de novo: a permissão do Google expirou.

---

## 10. Leitura de documentos por IA

Todo arquivo enviado pelo navegador de arquivos passa por uma leitura automática
que tenta extrair dados e preencher o cadastro sozinha.

### Acompanhamento

Durante o processamento aparece uma linha do tempo com seis etapas:

| Etapa | O que está acontecendo |
| --- | --- |
| Enviando arquivo para o Drive | Upload do arquivo |
| Identificando pasta e tipo de documento | Descobrindo de quem é a pasta e que documento é |
| Baixando conteúdo do arquivo | Preparando o conteúdo para leitura |
| Lendo documento com IA | Extração dos dados |
| Localizando cliente/processo | Achando o cadastro correspondente |
| Salvando dados extraídos | Gravando no banco |

Cada etapa mostra ✓ concluída, — pulada ou ✕ com erro. Ao final, uma mensagem
informa quais campos foram preenchidos.

### O que a IA reconhece

| Tipo de documento | Como é identificado | O que extrai |
| --- | --- | --- |
| Documento pessoal | Nome do arquivo (RG, CNH, CPF, identidade) ou pasta `documentos_pessoais` | Nome, CPF/CNPJ, RG/IE, data de nascimento, estado civil, endereço, telefone, nome fantasia |
| Procuração | Nome do arquivo | Dados do outorgante: nome, CPF, RG, estado civil, endereço, telefone, e-mail |
| Contrato de honorários | Nome do arquivo | Modelo de cobrança, valor de entrada, % de êxito e dados do contratante |
| Petição inicial | Nome do arquivo (inicial, petição, protocolo) ou pasta `inicial` | Nº CNJ, tipo de ação, parte contrária, vara/comarca, data de protocolo e dados do autor |

Formatos aceitos: PDF, imagens (JPG, PNG, GIF, WEBP), Word (.doc e .docx),
OpenDocument (.odt), RTF, texto puro, Documentos e Planilhas Google. Arquivos
acima de 20 MB e formatos sem texto legível (ZIP, vídeo, áudio) são pulados.

### Como a IA acha o cadastro certo

Em ordem:

1. A pasta já está vinculada a um processo → atualiza aquele processo.
2. A pasta já está vinculada a um cliente → atualiza aquele cliente.
3. Nenhuma das duas → procura pelo nome da pasta no cadastro e, se achar, vincula
   a pasta ao cliente.
4. Não achou ninguém → cadastra um cliente novo, usando o nome extraído do
   documento ou o nome da pasta, com o status da pasta em que ele está.

Se o CPF/CNPJ extraído já pertencer a outro cadastro, o sistema **atualiza o
cliente existente** em vez de criar um duplicado.

### O que ela não faz

- **Não sobrescreve com "não informado"** — se um dado não estiver claro no
  documento, o campo é deixado como está. Variações como "N/A", "não consta" ou
  "desconhecido" são descartadas.
- **Não inventa número de processo** — só aceita CNJ no formato completo
  (`0000000-00.0000.0.00.0000`).
- **Não relê o mesmo arquivo** — um arquivo já processado e não modificado desde
  então é pulado. Editar o arquivo no Drive faz com que ele seja lido de novo.
- **Contrato de honorários sozinho não cria processo** — ele preenche a cobrança
  de um processo existente. Quem cria processo é a petição inicial.

Vale sempre conferir os dados preenchidos automaticamente na ficha.

---

## 11. Rotinas automáticas

Rodam sozinhas no servidor, sem precisar de ninguém com o sistema aberto.

### Sincronização do Drive — a cada 15 minutos

Verifica o que mudou no Drive desde a última passada e reflete no cadastro:

- pasta de cliente nova dentro de uma pasta de status → cadastra o cliente;
- pasta de cliente movida entre status → atualiza o status no cadastro;
- pasta nova dentro de um cliente → cadastra o processo;
- arquivo novo ou alterado → passa pela leitura por IA.

O horário da última sincronização aparece no topo de todas as telas.

### Varredura completa

Percorre o Drive inteiro, pasta por pasta, em vez de olhar só o que mudou. É a
rotina que se usa em migração ou quando se desconfia que algo ficou para trás.

Como pode demorar mais que o limite de execução do servidor, ela guarda onde
parou e retoma dali na execução seguinte. Ao concluir uma volta inteira, o marco
é limpo e a próxima rodada recomeça do início.

### Sincronização da planilha de parceiros

Lê a planilha de honorários e atualiza os cadastros: completa números CNJ que
estavam como "A definir", ajusta o percentual de êxito, e vincula parceiro e
percentual de repasse aos clientes. Parceiro que ainda não existir é criado.

> As duas últimas rotinas são disparadas pelo administrador do sistema — não há
> botão para elas na interface.

### Proteção contra sobreposição

As varreduras nunca rodam em paralelo. Se uma já estiver em andamento, a outra
não começa — evita cadastro duplicado e leitura repetida. Uma varredura que
travar libera a vez sozinha depois de 10 minutos.

---

## 12. Status — referência

### Status do cliente

| Status | Significado | Pasta no Drive |
| --- | --- | --- |
| Contratação | Recebeu proposta, ainda não assinou | `04_contratacao` |
| Ativo | Procuração e contrato assinados, processo em trâmite | `02_ativos` |
| Audiência | Audiência marcada | `02_ativos` |
| Arquivado | Processos concluídos | `01_arquivados` |
| Cancelado | Iniciou contato e não fechou | `03_cancelados` |

Audiência não tem pasta própria: o cliente continua em andamento, então a pasta
segue nos ativos.

### Status do processo

Os mesmos cinco valores: Contratação, Ativo, Audiência, Arquivado e Cancelado.

### Status legados

Ficaram de versões anteriores e **não aparecem mais** como opção em cadastros
novos. Continuam válidos para os registros que já os usam, e nesse caso o próprio
status permanece visível no seletor até que se escolha outro.

| Legado | Onde aparecia | Substituído por |
| --- | --- | --- |
| Sarandi | Cliente | Tipo de Ação |
| Dativo | Cliente | Origem do Cliente |
| Parceiros | Cliente | Origem do Cliente |
| Andamento | Processo | Ativo |
| Aguard. documentos | Processo | Contratação |
| Aguard. audiência | Processo | Audiência |
| Acordado | Processo | Ativo |
| Encerrado | Processo | Arquivado |

As pastas `05_dativos`, `06_parceiros` e `07_sarandi` continuam existindo no
Drive e sendo lidas pelas rotinas de sincronização.
