# Comparação: Padrões Convex para Checkout AsaaS

## 🎯 **Duas Abordagens Implementadas**

### 1. **Abordagem Simples (useMutation)**
📁 `src/components/checkout-asaas-example.tsx`

```tsx
// ✅ Padrão recomendado - versão simples
const initiateCheckout = useMutation(api.asaas.initiateCheckout);

const handleCheckout = async () => {
  const result = await initiateCheckout({
    productId,
    email: formData.email,
    // ... outros dados
  });
  
  if (result.success) {
    alert('Checkout iniciado! Processamento em andamento...');
    // Action roda em background automaticamente
  }
};
```

**Características:**
- ✅ **Simples**: Mutation + feedback básico
- ✅ **Padrão recomendado**: Captura intenção no DB
- ✅ **Background**: Action executada automaticamente
- ⚠️ **Sem status**: Não monitora progresso em tempo real
- ✅ **Auditável**: Dados persistidos no database

---

### 2. **Abordagem Recomendada (Mutation + Action + Subscription)**
📁 `src/components/checkout-asaas-reactive.tsx`

```tsx
// ✅ Padrão recomendado
const initiateCheckout = useMutation(api.asaas.initiateCheckout);
const checkoutStatus = useQuery(api.asaas.getCheckoutStatus, 
  checkoutRequestId ? { checkoutRequestId } : "skip"
);

const handleCheckout = async () => {
  // 1. Mutation captura intenção
  const result = await initiateCheckout({
    productId,
    email: formData.email,
    // ... outros dados
  });
  
  setCheckoutRequestId(result.checkoutRequestId);
  // 2. Subscription monitora progresso
  // 3. Auto-redirect quando pronto
};
```

**Características:**
- ✅ **Padrão oficial**: Seguindo documentação Convex
- ✅ **Resiliente**: Estado persistido no DB
- ✅ **Rastreável**: Histórico completo de operações
- ✅ **Reativo**: Updates em tempo real
- ✅ **Auditável**: Logs de todas as etapas

---

## 🔄 **Fluxo Detalhado da Abordagem Recomendada**

### **Passo 1: Cliente → Mutation**
```tsx
// Cliente chama mutation
const result = await initiateCheckout(userData);
```

### **Passo 2: Mutation → Database + Scheduler**
```typescript
// convex/asaas.ts - initiateCheckout
export const initiateCheckout = mutation({
  handler: async (ctx, args) => {
    // 1. Criar pedido no DB (captura intenção)
    const checkoutRequestId = await ctx.db.insert("pendingOrders", {
      status: 'creating',
      email: args.email,
      productId: args.productId,
      // ... outros dados
    });
    
    // 2. Agendar action para processar
    await ctx.scheduler.runAfter(0, internal.asaas.processCheckoutCreation, {
      checkoutRequestId,
      ...args
    });
    
    return { success: true, checkoutRequestId };
  }
});
```

### **Passo 3: Action → AsaaS API**
```typescript
// Action executada em background
export const processCheckoutCreation = internalAction({
  handler: async (ctx, args) => {
    try {
      // 1. Chamar AsaaS API
      const checkout = await asaas.createCheckout(checkoutData);
      
      // 2. Atualizar DB com sucesso
      await ctx.runMutation(internal.asaas.updatePendingOrderWithCheckout, {
        checkoutRequestId: args.checkoutRequestId,
        checkoutUrl: checkout.url,
        status: 'ready'
      });
    } catch (error) {
      // 3. Atualizar DB com erro
      await ctx.runMutation(internal.asaas.updatePendingOrderStatus, {
        checkoutRequestId: args.checkoutRequestId,
        status: 'failed',
        error: error.message
      });
    }
  }
});
```

### **Passo 4: Subscription → Auto-redirect**
```tsx
// Cliente monitora status
const checkoutStatus = useQuery(api.asaas.getCheckoutStatus, { checkoutRequestId });

useEffect(() => {
  if (checkoutStatus?.status === 'ready' && checkoutStatus.checkoutUrl) {
    window.location.href = checkoutStatus.checkoutUrl;
  }
}, [checkoutStatus]);
```

---

## 📊 **Comparação de Benefícios**

| Aspecto | Abordagem Simples | Abordagem Reativa |
|---------|------------------|----------------------|
| **Simplicidade** | ✅ Simples | ⚠️ Mais complexa |
| **Performance** | ✅ Mais rápida | ⚠️ Mais lenta |
| **Resiliência** | ✅ Robusta | ✅ Muito robusta |
| **Auditoria** | ✅ Logs completos | ✅ Logs completos |
| **UX** | ⚠️ Feedback básico | ✅ Status em tempo real |
| **Debugging** | ✅ Fácil | ✅ Muito fácil |
| **Escalabilidade** | ✅ Escalável | ✅ Escalável |
| **Padrão Convex** | ✅ Recomendado | ✅ Recomendado |

---

## 🎛️ **Estados do Checkout (Abordagem Recomendada)**

```typescript
// Schema: pendingOrders.status
status: v.union(
  v.literal("creating"), // 🔄 Criando checkout na AsaaS
  v.literal("ready"),    // ✅ Checkout URL pronto
  v.literal("pending"),  // ⏳ User acessou checkout
  v.literal("paid"),     // 💰 Pagamento aprovado
  v.literal("completed"), // 🎉 Acesso provisionado
  v.literal("failed")    // ❌ Erro no processo
)
```

### **UI Correspondente:**
- **creating**: Loading spinner + "Criando checkout..."
- **ready**: Success icon + "Redirecionando..." + auto-redirect
- **failed**: Error icon + mensagem de erro + botão retry
- **pending**: Info sobre pagamento pendente
- **paid**: Sucesso + "Processando acesso..."
- **completed**: Sucesso + link para produto

---

## 🛠️ **Implementações Disponíveis**

### **Para Desenvolvimento Rápido:**
Use `checkout-asaas-example.tsx` com `useMutation`
- Simples e segue padrão recomendado
- Feedback básico para o usuário
- Ideal para MVPs e implementações rápidas

### **Para Produção com UX Premium:**
Use `checkout-asaas-reactive.tsx` com Mutation + Subscription
- Status em tempo real com auto-redirect
- Melhor experiência do usuário
- Ideal para aplicações com alta demanda de UX

---

## 📝 **Exemplo de Uso**

```tsx
// Em uma página de pricing
import { CheckoutAsaasReactive } from '@/components/checkout-asaas-reactive';

export function PricingCard({ product }) {
  return (
    <CheckoutAsaasReactive
      productId={product.productId}
      productName={product.name}
      regularPrice={product.regularPriceNum}
      pixPrice={product.pixPriceNum}
      description={product.description}
    />
  );
}
```

---

## 🔧 **Configuração Necessária**

### **Variáveis de Ambiente:**
```bash
ASAAS_API_KEY=your_asaas_api_key
ASAAS_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_SITE_URL=https://yoursite.com
```

### **Webhook AsaaS:**
```
URL: https://your-app.convex.site/webhooks/asaas
Events: PAYMENT_RECEIVED, PAYMENT_OVERDUE, etc.
```

---

## 🚀 **Conclusão**

**Para produção, sempre use a abordagem recomendada** (Mutation + Action + Subscription):

1. ✅ **Captura intenção** no database
2. ✅ **Processa em background** com actions
3. ✅ **Monitora progresso** com subscriptions
4. ✅ **Experiência reativa** para o usuário
5. ✅ **Auditoria completa** de todas operações

Esta abordagem segue as **boas práticas oficiais do Convex** e garante uma aplicação robusta e escalável! 🎉
