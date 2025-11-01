import { FunctionReturnType } from 'convex/server';
import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import {
  internalAction,
  internalMutation,
  internalQuery
} from './_generated/server';

/**
 * Create invoice record and trigger Asaas invoice generation
 */
export const generateInvoice = internalMutation({
  args: {
    orderId: v.id('pendingOrders'),
    asaasPaymentId: v.string(),
  },
  returns: v.union(v.id('invoices'), v.null()),
  handler: async (ctx, args) => {
    // Check if invoice already exists
    const existingInvoice = await ctx.db
      .query('invoices')
      .withIndex('by_order', q => q.eq('orderId', args.orderId))
      .first();
    
    if (existingInvoice) {
      return existingInvoice._id;
    }
    
    // Get order details
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }
    
    // Create invoice record
    const invoiceId = await ctx.db.insert('invoices', {
      orderId: args.orderId,
      asaasPaymentId: args.asaasPaymentId,
      status: 'pending',
      municipalServiceId: '', // Will be set during processing
      serviceDescription: 'Acesso à plataforma OrtoQBank',
      value: order.finalPrice,
      customerName: order.name,
      customerEmail: order.email,
      customerCpfCnpj: order.cpf,
      // Customer address (required for invoice generation)
      customerPhone: order.phone,
      customerMobilePhone: order.mobilePhone,
      customerPostalCode: order.postalCode,
      customerAddress: order.address,
      customerAddressNumber: order.addressNumber,
      createdAt: Date.now(),
    });
    
    // Schedule async invoice generation
    await ctx.scheduler.runAfter(0, internal.invoices.processInvoiceGeneration, {
      invoiceId,
    });
    
    return invoiceId;
  },
});

/**
 * Process invoice generation with Asaas (async, non-blocking)
 * 
 * NOTE: Invoice generation requires:
 * 1. Invoice/NF-e features enabled on your Asaas account
 * 2. Valid municipal service code for your municipality
 * 3. Proper account configuration with Asaas (certificate, etc.)
 * 
 * If these are not available, the invoice will be marked as failed
 * but payment processing will NOT be affected.
 */
export const processInvoiceGeneration = internalAction({
  args: {
    invoiceId: v.id('invoices'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get invoice record (outside try block so we can reference it in catch)
    const invoice: FunctionReturnType<typeof internal.invoices.getInvoiceById> = await ctx.runQuery(internal.invoices.getInvoiceById, {
      invoiceId: args.invoiceId,
    });
    
    if (!invoice) {
      return null;
    }
    
    try {
      // Get fiscal service ID from Asaas
      // Hard coded to "02964" according to business needs
      const serviceDescription = '02964';
      
      const fiscalService = await ctx.runAction(api.asaas.getFiscalServiceId, {
        serviceDescription,
      });
      
      if (!fiscalService) {
        const errorMsg = `Fiscal service not found for: ${serviceDescription}. Check your Asaas fiscal configuration.`;
        
        await ctx.runMutation(internal.invoices.updateInvoiceError, {
          invoiceId: args.invoiceId,
          errorMessage: errorMsg,
        });
        
        return null;
      }
      
      // Update invoice status to processing
      await ctx.runMutation(internal.invoices.updateInvoiceServiceId, {
        invoiceId: args.invoiceId,
        municipalServiceId: fiscalService.serviceId,
      });
      
      // Truncate service name to 350 characters (Asaas limit)
      const municipalServiceName = fiscalService.description.length > 250 
        ? fiscalService.description.slice(0, 247) + '...'
        : fiscalService.description;
      
      // Get ISS rate - hard coded to 2% according to business needs
      const issRate = 2;
      
      // Build taxes object (flat structure per Asaas API)
      const taxes = {
        retainIss: false, // Do not retain ISS 
        iss: issRate,    // ISS rate as a direct number (e.g., 2 for 2%)
        cofins: 0,
        csll: 0,
        inss: 0,
        ir: 0,
        pis: 0,
      };
      
      // Schedule invoice with Asaas
      const result = await ctx.runAction(api.asaas.scheduleInvoice, {
        asaasPaymentId: invoice.asaasPaymentId,
        serviceDescription: invoice.serviceDescription,
        municipalServiceId: fiscalService.serviceId,
        municipalServiceName,
        observations: `Pedido: ${invoice.orderId}`,
        taxes, // Pass complete taxes object
      });
      
      // Update invoice record with success
      await ctx.runMutation(internal.invoices.updateInvoiceSuccess, {
        invoiceId: args.invoiceId,
        asaasInvoiceId: result.invoiceId,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update invoice record with error (non-blocking)
      await ctx.runMutation(internal.invoices.updateInvoiceError, {
        invoiceId: args.invoiceId,
        errorMessage,
      });
    }
    
    return null;
  },
});

// Helper queries and mutations for invoice processing
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
