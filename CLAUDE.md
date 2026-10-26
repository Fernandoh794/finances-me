# Diretrizes de Projeto: Agente Financeiro Pessoal (Estilo Pierre)

Especificação: `specs/SPEC-PIERRE-MVP.md` · Plano: `specs/PLAN.md` (marque os checkboxes ao concluir cada item).

## 1. Stack Tecnológica

- **Runtime:** Node.js (LTS), TypeScript (Strict Mode), ESM
- **Database:** Firebase Firestore (`firebase-admin`)
- **Ingestão Bancária:** Pluggy API (Conector `MeuPluggy`)
- **WhatsApp Gateway:** `@whiskeysockets/baileys` (Sessão persistida em `.baileys_auth/`)
- **Camada de IA:** Google Gen AI SDK (`@google/genai`) com Tool Calling nativo. O modelo vem de `GEMINI_MODEL` — nunca hardcode o nome do modelo.
- **Validação de Schemas:** Zod
- **Logger:** Pino
- **Testes:** Vitest
- **Agendamento:** `node-cron`

## 2. Padrões de Código e Arquitetura

- **Arquitetura em Camadas:**
  - `src/config/`: Variáveis de ambiente validadas com Zod e instâncias de clientes base.
  - `src/domain/`: Tipos de domínio (`Account`, `Transaction`), independentes de Firestore/Pluggy.
  - `src/repositories/`: Interfaces de repositório; `memory/` (demo) e `firestore/` (real) as implementam.
  - `src/services/pluggy/`: Cliente de autenticação e consumo da API Pluggy.
  - `src/services/sync/`: Interface `BankSync` e implementações (demo e Pluggy → normalização → repositórios).
  - `src/services/analytics/`: Agregações puras (somas, agrupamentos) usadas pelas tools.
  - `src/agent/`: Loop do agente, prompt, tools e provedores de LLM (`llm/fake`, `llm/gemini`).
  - `src/channels/`: Interface `Channel`; `console/` e `whatsapp/` (Baileys) a implementam.
  - `src/app/`: `MessageHandler` e `container.ts` (único lugar que escolhe implementações pelo env).
  - `src/lib/`: Utilitários puros (dinheiro, datas/fuso, formatação BRL, texto).
- **Modos offline:** `LLM_PROVIDER=fake`, `DATA_SOURCE=demo` e `CHANNEL=console` são os padrões e não exigem credenciais. Toda integração nova entra como implementação de uma interface existente, ligada no container — nunca acoplada direto ao agente ou ao canal.
- **Idempotência Obrigatória:** Transações sincronizadas da Pluggy DEVEM usar o ID original da Pluggy como document ID no Firestore (`transactions/{pluggy_transaction_id}`). Nunca gere IDs aleatórios para transações bancárias. Escritas são sempre upsert (`set(..., { merge: true })`).
- **Zero Alucinação Matemática:** O LLM NUNCA deve calcular somatórios de gastos de cabeça. Toda consulta quantitativa deve disparar uma tool que executa a agregação em código. As tools devolvem os valores já formatados em `R$` para o modelo apenas repetir.
- **Dinheiro em centavos:** Valores monetários são persistidos e somados como inteiros (`amountCents`). Conversão para reais só na borda (formatação de saída). Nunca some `number` em ponto flutuante.
- **Fuso horário:** Toda interpretação de datas ("hoje", "essa semana", "mês passado") usa `America/Sao_Paulo`. A data atual é injetada no system prompt a cada requisição.
- **Definição de "gasto":** Ver seção "Regras de Negócio" da spec. Transferências entre contas próprias e pagamento de fatura de cartão NÃO são gastos (evita dupla contagem).
- **Tratamento de Sessão Baileys:** A autenticação do Baileys deve salvar credenciais na pasta `.baileys_auth/` (deve constar no `.gitignore`).
- **Segurança:**
  - O bot só responde ao número de WhatsApp do proprietário (`OWNER_PHONE_NUMBER`). Mensagens de qualquer outro JID devem ser ignoradas sumariamente no handler.
  - Ignorar também: grupos (`@g.us`), `status@broadcast`, mensagens `fromMe` e mensagens já processadas (dedupe por `message.key.id`).
  - A comparação do remetente deve normalizar o JID (só dígitos) e considerar JIDs `@lid` (o WhatsApp pode entregar o remetente como LID em vez de `@s.whatsapp.net`).
  - Nunca logar segredos, tokens, `apiKey` da Pluggy nem o conteúdo completo de transações em nível `info`.

## 3. Comandos Úteis

- Build: `npm run build`
- Dev: `npm run dev`
- Chat no console (modo offline): `npm run chat`
- Testes: `npm test`
- Lint: `npm run lint`
