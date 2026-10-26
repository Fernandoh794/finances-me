# SPEC-001: Agente Financeiro Autônomo com Baileys & Pluggy

## 1. Visão Geral

Construção de um agente financeiro pessoal operando via WhatsApp utilizando a biblioteca Baileys. O backend ingere saldos e transações de múltiplos bancos reais através do conector MeuPluggy (Open Finance), persiste em Firestore e disponibiliza uma interface conversacional inteligente orientada a Tool Calling.

**Usuário único:** o sistema atende exclusivamente o proprietário. Não há multi-tenancy no MVP.

**Execução:** processo Node.js de longa duração (Baileys mantém um WebSocket aberto). Não roda em ambiente serverless (Cloud Functions/Lambda).

### Fora de escopo do MVP

- Áudio, imagem e documentos no WhatsApp (só texto).
- Orçamentos/metas, alertas proativos e recategorização manual.
- Múltiplos usuários.

## 2. Contratos de Dados (Firestore)

### Coleção: `accounts`

- Path: `/accounts/{accountId}`
- Schema:

```typescript
interface AccountDocument {
  id: string; // Pluggy account ID
  itemId: string; // Pluggy item ID (conexão bancária de origem)
  name: string; // ex: "Conta Corrente", "Cartão Platinum"
  bankName: string; // ex: "Nubank", "Banco Inter", "Itaú"
  type: 'CHECKING' | 'CREDIT_CARD' | 'SAVINGS' | 'INVESTMENT';
  balanceCents: number; // Saldo disponível (conta) ou fatura atual (cartão), em centavos
  creditLimitCents?: number;
  currencyCode: string; // "BRL"
  updatedAt: FirebaseFirestore.Timestamp;
}
```

### Coleção: `transactions`

- Path: `/transactions/{transactionId}`
- Schema:

```typescript
interface TransactionDocument {
  id: string; // Pluggy transaction ID
  accountId: string; // Referência à conta
  accountType: AccountDocument['type'];
  bankName: string;
  description: string; // Descrição tratada (ex: "Supermercado São José")
  rawDescription: string; // Descrição original da Pluggy
  amountCents: number; // NORMALIZADO: negativo = saída/despesa, positivo = entrada
  date: FirebaseFirestore.Timestamp;
  status: 'PENDING' | 'POSTED';
  category: string; // ex: "Alimentação", "Transporte", "Serviços"
  categoryId?: string; // ID de categoria da Pluggy
  paymentType?: string; // PIX, BOLETO, TED, CARTÃO...
  isExpense: boolean; // Calculado na sincronização (ver Regras de Negócio)
  installment?: { number: number; total: number };
  syncedAt: FirebaseFirestore.Timestamp;
}
```

### Coleção: `sync_state`

- Path: `/sync_state/{accountId}`
- Schema:

```typescript
interface SyncStateDocument {
  accountId: string;
  lastSyncedAt: FirebaseFirestore.Timestamp;
  lastStatus: 'OK' | 'ERROR';
  lastError?: string;
}
```

### Índices compostos (`firestore.indexes.json`)

- `transactions`: `isExpense ASC, date DESC`
- `transactions`: `isExpense ASC, category ASC, date DESC`

## 3. Regras de Negócio

### 3.1. Normalização de sinal

A convenção de sinal da Pluggy difere entre conta corrente e cartão de crédito. O `SyncService` DEVE normalizar usando o campo `type` (`DEBIT`/`CREDIT`) da transação, nunca apenas o sinal de `amount`, de forma que `amountCents < 0` sempre signifique dinheiro saindo. Cobrir com testes unitários usando fixtures reais (anonimizadas) de conta e cartão.

### 3.2. O que é "gasto" (`isExpense = true`)

Uma transação é gasto quando `amountCents < 0` **e** não é:

- Pagamento de fatura de cartão de crédito (a despesa já foi contada nas compras do cartão);
- Transferência entre contas do próprio usuário;
- Aplicação/resgate de investimento.

A detecção usa categoria da Pluggy + heurísticas de descrição, isoladas em uma função pura e testada (`classifyExpense`).

### 3.3. Janela de sincronização

- Primeira sync: últimos 90 dias.
- Syncs seguintes: a partir de `lastSyncedAt - 10 dias` (sobreposição), porque transações `PENDING` mudam para `POSTED` e podem ter valor/descrição alterados. O upsert idempotente absorve a sobreposição.

### 3.4. Datas

Toda data recebida pelas tools é `YYYY-MM-DD` interpretada em `America/Sao_Paulo` (início do dia em `startDate`, fim do dia em `endDate`, inclusivos).

## 4. Módulos do Sistema

### 4.0. Modos de Execução e Interfaces

Cada integração externa fica atrás de uma interface, com uma implementação offline usada até as credenciais existirem. O container (`src/app/container.ts`) escolhe a implementação conforme o `.env`:

| Variável       | Offline (padrão)                     | Real                       | Interface                                                |
| -------------- | ------------------------------------ | -------------------------- | -------------------------------------------------------- |
| `LLM_PROVIDER` | `fake`: roteador por palavras-chave  | `gemini`                   | `LlmProvider` (`src/agent/llm/types.ts`)                 |
| `DATA_SOURCE`  | `demo`: memória + dados fictícios    | `live`: Firestore + Pluggy | `AccountRepository`, `TransactionRepository`, `BankSync` |
| `CHANNEL`      | `console`: terminal (`npm run chat`) | `whatsapp`: Baileys        | `Channel` (`src/channels/types.ts`)                      |

Variáveis de credencial só são exigidas quando o modo real correspondente está ativo. Fluxo de uma mensagem: `Channel` → `MessageHandler` (fila, histórico, erro amigável) → `Agent` (loop de tools) → tools → repositórios.

### 4.1. Ingestor Pluggy (`src/services/pluggy/`)

- Gerenciamento de token: `POST https://api.pluggy.ai/auth` enviando `clientId` e `clientSecret`. Armazena `apiKey` em memória com controle de expiração (renova antes de expirar e em resposta 401).
- `fetchAccounts(itemId)`: Retorna as contas do item. Os itens do MeuPluggy vêm de `PLUGGY_ITEM_IDS`.
- `fetchTransactions(accountId, fromDate)`: Percorre todas as páginas da paginação da Pluggy.
- Retry com backoff exponencial para 429/5xx.

### 4.2. Sync (`src/services/sync/`)

- `syncAll()`: para cada item → contas → transações; normaliza (3.1), classifica (3.2), grava em lote (`BulkWriter` ou batches de até 500) e atualiza `sync_state`.
- Lock em memória: duas syncs nunca rodam ao mesmo tempo (cron + comando manual).
- Retorna um resumo `{ accounts, newOrUpdatedTransactions, errors }`.

### 4.3. Mecanismo Baileys (`src/channels/whatsapp/`)

Implementa a interface `Channel`; fila e tratamento de erro ficam no `MessageHandler`, compartilhado com o canal console.

- Inicializa conexão utilizando `useMultiFileAuthState('.baileys_auth')`.
- Exibe QR Code no terminal (`qrcode-terminal`) caso precise autenticar.
- Reconecta automaticamente em queda, exceto quando o motivo for `loggedOut` (nesse caso, loga e exige novo pareamento).
- Escuta evento `messages.upsert` (apenas `type === 'notify'`):
  - Aplica os filtros de segurança do `CLAUDE.md` (dono, grupos, broadcast, `fromMe`, dedupe).
  - Extrai payload textual de `conversation` ou `extendedTextMessage.text`.
  - Processa mensagens do dono em fila (uma por vez) para preservar a ordem da conversa.
  - Envia indicador "digitando..." (`sendPresenceUpdate('composing')`) enquanto o agente processa.
  - Envia texto para o módulo de Agente e devolve a resposta no chat via `sendMessage`.
  - Em erro, responde mensagem genérica amigável e loga o erro (sem vazar stack ao usuário).

### 4.4. Agente Conversacional & Tools (`src/agent/`)

- Modelo: definido por `GEMINI_MODEL` (usar um modelo Flash atual e com suporte a function calling). O agente depende só de `LlmProvider`; no modo `fake`, um roteador por palavras-chave chama as mesmas tools e formata a resposta.
- Histórico: mantém as últimas N trocas (padrão 10) em memória para permitir perguntas de seguimento ("e no mês passado?"). Reinicia ao reiniciar o processo.
- Limite de iterações do loop de tools (padrão 5) para evitar loops infinitos.
- Tools Registradas:
  1. `get_balances`: Retorna saldos de todas as contas e total consolidado (contas separadas de faturas de cartão).
  2. `get_expenses_summary`: Recebe `{ startDate: string, endDate: string, category?: string }`. Consulta apenas `isExpense = true` e retorna soma total, agrupamento por categoria e quantidade de transações.
  3. `get_recent_transactions`: Recebe `{ limit?: number, onlyExpenses?: boolean }` (padrão 10, máx. 50; `onlyExpenses` padrão `false`). Retorna os últimos lançamentos formatados com data, descrição, valor, banco e categoria.
  4. `sync_bank_data`: Aciona o pipeline de sincronização manual e retorna o resumo da sync.
- Persona do Prompt: Assistente financeiro sênior, direto, analítico e resolutivo. Responde sempre em Português do Brasil com valores em `R$ 0,00` e destaques em negrito (formatação do WhatsApp: `*negrito*`). Inclui a data/hora atual em `America/Sao_Paulo`. Se a pergunta não puder ser respondida com as tools, diz isso em vez de inventar.

## 5. Variáveis de Ambiente Obrigatórias (`.env`)

```
# Pluggy
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
PLUGGY_ITEM_IDS=            # IDs dos itens do MeuPluggy, separados por vírgula

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=       # com \n escapados; o loader converte para quebras reais

# Google AI
GEMINI_API_KEY=
GEMINI_MODEL=

# WhatsApp Config
OWNER_PHONE_NUMBER=5579999999999

# Opcional
TZ=America/Sao_Paulo
LOG_LEVEL=info
SYNC_CRON=0 7,19 * * *
```

## 6. Critérios de Aceite do MVP

- "Qual meu saldo atual?" → saldos por conta + total, batendo com os apps dos bancos.
- "Quanto gastei essa semana?" → total igual à soma manual das despesas no período, sem contar pagamento de fatura nem transferências próprias.
- "Quais foram meus últimos 5 gastos?" → 5 lançamentos corretos e em ordem.
- Rodar a sync duas vezes seguidas não duplica nenhuma transação.
- Mensagem de outro número não recebe resposta nem gera chamada ao LLM.
