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
 * IMPORTANT: For installment payments, this generates ONE invoice with the TOTAL value
 * The invoice notes the payment method and number of installments
 */
export const generateInvoice = internalMutation({
  args: {
    orderId: v.id('pendingOrders'),
    asaasPaymentId: v.string(),
    totalValue: v.number(), // Total invoice value (full order amount)
    totalInstallments: v.optional(v.number()), // Number of installments (for payment info)
  },
  returns: v.union(v.id('invoices'), v.null()),
  handler: async (ctx, args) => {
    const totalInstallments = args.totalInstallments || 1;

    // Check if invoice already exists for this order
    const existingInvoice = await ctx.db
      .query('invoices')
      .withIndex('by_order', q => q.eq('orderId', args.orderId))
      .first();

    if (existingInvoice) {
      console.log(`Invoice already exists for order ${args.orderId}`);
      return existingInvoice._id;
    }

    // Get order details
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      console.error(`Order not found: ${args.orderId}`);
      return null;
    }

    // Build service description
    const serviceDescription = 'Acesso à plataforma OrtoQBank';

    // Build payment method description for invoice observations
    let paymentMethodDescription = 'Cartão de Crédito';
    if (order.paymentMethod === 'PIX') {
      paymentMethodDescription = 'PIX';
    } else if (totalInstallments > 1) {
      paymentMethodDescription = `Cartão de Crédito - ${totalInstallments}x de R$ ${(args.totalValue / totalInstallments).toFixed(2)}`;
    }

    console.log(`📄 Creating invoice for order ${args.orderId}: ${serviceDescription} - R$ ${args.totalValue} (${paymentMethodDescription})`);

    // Create invoice record with installment information for reference
    const invoiceId = await ctx.db.insert('invoices', {
      orderId: args.orderId,
      asaasPaymentId: args.asaasPaymentId,
      status: 'pending',
      municipalServiceId: '', // Will be set during processing
      serviceDescription,
      value: args.totalValue, // Always the TOTAL value
      installmentNumber: totalInstallments > 1 ? 1 : undefined, // Mark as installment payment
      totalInstallments: totalInstallments > 1 ? totalInstallments : undefined,
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

    console.log(`✅ Invoice ${invoiceId} created and scheduled for processing`);

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

      // Build observations with payment method and installment info
      let observations = `Pedido: ${invoice.orderId}`;

      // Add installment payment information to observations if applicable
      if (invoice.totalInstallments && invoice.totalInstallments > 1) {
        const installmentValue = invoice.value / invoice.totalInstallments;
        observations += `\nForma de Pagamento: Cartão de Crédito`;
        observations += `\nParcelamento: ${invoice.totalInstallments}x de R$ ${installmentValue.toFixed(2)}`;
        observations += `\nValor Total: R$ ${invoice.value.toFixed(2)}`;
      }

      // Schedule invoice with Asaas
      // IMPORTANT: Pass explicit value to override payment value (critical for installments)
      const result = await ctx.runAction(api.asaas.scheduleInvoice, {
        asaasPaymentId: invoice.asaasPaymentId,
        serviceDescription: invoice.serviceDescription,
        value: invoice.value, // Explicit value - overrides payment value (required for installments)
        municipalServiceId: fiscalService.serviceId,
        municipalServiceName,
        observations,
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
