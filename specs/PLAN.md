# Plano de Implementação: MVP Agente Financeiro

Estratégia: construir tudo atrás de interfaces e rodar primeiro no console com dados fictícios e IA offline. As integrações reais (Gemini, Pluggy/Firestore, WhatsApp) são plugadas no fim, trocando apenas o modo no `.env`.

- [x] **Fase 1: Fundação do Projeto & Configuração**
  - [x] 1.1 Iniciar projeto Node.js (`package.json`) com TypeScript, `tsx`, ESLint, Prettier e Vitest.
  - [x] 1.2 Criar schema Zod para validação rigorosa de variáveis de ambiente em `src/config/env.ts`.
  - [x] 1.3 Configurar `src/config/firebase.ts` inicializando o `firebase-admin` com Firestore.
  - [x] 1.4 Configurar logger estruturado (`pino`) com redação de campos sensíveis.
  - [x] 1.5 Utilitários em `src/lib/`: dinheiro em centavos, formatação BRL, intervalos de data em `America/Sao_Paulo` (com testes).

- [x] **Fase 2: Núcleo Offline (sem credenciais)**
  - [x] 2.1 Modos de execução no env (`LLM_PROVIDER`, `DATA_SOURCE`, `CHANNEL`) com chaves exigidas só no modo correspondente.
  - [x] 2.2 Tipos de domínio e interfaces `AccountRepository` / `TransactionRepository` / `BankSync`.
  - [x] 2.3 Repositórios em memória + dados fictícios determinísticos (incluindo fatura e transferências, que não são gasto).
  - [x] 2.4 Agregações puras (`summarizeExpenses`, `summarizeBalances`).
  - [x] 2.5 Tools (`get_balances`, `get_expenses_summary`, `get_recent_transactions`, `sync_bank_data`) validadas por Zod, com JSON Schema gerado.
  - [x] 2.6 Loop do agente provider-agnóstico (limite de iterações, erros de tool devolvidos ao LLM).
  - [x] 2.7 `FakeLlmProvider` por palavras-chave para desenvolver sem chave de IA.
  - [x] 2.8 `MessageHandler` (histórico curto, fila por remetente, erro amigável) e interface `Channel`.
  - [x] 2.9 Canal console (`npm run chat`).

- [ ] **Fase 3: Integração com Gemini** _(requer `GEMINI_API_KEY`)_
  - [ ] 3.1 `GeminiLlmProvider` implementando `LlmProvider` com `@google/genai` (mapear `ChatMessage`/`ToolSpec` ↔ formato do SDK).
  - [ ] 3.2 Validar no console as perguntas dos critérios de aceite e perguntas livres; ajustar prompt.
  - [ ] 3.3 Testes do adapter com SDK mockado.

- [ ] **Fase 4: Dados Reais — Pluggy & Firestore** _(requer contas Pluggy e Firebase)_
  - [ ] 4.0 Conta Pluggy + MeuPluggy (`itemId`s), projeto Firebase + service account, e script que salva fixtures anonimizadas em `test/fixtures/` (confirmar sinal de conta vs. cartão e categorias de fatura/transferência).
  - [ ] 4.1 `PluggyClient` com autenticação automática, renovação de `apiKey`, paginação e retry.
  - [ ] 4.2 `FirestoreAccountRepository` e `FirestoreTransactionRepository` implementando as interfaces (upsert idempotente pelo ID da Pluggy).
  - [ ] 4.3 `normalizeTransaction` e `classifyExpense` como funções puras, testadas contra as fixtures.
  - [ ] 4.4 `PluggyBankSync` com janela de sobreposição, `sync_state` e lock.
  - [ ] 4.5 `firestore.indexes.json` e testes dos repositórios no Firebase Emulator.
  - [ ] 4.6 Ligar `DATA_SOURCE=live` no container.

- [ ] **Fase 5: Canal WhatsApp com Baileys** _(requer número do bot)_
  - [ ] 5.1 `WhatsAppChannel` implementando `Channel`: socket Baileys, QR Code no terminal, persistência em `.baileys_auth/`.
  - [ ] 5.2 Reconnect automático em queda de conexão (exceto `loggedOut`).
  - [ ] 5.3 Filtros de segurança (dono/LID, grupos, broadcast, `fromMe`, dedupe) com testes unitários; "digitando..." durante o processamento.
  - [ ] 5.4 Ligar `CHANNEL=whatsapp` no container.

- [ ] **Fase 6: Rotinas & Produção**
  - [ ] 6.1 Rotina cron (`node-cron`, expressão em `SYNC_CRON`) para auto-sync da Pluggy 2 vezes ao dia.
  - [ ] 6.2 Shutdown gracioso (SIGINT/SIGTERM) fechando socket e cron.
  - [ ] 6.3 Testar fluxo real com os critérios de aceite da spec: _"Qual meu saldo atual?"_, _"Quanto gastei essa semana?"_ e _"Quais foram meus últimos 5 gastos?"_.
  - [ ] 6.4 Definir onde o processo roda 24/7 (VPS/servidor doméstico com `pm2` ou Docker) e documentar no README.
