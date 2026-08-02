# Tutorial — do primeiro acesso ao processo arquivado

Este tutorial acompanha **um caso do começo ao fim**. Em vez de descrever tela
por tela, ele segue a vida de uma cliente dentro do sistema: da primeira consulta
até o processo arquivado, na ordem em que as coisas acontecem no escritório.

Faça junto, na tela. Cada etapa termina com um **confira** — se o que você está
vendo bate com o descrito, pode seguir.

> Para consultar um campo ou uma regra específica depois, use o
> [manual operacional](manual-operacional.md). Este documento é para aprender o
> caminho; o manual é para tirar dúvida pontual.

## O caso que vamos usar

> **Maria Aparecida Souza** procurou o escritório após um acidente de trabalho.
> Na primeira reunião ela ainda não assinou nada. Duas semanas depois assina
> procuração e contrato. O processo é protocolado, tem audiência, e no fim é
> arquivado.

Troque os dados pelos de um cliente real seu, ou use os do exemplo para treinar.

## Sumário

1. [Entrar no sistema](#etapa-1--entrar-no-sistema)
2. [Cadastrar a cliente](#etapa-2--cadastrar-a-cliente)
3. [Conferir a pasta criada no Drive](#etapa-3--conferir-a-pasta-criada-no-drive)
4. [Subir os documentos pessoais](#etapa-4--subir-os-documentos-pessoais)
5. [Fechar contrato: virar para Ativo](#etapa-5--fechar-contrato-virar-para-ativo)
6. [Abrir o processo](#etapa-6--abrir-o-processo)
7. [Subir a petição inicial](#etapa-7--subir-a-petição-inicial)
8. [Acompanhar o processo](#etapa-8--acompanhar-o-processo)
9. [Encontrar clientes depois](#etapa-9--encontrar-clientes-depois)
10. [Arquivar no fim](#etapa-10--arquivar-no-fim)
11. [Rotina sugerida](#rotina-sugerida)
12. [Quando algo dá errado](#quando-algo-dá-errado)

---

## Etapa 1 — Entrar no sistema

1. Abra o endereço do sistema no navegador. Funciona no computador e no celular.
2. Informe seu e-mail e sua senha.
3. Clique em **Entrar**.

Você cai no **Dashboard**. Guarde três referências que vão estar em toda tela:

- **No topo à esquerda** — a logo do escritório. Clicar nela sempre volta para o
  Dashboard.
- **No topo ao centro** — os links *Dashboard* e *Clientes*. No celular eles
  ficam no botão de menu (as três linhas).
- **Logo abaixo do cabeçalho** — uma linha discreta dizendo quando o Drive foi
  sincronizado pela última vez.

**Confira:** você vê os cartões "Total de Clientes", "Total de Processos" e
"Parceiros Ativos" no alto da tela.

> Se em vez do Dashboard você voltou para a tela de login, a senha ou o e-mail
> estão errados — o sistema avisa em vermelho logo abaixo dos campos.

---

## Etapa 2 — Cadastrar a cliente

Maria ainda não assinou nada, então ela entra como **Contratação** — não como
Ativo. Esse é o ponto mais importante desta etapa: o status que você escolhe aqui
decide **em qual pasta do Drive** ela vai morar.

1. Clique em **Clientes** no menu do topo.
2. Clique no botão **+ Cliente**.
3. Preencha:

| Campo | O que colocar no exemplo |
| --- | --- |
| Tipo | Pessoa Física |
| Nome Completo / Razão Social | Maria Aparecida Souza |
| CPF / CNPJ | 123.456.789-00 |
| RG / Inscrição Estadual | 12.345.678-9 |
| Data de Nascimento | a data dela |
| Estado Civil | Casada |
| Status do Cliente | **Contratação** |
| Telefone / WhatsApp | (44) 99999-0000 |
| E-mail | maria@exemplo.com |
| Endereço | endereço completo |
| Origem do Cliente | Indicação Direta |

4. Clique em **Salvar**.

Só dois campos são obrigatórios: **nome** e **CPF/CNPJ**. O resto pode ficar em
branco e ser completado depois — inclusive sozinho, pela leitura dos documentos,
como você vai ver na etapa 4.

Pode digitar o CPF com ou sem pontinho: o sistema guarda só os números e mostra
formatado.

**Confira:** aparece um aviso verde "Cliente cadastrado com sucesso" no canto
inferior, e Maria surge no topo da lista com o selo amarelo **Contratação**.

### Se aparecer aviso de duplicidade

O sistema confere duplicidade ao salvar, e trata dois casos de formas diferentes:

- **CPF/CNPJ já cadastrado** — ele **bloqueia** e diz de quem é o documento. Não
  há como forçar. Procure o cliente existente em vez de criar outro.
- **Nome já cadastrado** — ele **avisa em amarelo** mas não bloqueia. Se for
  mesmo outra pessoa (homônimo), clique em **Salvar** de novo para confirmar.

---

## Etapa 3 — Conferir a pasta criada no Drive

Você não precisa criar pasta nenhuma no Drive. Ela já foi criada — vamos ver.

1. Na lista de clientes, clique em **Abrir** na linha da Maria.
2. Role até a seção **Pasta no Drive**, no fim da ficha.
3. Leia o caminho: `04_contratacao › maria_aparecida_souza`.
4. Clique em **Abrir no Google Drive**.

Abre uma janela sobre a tela mostrando o conteúdo da pasta. Dentro já existem
duas subpastas prontas: `documentos_pessoais` e `comunicacao`.

**Confira:** você vê as duas subpastas listadas.

Repare no caminho: `04_contratacao` é a pasta do status **Contratação**. É assim
que sistema e Drive ficam alinhados — e é por isso que o status importa tanto.

> Os nomes no Drive vêm em minúsculas e com underscore no lugar do espaço
> (`maria_aparecida_souza`). É proposital: garante que a automação não quebre. Na
> interface você sempre vê "Maria Aparecida Souza", formatado.

Para fechar a janela: botão **X**, clique fora dela ou tecla **Esc**.

---

## Etapa 4 — Subir os documentos pessoais

Aqui está a parte que economiza mais tempo: você sobe o RG e o sistema preenche
o cadastro sozinho.

1. Com a janela do Drive aberta na pasta da Maria, entre em
   **documentos_pessoais** clicando no nome.
2. Clique em **Upload Arquivo**.

### Só na primeira vez: autorizar

Se em vez de "Upload Arquivo" aparecer **Autorizar upload**, clique nele. O
Google vai pedir permissão para o sistema enviar arquivos em seu nome — aceite.

Isso acontece uma vez por navegador. No seu computador do escritório você
autoriza hoje e não precisa repetir; se depois abrir do celular, vai autorizar lá
também.

### Enviando

3. Escolha o arquivo do RG (PDF ou foto).
4. Acompanhe a **linha do tempo** que aparece na tela.

São seis etapas, e elas contam o que está acontecendo:

| Etapa | O que o sistema está fazendo |
| --- | --- |
| Enviando arquivo para o Drive | Subindo o arquivo |
| Identificando pasta e tipo de documento | Vendo de quem é a pasta e que documento é esse |
| Baixando conteúdo do arquivo | Preparando para leitura |
| Lendo documento com IA | Extraindo os dados |
| Localizando cliente/processo | Achando o cadastro da Maria |
| Salvando dados extraídos | Gravando |

5. No fim aparece uma mensagem azul dizendo quais campos foram preenchidos.

**Confira:** feche a janela do Drive e olhe a seção **Identificação** da ficha.
Campos que você deixou em branco agora estão preenchidos — RG, data de
nascimento, endereço, conforme o que estava legível no documento.

### O que a leitura automática reconhece

| Documento | Como o sistema identifica | O que ele tira |
| --- | --- | --- |
| RG, CNH, CPF, cartão CNPJ | Nome do arquivo ou pasta `documentos_pessoais` | Nome, documento, RG, nascimento, estado civil, endereço, telefone |
| Procuração | Nome do arquivo com "procuracao" | Dados do outorgante |
| Contrato de honorários | Nome do arquivo com "contrato" | Modelo de cobrança, valor de entrada, % de êxito |
| Petição inicial | Nome do arquivo ou pasta `inicial` | Nº CNJ, tipo de ação, parte contrária, vara, data |

Aceita PDF, foto, Word, Documentos e Planilhas Google. Arquivo acima de 20 MB é
pulado — o sistema avisa na linha do tempo.

**Nomeie os arquivos com clareza.** `procuracao_maria.pdf` é reconhecido na hora;
`digitalizar0001.pdf` provavelmente cai em "outro" e rende bem menos.

> **Sempre confira o que foi preenchido.** A leitura é boa, mas é automática. Se
> um dado não estava legível, o sistema deixa o campo em branco em vez de
> inventar — o que ele nunca faz é escrever "não informado" por cima de algo que
> você já tinha preenchido.

Suba agora, do mesmo jeito, a procuração e o contrato de honorários — esses vão
na **raiz** da pasta da Maria, não em `documentos_pessoais`.

---

## Etapa 5 — Fechar contrato: virar para Ativo

Duas semanas depois Maria assinou. Hora de mudar o status.

1. Na ficha da Maria, no alto à direita, abra o seletor de status.
2. Escolha **Ativo**.
3. Uma janela pede a **Data de Ativação**. Já vem com a data de hoje — se ela
   assinou na semana passada, corrija aqui.
4. Clique em **Salvar**.

Três coisas acontecem de uma vez:

- o status vira Ativo;
- **a pasta se move sozinha** no Drive, de `04_contratacao` para `02_ativos`;
- a mudança fica registrada no **Histórico de Status**.

**Confira:** role até **Pasta no Drive**. O caminho agora é
`02_ativos › maria_aparecida_souza`. E na seção **Histórico de Status** apareceu
a linha "Contratação → Ativo" com a data.

Você nunca precisa arrastar pasta no Drive. Mude o status aqui e o Drive
acompanha.

> Três status pedem data ao serem escolhidos: **Ativo** (data de ativação),
> **Arquivado** e **Cancelado** (data de finalização). Os outros aplicam direto.

---

## Etapa 6 — Abrir o processo

1. Ainda na ficha da Maria, clique em **+ Processo**.
2. O campo **Cliente Vinculado** já vem preenchido com ela e travado — é assim
   que você garante que o processo vai para o cliente certo.
3. Preencha o que tiver:

| Campo | No exemplo |
| --- | --- |
| Nº do Processo (CNJ) | *deixe em branco por enquanto* |
| Parte Contrária | Construtora Vega Ltda. |
| Tipo de Ação | Acidente de trabalho |
| Status do Processo | Ativo |
| Vara | Vara do Trabalho de Maringá/PR |
| Data de Protocolo | a data do protocolo |
| Modelo de Cobrança | Êxito |
| % de Êxito | 30 |
| Localização do Processo | Projudi |

4. Clique em **Salvar**.

**O número CNJ pode ficar vazio** — é de propósito. Cadastre o processo assim que
o caso entra e preencha o número quando o protocolo sair. Enquanto isso ele
aparece como "A definir".

**Confira:** o processo aparece na seção **Processos Vinculados** da ficha da
Maria. Clique nele e olhe a seção **Pasta do Processo**: foi criada uma pasta
dentro da pasta dela, já com `inicial` e `peticoes_subsequentes` dentro.

### Cadastrando pela lista

Dá para cadastrar processo direto da lista de clientes, pelo botão **+ Processo**
lá do topo. A única diferença é que aí você escolhe o cliente na lista. Abrir
pela ficha é mais seguro — não tem como errar o cliente.

---

## Etapa 7 — Subir a petição inicial

1. Na ficha do processo, na seção **Documentos e Anotações**, clique em **Abrir
   no Google Drive**.
2. Entre na subpasta **inicial**.
3. Clique em **Upload Arquivo** e escolha a petição.

Acompanhe a linha do tempo de novo. Desta vez o sistema entende que a pasta é de
um processo, e os dados extraídos vão para o **processo**, não para a cliente.

**Confira:** volte para a ficha do processo. Se a petição trazia o número CNJ, o
campo **Nº do Processo** parou de mostrar "A definir" e agora tem o número.
Parte contrária, vara e data de protocolo também podem ter sido preenchidos.

> O sistema só aceita CNJ no formato completo
> (`0000000-00.0000.0.00.0000`). Se o documento tiver o número escrito de outro
> jeito, ele prefere não preencher a arriscar um número errado.

Petições posteriores — contestação, recursos, manifestações — vão em
`peticoes_subsequentes`.

---

## Etapa 8 — Acompanhar o processo

O dia a dia do caso. Três coisas que você vai fazer com frequência:

### Registrar audiência marcada

1. Abra a ficha do processo.
2. No seletor de status, escolha **Audiência**.

Aplica direto, sem pedir data. O selo muda para azul e a mudança entra no
histórico.

> Audiência não move a pasta no Drive — o cliente continua em andamento, então a
> pasta segue em `02_ativos`. Só os status que têm pasta própria movem.

### Anotar o que aconteceu

1. Na ficha do processo, role até **Anotações Livres**.
2. Escreva. Exemplo: *"Audiência de conciliação em 12/03. Parte contrária propôs
   acordo de R$ 8.000, cliente recusou."*
3. O botão **Salvar anotações** aparece assim que você digita algo. Clique nele.

O botão só existe quando há mudança — se você não vê o botão, é porque não há
nada pendente para salvar.

### Ver o histórico

Tanto a ficha do cliente quanto a do processo têm a seção **Histórico de
Status**, listando toda mudança da mais recente para a mais antiga. É o registro
de quando cada coisa aconteceu — útil quando alguém pergunta "desde quando esse
processo está parado?".

E a seção **Dados do Processo** mostra a **Duração** calculada sozinha a partir
da data de protocolo: "2 anos e 3 meses (em curso)".

---

## Etapa 9 — Encontrar clientes depois

Com a base cheia, é isso que você mais vai usar. Vá em **Clientes**.

### Busca

O campo de busca no topo procura em quase tudo de uma vez: nome, razão social,
nome fantasia, CPF/CNPJ, RG, parceiro, origem — **e também nos processos do
cliente**: número, parte contrária, tipo de ação, vara e modelo de cobrança.

Isso significa que dá para achar cliente pelo que você lembra do caso:

| Você digita | Encontra |
| --- | --- |
| `maria` | Maria Aparecida Souza |
| `12345678900` | pelo CPF, com ou sem pontuação |
| `vega` | os clientes que litigam contra a Construtora Vega |
| `acidente` | todos os casos de acidente de trabalho |

Não precisa se preocupar com acento nem maiúscula: `jose` encontra "José".

### Filtros

Abaixo da busca há quatro filtros, e eles **se combinam**:

- **Status do Cliente** — o status atual dele.
- **Status do Processo** — mostra clientes que tenham *pelo menos um* processo
  naquele status.
- **Cobrança** — mesma lógica, pelo modelo de cobrança.
- **Parceiro** — quem indicou.

Exemplos do que dá para responder com eles:

| Pergunta | Como filtrar |
| --- | --- |
| Quais clientes têm audiência marcada? | Status do Processo = Audiência |
| Quem ainda não fechou contrato? | Status do Cliente = Contratação |
| Quais casos são por êxito? | Cobrança = Êxito |
| O que veio do Dr. Fulano? | Parceiro = Fulano |

Combinando: Status do Cliente = Ativos **e** Cobrança = Êxito devolve os clientes
ativos com pelo menos um processo por êxito.

> **Detalhe que confunde:** ao filtrar por status de processo ou por cobrança,
> clientes **sem nenhum processo somem da lista**. Faz sentido — não haveria como
> avaliá-los por esse critério —, mas se um cliente "sumiu", verifique se é isso.

Para limpar tudo de uma vez, use o botão **Limpar filtros** que aparece quando a
busca não devolve nada.

---

## Etapa 10 — Arquivar no fim

O processo terminou, sentença transitada em julgado.

### Primeiro o processo

1. Abra a ficha do processo.
2. No seletor de status, escolha **Arquivado**.
3. Informe a **Data de Encerramento** e salve.

**Confira:** a **Duração** agora mostra o tempo total entre protocolo e
encerramento, com o rótulo `(encerrado)` em vez de `(em curso)`.

### Depois o cliente

Se **todos** os processos dele terminaram, arquive o cliente também:

1. Abra a ficha da Maria.
2. Status → **Arquivado**.
3. Informe a **Data de Finalização** e salve.

**Confira:** o caminho no Drive virou `01_arquivados › maria_aparecida_souza`. A
pasta inteira, com todos os documentos e processos, foi movida junto.

> **Arquivado e Cancelado não são a mesma coisa.** *Arquivado* é processo que
> rodou e terminou. *Cancelado* é cliente que procurou o escritório e não fechou.
> Manter separado é o que evita a bagunça de misturar quem virou caso com quem
> nunca virou.

---

## Rotina sugerida

Uma forma de organizar o uso. Adapte ao seu ritmo.

### Todo dia

1. Abra o **Dashboard** e olhe os três cartões do topo.
2. Em **Clientes**, filtre por Status do Processo = **Audiência** para ver o que
   está marcado.
3. Suba no Drive os documentos que chegaram, na pasta certa de cada caso.

### Toda semana

1. Filtre por Status do Cliente = **Contratação** e revise: quem está parado há
   tempo demais? Ou fecha, ou vira Cancelado.
2. Filtre por Status do Processo = **Ativo** e confira se algum precisa de
   andamento.
3. No Dashboard, olhe o indicador **Sem Processo** — clientes ativos sem processo
   cadastrado costumam ser cadastro pela metade.

### Todo mês

1. No Dashboard, confira **Drive Vinculado**. Se não estiver perto de 100%, há
   cliente sem pasta.
2. Revise **Clientes por Status** e veja se a distribuição faz sentido.
3. Olhe **Top Parceiros por Indicações** para os acertos de repasse.

---

## Quando algo dá errado

| Situação | O que fazer |
| --- | --- |
| "Este CPF/CNPJ já está cadastrado" | O cliente já existe. Busque pelo documento e abra a ficha dele em vez de criar outra. |
| Avisou que o nome já existe | É só aviso. Sendo outra pessoa, clique em **Salvar** de novo para confirmar. |
| "Autorize o acesso ao Google Drive primeiro" | A permissão do Google expirou. Clique em **Autorizar upload** e refaça o envio. |
| A pasta do cliente não foi criada | Abra a ficha e clique no botão **Drive**. Ele cria a pasta na hora. O cadastro nunca se perde por causa disso. |
| Subi o arquivo e nada foi preenchido | Veja a linha do tempo: ela diz onde parou. Costuma ser nome de arquivo genérico, documento pouco legível ou arquivo acima de 20 MB. |
| A IA preencheu um dado errado | Clique em **Editar** na ficha e corrija na mão. O que você digita vale. |
| Criei a pasta direto no Drive e ela não aparece | Espere a próxima sincronização — ela roda a cada 15 minutos. O horário da última está no topo da tela. |
| Um cliente "sumiu" da lista | Quase sempre é filtro ligado. Use **Limpar filtros**. Lembre que filtro de processo/cobrança esconde clientes sem processo. |
| Preciso corrigir uma data de status errada | Escolha o status de novo no seletor e informe a data certa. |

### Duas coisas para saber

**A lista "Últimos Clientes Cadastrados" do Dashboard não mostra os mais
recentes.** Apesar do título, hoje ela lista pelo fim do alfabeto. Use como
atalho, não como registro do que entrou por último. Já está mapeado para
correção.

**Mudança de status é registrada, edição de campo não.** O Histórico de Status
guarda toda troca de status com data. Alterar telefone ou endereço pelo
**Editar** não gera registro.

---

## Resumo do caminho

O ciclo completo que você percorreu:

```
Cliente procura o escritório
        |
        v
  Cadastra como Contratação  ---->  pasta criada em 04_contratacao
        |
        v
  Sobe RG, procuração, contrato  ---->  cadastro preenchido pela leitura
        |
        v
  Assinou: muda para Ativo  ---->  pasta movida para 02_ativos
        |
        v
  Abre o processo  ---->  pasta do processo criada
        |
        v
  Sobe a petição inicial  ---->  numero CNJ e dados preenchidos
        |
        v
  Acompanha: Audiência, anotacoes, historico
        |
        v
  Termina: processo Arquivado, cliente Arquivado
        |
        v
                pasta movida para 01_arquivados
```

Três ideias sustentam tudo:

1. **O status manda na pasta.** Mude o status no sistema; o Drive acompanha
   sozinho. Você nunca arrasta pasta.
2. **Documento bem nomeado preenche cadastro.** Nomeie com clareza e deixe a
   leitura automática trabalhar — depois confira.
3. **Nada se perde por falha do Drive.** Se a pasta não for criada, o cadastro
   fica salvo e a pasta pode ser criada depois pelo botão **Drive**.
