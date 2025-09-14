import { v } from 'convex/values';

import { mutation, query } from './_generated/server';


export const getPricingPlans = query({
  args: {},
  
  handler: async (ctx) => {
    return await ctx.db.query('pricingPlans').order('asc').collect();
  },
});

export const savePricingPlan = mutation({
    args: {
      id: v.optional(v.id('pricingPlans')), // Se não fornecido, cria novo
      name: v.string(),
      badge: v.string(),
      originalPrice: v.string(),
      price: v.string(),
      installments: v.string(),
      installmentDetails: v.string(),
      description: v.string(),
      features: v.array(v.string()),
      buttonText: v.string(),
      popular: v.boolean(),
    },
    returns: v.id('pricingPlans'),
    handler: async (ctx, args) => {
      const { id, ...planData } = args;
      
      if (id) {
        // Editar plano existente
        await ctx.db.patch(id, planData);
        return id;
      } else {
        // Criar novo plano
        return await ctx.db.insert('pricingPlans', planData);
      }
    },
  });
  

export const removePricingPlan = mutation({
  args: { id: v.id('pricingPlans') },
  
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
  