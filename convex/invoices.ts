import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';

// ──────────────────────────────────────────────────────
// Invoice Helpers (legacy - for historical data access)
// ──────────────────────────────────────────────────────
// NOTE: Invoice generation was previously handled via Asaas integration.
// That flow has been removed as payments are now centralized in ortoclub.
// These helper functions remain for reading/managing historical invoice records.
export const getInvoiceById = internalQuery({
  args: { invoiceId: v.id('invoices') },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId);
  },
});

export const updateInvoiceServiceId = internalMutation({
  args: {
    invoiceId: v.id('invoices'),
    municipalServiceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      municipalServiceId: args.municipalServiceId,
      status: 'processing',
    });
    return null;
  },
});

export const updateInvoiceSuccess = internalMutation({
  args: {
    invoiceId: v.id('invoices'),
    asaasInvoiceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      asaasInvoiceId: args.asaasInvoiceId,
      status: 'issued',
      issuedAt: Date.now(),
    });
    return null;
  },
});

export const updateInvoiceError = internalMutation({
  args: {
    invoiceId: v.id('invoices'),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      status: 'failed',
      errorMessage: args.errorMessage,
    });
    return null;
  },
});
