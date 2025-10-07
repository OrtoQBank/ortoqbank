# Guia Completo: Checkout AsaaS com Convex

Este guia mostra como implementar o checkout AsaaS seguindo as melhores práticas oficiais da API v3.

## 1. Configuração Inicial

### Chave de API
1. Acesse seu painel do AsaaS
2. Vá em **Integrações > Chaves de API > Gerar chave de API**
3. Configure no seu arquivo `.env.local`:

```bash
# Ambiente de teste (sandbox)
ASAAS_API_KEY=your_sandbox_key_here

# Ambiente de produção
ASAAS_API_KEY=your_production_key_here

# URL do seu site para callbacks
NEXT_PUBLIC_SITE_URL=https://yoursite.com
```

## 2. Como Funciona o Checkout

### Fluxo Completo:
1. **Frontend**: Usuário clica em "Comprar"
2. **Convex Action**: Cria checkout no AsaaS com todos os dados necessários
3. **AsaaS**: Retorna URL de checkout hospedado
4. **Redirect**: Usuário é redirecionado para pagamento
5. **Webhook**: AsaaS notifica quando pagamento é aprovado
6. **Convex**: Processa webhook e provisiona acesso
7. **Clerk**: Cria conta ou atualiza metadata
8. **Email**: Usuário recebe convite/confirmação

## 3. Campos Obrigatórios (Boas Práticas AsaaS)

### ✅ Sempre Incluir:
- `billingTypes`: Formas de pagamento permitidas
- `chargeTypes`: Tipo de cobrança (DETACHED para flexibilidade)
- `items`: Produtos com name, description, value, quantity
- `callback`: URLs de sucesso, expiração e cancelamento

### 🎯 Campos Recomendados:
- `minutesToExpire`: Tempo estratégico (24h = 1440 min)
- `externalReference`: Referência única para tracking
- `customerData`: Dados do cliente para melhor UX

## 4. Implementação Frontend

```tsx
// Exemplo de uso no componente React
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";

function CheckoutButton({ productId }: { productId: string }) {
  const convex = useConvex();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const result = await convex.action(api.asaas.createHostedCheckout, {
        productId,
        email: "cliente@email.com",
        firstName: "João",
        lastName: "Silva",
        cpf: "123.456.789-00",
        phone: "(11) 99999-9999",
        address: {
          street: "Rua das Flores",
          number: "123",
          zipcode: "01234-567",
          city: "São Paulo",
          state: "SP"
        }
      });

      if (result.success) {
        // Redireciona para o checkout AsaaS
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      console.error('Erro no checkout:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCheckout}
      disabled={loading}
      className="bg-blue-600 text-white px-6 py-3 rounded"
    >
      {loading ? 'Criando checkout...' : 'Comprar Agora'}
    </button>
  );
}
```

## 5. Configuração de Produtos

### No Admin (pricingPlans):
```tsx
// Exemplo de produto configurado
{
  name: "Ortoqbank 2025",
  productId: "ortoqbank_2025",
  description: "Acesso completo ao banco de questões 2025",
  regularPriceNum: 39.90,
  pixPriceNum: 34.90,
  category: "year_access",
  year: 2025,
  accessDurationDays: 365,
  isActive: true
}
```

## 6. URLs de Callback

### Configuração Automática:
- **Sucesso**: `/payment/success?order={CHECKOUT_ID}`
- **Expiração**: `/payment/expired`
- **Cancelamento**: `/payment/cancel`

### Páginas Necessárias:
```tsx
// app/payment/success/page.tsx
export default function PaymentSuccess({
  searchParams
}: {
  searchParams: { order?: string }
}) {
  const orderId = searchParams.order;
  
  return (
    <div className="text-center py-16">
      <h1>Pagamento Realizado!</h1>
      <p>Pedido: {orderId}</p>
      <p>Você receberá um email com as instruções de acesso.</p>
    </div>
  );
}
```

## 7. Tipos de Pagamento Suportados

### Configuração Atual:
```typescript
billingTypes: ['CREDIT_CARD', 'PIX', 'BOLETO']
chargeTypes: ['DETACHED'] // Permite flexibilidade máxima
```

### Opções Disponíveis:
- **CREDIT_CARD**: Cartão de crédito
- **PIX**: Pagamento instantâneo
- **BOLETO**: Boleto bancário
- **DEBIT_CARD**: Cartão de débito (se habilitado)

## 8. Webhook e Processamento

### Endpoint Configurado:
```
https://your-app.convex.site/webhooks/asaas
```

### Eventos Processados:
- `PAYMENT_RECEIVED`: Pagamento aprovado → Provisiona acesso
- `PAYMENT_OVERDUE`: Pagamento vencido
- `PAYMENT_DELETED`: Pagamento cancelado
- `PAYMENT_REFUNDED`: Estorno → Revoga acesso

## 9. Monitoramento e Logs

### Tabelas de Auditoria:
- `pendingOrders`: Checkouts criados
- `payments`: Eventos de pagamento
- `userProducts`: Produtos adquiridos
- `users`: Status de acesso dos usuários

### Logs Importantes:
```sql
-- Pedidos pendentes
SELECT * FROM pendingOrders WHERE status = 'pending'

-- Pagamentos processados
SELECT * FROM payments WHERE createdAt > NOW() - INTERVAL 1 DAY

-- Usuários com acesso ativo
SELECT * FROM userProducts WHERE status = 'active'
```

## 10. Segurança

### ✅ Implementado:
- Verificação de assinatura do webhook
- Rate limiting nos endpoints
- Validação de dados de entrada
- Processamento idempotente
- Access tokens seguros

### 🔒 Variáveis Sensíveis:
```bash
ASAAS_API_KEY=           # Chave da API AsaaS
ASAAS_WEBHOOK_SECRET=    # Secret para validar webhooks
CLERK_SECRET_KEY=        # Chave do Clerk para invites
```

## 11. Testes

### Ambiente Sandbox:
1. Use cartões de teste da AsaaS
2. Valores baixos (R$ 0,01)
3. Monitore logs no Convex Dashboard

### Cartões de Teste AsaaS:
- **Aprovado**: 4000000000000002
- **Negado**: 4000000000000010
- **Timeout**: 4000000000000028

## 12. Solução de Problemas

### Erros Comuns:

**"Campos obrigatórios ausentes"**
```json
{
  "errors": [
    {
      "code": "invalid_object",
      "description": "O campo items deve ser informado."
    }
  ]
}
```
✅ **Solução**: Verificar se todos os campos obrigatórios estão preenchidos

**"Customer not found"**
✅ **Solução**: Verificar se o customer foi criado antes do checkout

**"Webhook signature invalid"**
✅ **Solução**: Verificar ASAAS_WEBHOOK_SECRET no ambiente

### Debug:
```typescript
// No Convex Dashboard > Logs
console.log('Checkout criado:', { checkoutId, url });
console.log('Webhook recebido:', { event, signature });
console.log('Usuário provisionado:', { userId, productId });
```

## 13. Próximos Passos

1. **Testar fluxo completo** no ambiente sandbox
2. **Configurar webhook** no painel AsaaS
3. **Criar páginas de callback** (success/expired/cancel)
4. **Implementar componente de checkout** no frontend
5. **Configurar produtos** via admin
6. **Monitorar logs** e métricas

---

**💡 Dica**: Sempre teste primeiro no ambiente sandbox antes de ativar em produção!
