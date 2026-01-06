# Asaas Payment API - Quick Reference

## 🎯 Three Ways to Create Payments

### 1️⃣ Single Payment (À vista)

```json
{
  "customer": "cus_xxx",
  "billingType": "CREDIT_CARD",
  "value": 2029.44,           // ✅ Use 'value' for single payments
  "dueDate": "2025-11-02",
  "creditCard": { ... },
  "creditCardHolderInfo": { ... }
}
```

**When**: Customer pays full amount at once  
**Asaas charges**: R$ 2029.44 immediately

---

### 2️⃣ Installment Payment - Auto Calculation (RECOMMENDED) ⭐

```json
{
  "customer": "cus_xxx",
  "billingType": "CREDIT_CARD",
  "totalValue": 2029.44,      // ✅ Use 'totalValue' for installments
  "installmentCount": 12,     // ✅ Number of installments
  "dueDate": "2025-11-02",
  "creditCard": { ... },
  "creditCardHolderInfo": { ... }
}
```

**When**: Customer wants to split payment  
**Asaas charges**: 12 separate charges of R$ 169.12 each (calculated
automatically)  
**Why use this**: Simpler, no rounding errors, Asaas handles calculation

---

### 3️⃣ Installment Payment - Manual Calculation

```json
{
  "customer": "cus_xxx",
  "billingType": "CREDIT_CARD",
  "installmentCount": 12,     // ✅ Number of installments
  "installmentValue": 169.12, // ✅ You calculate the value
  "dueDate": "2025-11-02",
  "creditCard": { ... },
  "creditCardHolderInfo": { ... }
}
```

**When**: You need exact control over installment amounts  
**Asaas charges**: 12 separate charges of exactly R$ 169.12 each  
**Why use this**: Custom rounding, promotional pricing per installment

---

## ❌ Common Mistakes

### Mistake #1: Using 'value' for installments

```json
{
  "value": 2029.44, // ❌ Wrong field for installments
  "installments": 12 // ❌ Wrong parameter name
}
```

**Result**: Asaas charges full R$ 2029.44 immediately (single payment)

### Mistake #2: Mixing single and installment fields

```json
{
  "value": 2029.44, // ❌ Don't mix these
  "totalValue": 2029.44, // ❌ Choose one approach
  "installmentCount": 12
}
```

**Result**: Unpredictable behavior

---

## ✅ Decision Tree

```
Is this an installment payment?
│
├─ NO  → Use "value"
│         Example: { "value": 2029.44 }
│
└─ YES → Use "totalValue" + "installmentCount"
          Example: { "totalValue": 2029.44, "installmentCount": 12 }
```

---

## 📋 Field Reference

| Field              | Type   | Required?             | Used For                      | Notes                                  |
| ------------------ | ------ | --------------------- | ----------------------------- | -------------------------------------- |
| `value`            | number | Single payments       | Full payment amount           | Don't use with installments            |
| `totalValue`       | number | Installments (auto)   | Total across all installments | Asaas calculates per-installment value |
| `installmentCount` | number | All installments      | Number of payments            | 1-21 for Visa/Master, 1-12 for others  |
| `installmentValue` | number | Installments (manual) | Amount per installment        | Alternative to `totalValue`            |

---

## 🔍 Response Differences

### Single Payment Response

```json
{
  "id": "pay_xxx",
  "value": 2029.44,
  "installmentNumber": null, // ← null for single payments
  "status": "CONFIRMED"
}
```

### Installment Payment Response

```json
{
  "id": "pay_xxx",
  "value": 169.12, // ← Per-installment value
  "totalValue": 2029.44, // ← Total across all
  "installmentNumber": 1, // ← Which installment (1-12)
  "status": "CONFIRMED"
}
```

---

## 💡 Implementation Tip

Use a conditional to set the right fields:

```typescript
const paymentRequest: any = {
  /* common fields */
};

if (installmentCount > 1) {
  // Installment payment
  paymentRequest.totalValue = finalPrice;
  paymentRequest.installmentCount = installmentCount;
} else {
  // Single payment
  paymentRequest.value = finalPrice;
}
```

---

## 📚 Official Documentation

- [Criar cobrança com cartão de crédito](https://docs.asaas.com/reference/criar-cobranca-com-cartao-de-credito)
- [Installment Payments Guide](https://docs.asaas.com/docs/installment-payments)

---

**Last Updated**: November 2, 2025  
**Applies To**: Asaas API v3
