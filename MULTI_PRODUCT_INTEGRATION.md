# Multi-Product AsaaS Integration with Existing PricingPlans

## ✅ Successfully Refactored to Use Existing `pricingPlans` Table

Instead of creating a separate `products` table, I extended your existing `pricingPlans` table to support multi-product functionality while maintaining full backward compatibility.

## 🗂️ Schema Changes

### Extended `pricingPlans` Table
```typescript
pricingPlans: defineTable({
  // Your existing fields
  name: v.string(),
  badge: v.string(), 
  originalPrice: v.string(),
  price: v.string(),
  // ... all existing fields preserved

  // ✨ NEW: Extended fields for product identification
  productId: v.optional(v.string()), // e.g., "ortoqbank_2025", "ortoqbank_2026"
  category: v.optional(v.union(v.literal("year_access"), v.literal("premium_pack"))),
  year: v.optional(v.number()), // 2025, 2026, 2027
  regularPriceNum: v.optional(v.number()), // For calculations
  pixPriceNum: v.optional(v.number()),
  accessDurationDays: v.optional(v.number()), // 365 for yearly, undefined for lifetime
  isActive: v.optional(v.boolean()),
  displayOrder: v.optional(v.number()),
})
```

### New `userProducts` Table
```typescript
userProducts: defineTable({
  userId: v.id("users"),
  pricingPlanId: v.id("pricingPlans"), // Links to your pricing plans
  productId: v.string(), // Quick lookup field
  // Purchase tracking
  purchaseDate: v.number(),
  paymentGateway: v.union(v.literal("mercadopago"), v.literal("asaas")),
  paymentId: v.string(),
  purchasePrice: v.number(),
  // Access control
  hasAccess: v.boolean(),
  accessGrantedAt: v.number(),
  accessExpiresAt: v.optional(v.number()),
  status: v.union(v.literal("active"), v.literal("expired"), v.literal("suspended"), v.literal("refunded")),
})
```

## 🎯 Key Features

### 1. Multiple Product Support
Users can now purchase and own multiple products simultaneously:
- OrtoQBank 2025 
- OrtoQBank 2026
- OrtoQBank 2027  
- Premium Pack (lifetime access)

### 2. Enhanced PricingPlans Functions
Extended your existing `pricingPlans.ts` with new functions:

```typescript
// Get active products for purchase
export const getActiveProducts = query(...)

// Get pricing plan by product ID  
export const getByProductId = query(...)

// Grant product access to user
export const grantProductAccess = internalMutation(...)

// Revoke access (for refunds)
export const revokeProductAccess = internalMutation(...)

// Initialize default plans with product data
export const initializeDefaultPlans = mutation(...)
```

### 3. Granular Access Control
New `userAccess.ts` provides comprehensive access management:

```typescript
// Check if user has access to specific year
export const checkUserAccessToYear = query(...)

// Get all user's products with details
export const getUserProducts = query(...)

// Get user's subscription summary
export const getUserSubscriptionSummary = query(...)

// Check specific product access
export const userHasAccess = query(...)
```

### 4. Premium Pack Logic
- **Premium Pack** grants lifetime access to ALL years (2025, 2026, 2027+)
- Automatically overrides individual year purchases
- No expiration date (`accessExpiresAt: undefined`)

### 5. Updated AsaaS Integration
- `createCheckout` now accepts `productId` parameter
- Automatically gets pricing from your existing pricing plans
- Integrates with new multi-product access system

## 🔄 Migration & Compatibility

### Backward Compatibility
✅ **All existing pricing plan data is preserved**  
✅ **Existing API endpoints continue to work**  
✅ **No breaking changes to current functionality**

### Migration Steps
1. **Run schema migration** (automatic with Convex)
2. **Initialize default products:**
   ```typescript
   // Admin-only function to populate product data
   await initializeDefaultPlans()
   ```
3. **Existing users remain unaffected** until they make new purchases

## 🛠️ Usage Examples

### 1. Purchase Flow
```typescript
// User selects OrtoQBank 2026
const checkout = await createCheckout({
  productId: "ortoqbank_2026",
  email: "user@example.com",
  firstName: "João",
  lastName: "Silva",
  cpf: "123.456.789-01"
});
```

### 2. Access Checking
```typescript
// Check if user has access to 2026 content
const access = await checkUserAccessToYear({
  userId: user._id,
  year: 2026
});

if (access.hasAccess) {
  // Grant access to 2026 content
  // Check if it's through premium pack or year-specific purchase
  console.log(`Access type: ${access.accessType}`); // "premium_pack" or "year_access"
}
```

### 3. User Dashboard
```typescript
// Get comprehensive user subscription info
const summary = await getUserSubscriptionSummary({
  userId: user._id
});

console.log(`Active products: ${summary.activeProducts}`);
console.log(`Total spent: R$ ${summary.totalSpent}`);
console.log(`Has premium: ${summary.hasPremium}`);
```

## 📋 Default Products Created

When you run `initializeDefaultPlans()`, these products are created:

1. **OrtoQBank 2025** - R$ 39,90 / R$ 34,90 PIX (365 days)
2. **OrtoQBank 2026** - R$ 49,90 / R$ 44,90 PIX (365 days)  
3. **OrtoQBank 2027** - R$ 59,90 / R$ 54,90 PIX (365 days)
4. **Premium Pack** - R$ 199,90 / R$ 179,90 PIX (lifetime)

## 🎉 Benefits

✅ **Preserves your existing pricing plan system**  
✅ **Supports multiple concurrent product ownership**  
✅ **Granular access control per product**  
✅ **Premium pack with lifetime access logic**  
✅ **Seamless AsaaS integration**  
✅ **Comprehensive user access queries**  
✅ **Revenue tracking per product**  
✅ **Easy to extend with new years/products**

Your users can now purchase 2025, 2026, 2027, and Premium Pack products independently, with each having its own access control and expiration logic! 🚀
