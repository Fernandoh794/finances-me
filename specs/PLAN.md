# Plano de Implementação: MVP Agente Financeiro

- [ ] **Fase 0: Validação de Contas e Dados**
  - [ ] 0.1 Criar conta na Pluggy, conectar os bancos no MeuPluggy e anotar os `itemId`s.
  - [ ] 0.2 Criar projeto Firebase + service account; criar chave da API Gemini.
  - [ ] 0.3 Script descartável que baixa contas e transações reais da Pluggy e salva fixtures anonimizadas em `test/fixtures/` (confirmar convenção de sinal de conta vs. cartão e categorias de fatura/transferência).
  - [ ] 0.4 Definir o número de WhatsApp do bot (número dedicado recomendado).

- [x] **Fase 1: Fundação do Projeto & Configuração**
  - [x] 1.1 Iniciar projeto Node.js (`package.json`) com TypeScript, `tsx`, ESLint, Prettier e Vitest.
  - [x] 1.2 Criar schema Zod para validação rigorosa de variáveis de ambiente em `src/config/env.ts`.
  - [x] 1.3 Configurar `src/config/firebase.ts` inicializando o `firebase-admin` com Firestore.
  - [x] 1.4 Configurar logger estruturado (`pino`) com redação de campos sensíveis.
  - [x] 1.5 Utilitários em `src/lib/`: dinheiro em centavos, formatação BRL, intervalos de data em `America/Sao_Paulo` (com testes).

- [ ] **Fase 2: Cliente Pluggy & Repositório Firestore**
  - [ ] 2.1 Criar `PluggyClient` com autenticação automática, renovação de `apiKey`, paginação e retry.
  - [ ] 2.2 Criar repositório `AccountRepository` para salvar/atualizar contas na coleção `accounts`.
  - [ ] 2.3 Criar repositório `TransactionRepository` para escrita idempotente na coleção `transactions` e queries analíticas (soma por período, agregação por categoria).
  - [ ] 2.4 Implementar `normalizeTransaction` e `classifyExpense` como funções puras, testadas contra as fixtures da Fase 0.
  - [ ] 2.5 Criar `SyncService` unindo busca na Pluggy e persistência no Firestore, com janela de sobreposição, `sync_state` e lock.
  - [ ] 2.6 Criar `firestore.indexes.json` e testar repositórios no Firebase Emulator.

- [ ] **Fase 3: Camada de IA & Function Calling**
  - [ ] 3.1 Declarar especificações das tools (`get_balances`, `get_expenses_summary`, `get_recent_transactions`, `sync_bank_data`) com parâmetros validados por Zod.
  - [ ] 3.2 Implementar resolvers locais executando as queries correspondentes no Firestore e SyncService.
  - [ ] 3.3 Montar o loop do agente conversacional: recebe texto -> avalia se precisa de tool -> executa tool -> gera resposta final contextualizada (limite de iterações + histórico curto).
  - [ ] 3.4 CLI local (`npm run chat`) para conversar com o agente pelo terminal, sem WhatsApp.

- [ ] **Fase 4: Conexão WhatsApp com Baileys**
  - [ ] 4.1 Implementar inicialização do socket Baileys com suporte a QR Code no terminal e persistência em `.baileys_auth/`.
  - [ ] 4.2 Configurar reconnect automático em caso de queda de conexão (exceto `loggedOut`).
  - [ ] 4.3 Implementar listener de `messages.upsert` com filtros de segurança (dono/LID, grupos, broadcast, `fromMe`, dedupe) e testes unitários do filtro.

- [ ] **Fase 5: Integração Ponta a Ponta & Rotinas**
  - [ ] 5.1 Conectar o handler do Baileys ao loop do Agente de IA (fila por conversa + "digitando...").
  - [ ] 5.2 Configurar rotina cron (`node-cron`, expressão em `SYNC_CRON`) para auto-sync da Pluggy 2 vezes ao dia.
  - [ ] 5.3 Shutdown gracioso (SIGINT/SIGTERM) fechando socket e cron.
  - [ ] 5.4 Testar fluxo real com os critérios de aceite da spec: _"Qual meu saldo atual?"_, _"Quanto gastei essa semana?"_ e _"Quais foram meus últimos 5 gastos?"_.
  - [ ] 5.5 Definir onde o processo roda 24/7 (VPS/servidor doméstico com `pm2` ou Docker) e documentar no README.
