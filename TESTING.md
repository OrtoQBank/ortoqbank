# Testing Guide - OrtoQBank

Guia completo de testes para o projeto OrtoQBank.

## 📊 Documentos de Análise de Cobertura

> 📅 **Última Análise:** 22/10/2025

- **[📄 COVERAGE_ANALYSIS.md](./COVERAGE_ANALYSIS.md)** - Análise detalhada de cobertura de testes
- **[📊 COVERAGE_SUMMARY.md](./COVERAGE_SUMMARY.md)** - Resumo visual e métricas principais
- **[🎯 COVERAGE_ACTION_PLAN.md](./COVERAGE_ACTION_PLAN.md)** - Plano de ação para melhorar cobertura

### Status Atual da Cobertura

| Ambiente | Linhas | Branches | Funções | Testes | Status |
|----------|--------|----------|---------|--------|--------|
| Frontend | 1.98%  | 59.38%   | 53.07%  | 118/118 ✅ | ⚠️ Precisa melhorar |
| Convex   | N/A    | N/A      | N/A     | 113/158 ⚠️ | ❌ Corrigir testes |

🎯 **Meta de curto prazo:** Frontend 40%, Convex 50%, 0 testes falhando

---

## 📋 Sumário

- [Visão Geral](#visão-geral)
- [Testes de Integração](#testes-de-integração)
- [Testes de Performance](#testes-de-performance)
- [Testes de Regressão Visual](#testes-de-regressão-visual)
- [Comandos](#comandos)
- [CI/CD](#cicd)

## 🎯 Visão Geral

O projeto possui uma suite completa de testes:

### Estatísticas de Cobertura

- **Unit Tests**: 118 testes (~800ms)
- **Convex Tests**: 61 testes (~300ms)
- **E2E Tests**: 13 testes (Playwright)
- **Integration Tests**: 71 testes
- **Performance Tests**: 25 testes
- **Visual Regression**: 11 suites de testes

**Total**: ~299 testes automatizados

### Tipos de Testes

1. **Unit Tests** - Componentes e lógica de negócio
2. **Convex Tests** - Backend e banco de dados
3. **E2E Tests** - Fluxos completos do usuário
4. **Integration Tests** - Integrações entre sistemas
5. **Performance Tests** - Benchmarks e load testing
6. **Visual Regression** - Screenshots e comparações visuais

## 🔗 Testes de Integração

### Clerk + Convex Sync (25 testes)

Testa a sincronização de usuários entre Clerk e Convex.

**Localização**: `convex/integration/clerkSync.test.ts`

**Casos de teste**:
- Criação de usuários do Clerk
- Atualização de dados do usuário
- Sincronização de metadata de pagamento
- Deleção de usuários
- Consistência de dados
- Edge cases (caracteres especiais, campos vazios)

**Executar**:
```bash
npm run test:convex -- clerkSync
```

### Asaas + Convex Payments (28 testes)

Testa o fluxo completo de pagamentos com Asaas.

**Localização**: `convex/integration/asaasPayments.test.ts`

**Casos de teste**:
- Criação de orders pendentes (PIX e Cartão)
- Aplicação de cupons (fixed, percentage, fixed_price)
- Validação de cupons (limites, datas, uso por usuário)
- Cálculo de preços e descontos
- Status de pagamento
- Edge cases (formatação de CPF, valores mínimos)

**Executar**:
```bash
npm run test:convex -- asaasPayments
```

### Aggregates + CRUD Consistency (18 testes)

Testa a consistência entre agregados e operações CRUD.

**Localização**: `convex/integration/aggregatesConsistency.test.ts`

**Casos de teste**:
- Contagem de questões após criação
- Hierarquia de taxonomia (theme → subtheme → group)
- Deleção e atualização de agregados
- Stats de usuário (answered, incorrect, bookmarks)
- Validação de consistência
- Operações em lote
- Detecção de dados órfãos

**Executar**:
```bash
npm run test:convex -- aggregatesConsistency
```

## ⚡ Testes de Performance

### Aggregate Benchmarks (11 testes)

Testa performance de agregados com diferentes volumes de dados.

**Localização**: `convex/performance/aggregateBenchmarks.test.ts`

**Métricas**:
- Small dataset (10 questions): < 1s insert, < 100ms query
- Medium dataset (100 questions): < 5s insert, < 200ms query
- Query scaling: O(log n) behavior
- Hierarquia: < 100ms por nível
- Índices vs table scans
- Operações concorrentes
- Paginação eficiente

**Executar**:
```bash
npm run test:convex -- aggregateBenchmarks
```

### Load Testing (9 testes)

Testa comportamento sob carga.

**Localização**: `convex/performance/loadTesting.test.ts`

**Cenários**:
- High-frequency queries (50 iterações < 5s)
- Concurrent user sessions (20 usuários < 3s)
- Bulk operations (50 bookmarks < 2s)
- Rapid creation/updates
- Mixed read/write operations
- Large user base (100 users)
- Throughput (> 10 queries/segundo)

**Executar**:
```bash
npm run test:convex -- loadTesting
```

### Workflow Timeout Handling (5 testes)

Testa limites de tempo e timeout handling.

**Localização**: `convex/performance/workflowTimeout.test.ts`

**Validações**:
- Mutation time limits (< 15s Convex limit)
- Batch processing safety
- Paginated processing
- Concurrent operations
- Retry logic
- Resource cleanup

**Executar**:
```bash
npm run test:convex -- workflowTimeout
```

## 🎨 Testes de Regressão Visual

### Configuração Chromatic

**Arquivo**: `.chromatic.config.json`

```json
{
  "projectId": "your-project-id-here",
  "onlyChanged": true,
  "autoAcceptChanges": "main"
}
```

### Setup

1. **Instalar Chromatic**:
```bash
npm install --save-dev chromatic
```

2. **Adicionar ao package.json**:
```json
{
  "scripts": {
    "chromatic": "chromatic --exit-zero-on-changes",
    "test:visual": "npm run test:e2e -- --grep @visual"
  }
}
```

3. **Obter Project Token**:
   - Criar conta em https://www.chromatic.com
   - Conectar repositório GitHub
   - Copiar project token
   - Adicionar ao `.env`: `CHROMATIC_PROJECT_TOKEN=your-token`

### Visual Regression Tests (11 suites)

**Localização**: `playwright/visual-regression.spec.ts`

**Casos de teste**:

1. **Landing Page** (3 testes)
   - Hero section
   - Navigation menu
   - Footer

2. **Quiz Interface** (2 testes)
   - Quiz creation form
   - Question card

3. **Responsive Design** (3 testes)
   - Mobile (375x667)
   - Tablet (768x1024)
   - Desktop (1920x1080)

4. **Component States** (2 testes)
   - Button states (normal, hover)
   - Form input states (empty, filled, focused)

5. **Dark Mode** (1 teste)
   - Dark mode homepage

6. **Accessibility** (2 testes)
   - High contrast mode
   - Focus indicators

7. **Error States** (2 testes)
   - 404 page
   - Form validation errors

8. **Loading States** (1 teste)
   - Loading skeletons

**Executar**:
```bash
# Todos os testes visuais
npm run test:visual

# Com Chromatic
npm run chromatic
```

### Screenshot Automation (11 suites)

**Localização**: `playwright/screenshots-automation.spec.ts`

**Capturas automáticas**:

1. **Full Page** - Todas as páginas principais
2. **Components** - Buttons, inputs, navigation
3. **Multi-Device** - 4 viewports diferentes
4. **User Flows** - Quiz creation flow
5. **State Variations** - Normal, hover, focus, disabled
6. **Performance Metrics** - Com timing de load

**Executar**:
```bash
npm run test:e2e -- screenshots-automation.spec.ts
```

**Screenshots salvos em**: `screenshots/`

## 🚀 Comandos

### Testes Unitários
```bash
# Todos os unit tests
npm run test

# Com coverage
npm run coverage

# Watch mode
npm run test

# Executar uma vez
npm run test:once
```

### Testes Convex
```bash
# Todos os testes Convex
npm run test:convex

# Específico
npm run test:convex -- clerkSync
npm run test:convex -- asaasPayments
npm run test:convex -- aggregatesConsistency
npm run test:convex -- aggregateBenchmarks
npm run test:convex -- loadTesting
npm run test:convex -- workflowTimeout
```

### Testes E2E
```bash
# Todos os E2E
npm run test:e2e

# Com UI
npm run test:e2e:ui

# Apenas visuais
npm run test:visual

# Screenshots
npm run test:e2e -- screenshots-automation.spec.ts
```

### Todos os Testes
```bash
# Unit + Convex
npm run test:once && npm run test:convex

# Adicionar E2E
npm run test:once && npm run test:convex && npm run test:e2e
```

## 🔄 CI/CD

### GitHub Actions

Adicionar ao `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:once

  convex-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:convex

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run chromatic
        env:
          CHROMATIC_PROJECT_TOKEN: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

### Pre-commit Hooks

Adicionar ao `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run quick tests before commit
npm run test:once
npm run lint
```

## 📊 Relatórios

### Coverage Report

```bash
npm run test:coverage
```

Abre relatório HTML em `coverage/index.html`

### Playwright Report

```bash
npx playwright show-report
```

### Screenshot Manifest

Após executar screenshots:

```bash
cat screenshots/manifest.json
```

## 🐛 Debugging

### Debug Unit Tests
```bash
npm run test:debug
```

### Debug E2E
```bash
npm run test:e2e:ui
```

### Debug Convex Tests
```bash
# Add --inspect flag
npx vitest --config=vitest.config.convex --inspect-brk
```

## 📝 Best Practices

1. **Sempre rode testes antes de commit**
2. **Mantenha testes rápidos** (< 1s por teste unit)
3. **Use mocks com moderação** (prefira testes de integração)
4. **Capture screenshots em mudanças visuais**
5. **Monitore performance benchmarks**
6. **Atualize baselines visuais quando necessário**

## 🔍 Troubleshooting

### Testes falhando com timeout

Aumentar timeout no `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    testTimeout: 30000, // 30s
  },
});
```

### Screenshots diferentes

Regenerar baselines:

```bash
npm run test:e2e -- --update-snapshots
```

### Chromatic não conectando

Verificar token:

```bash
echo $CHROMATIC_PROJECT_TOKEN
```

## 📚 Recursos

- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Chromatic Docs](https://www.chromatic.com/docs/)
- [Convex Testing](https://docs.convex.dev/testing)
- [Testing Library](https://testing-library.com/)

---

**Mantido por**: Equipe OrtoQBank
**Última atualização**: Janeiro 2025
