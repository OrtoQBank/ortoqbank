import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';
import { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import type { AsaasChargeResponse } from './asaas';

/**
 * Checks if the payment status represents a completed transaction
 */
function isCompletedPayment(status: string | undefined): boolean {
  if (!status) return false;

  // Mercado Pago payment statuses that indicate successful payment
  const successStatuses = ['approved', 'authorized'];
  return successStatuses.includes(status);
}

export async function handleMercadoPagoPayment(paymentData: PaymentResponse) {
  const metadata = paymentData.metadata;
  const userEmail = metadata.user_email; // Os metadados do Mercado Pago são convertidos para snake_case

  if (!userEmail) {
    console.error('Missing user email in payment metadata');
    return;
  }

  // Verify that payment is completed before proceeding
  if (!isCompletedPayment(paymentData.status)) {
    console.log(
      `Payment ${paymentData.id} has status ${paymentData.status || 'undefined'}, not updating user`,
    );
    return;
  }

  try {
    // Initialize Clerk client
    const clerk = await clerkClient();

    // Check if the user already exists
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [userEmail as string],
    });

    if (existingUsers.data.length > 0) {
      // User already exists, update their metadata to mark as paid
      const userId = existingUsers.data[0].id;
      await clerk.users.updateUser(userId, {
        publicMetadata: {
          paid: true,
          paymentId: paymentData.id,

          paymentDate: new Date().toISOString(),
          paymentStatus: paymentData.status,
        },
      });
      console.log(`Updated existing user ${userId} with payment info`);
      return;
    }

    // Send invitation to the user
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: userEmail as string,
      publicMetadata: {
        paid: true,
        paymentId: paymentData.id,

        paymentDate: new Date().toISOString(),
        paymentStatus: paymentData.status,
      },
    });

    console.log(`Invitation sent to ${userEmail}, ID: ${invitation.id}`);
  } catch (error) {
    console.error('Error sending Clerk invitation:', error);
  }

  return;
}

/**
 * Checks if the AsaaS payment status represents a completed transaction
 */
function isCompletedAsaasPayment(status: string | undefined): boolean {
  if (!status) return false;

  // AsaaS payment statuses that indicate successful payment
  const successStatuses = ['RECEIVED', 'CONFIRMED'];
  return successStatuses.includes(status);
}

export async function handleAsaasPayment(paymentData: AsaasChargeResponse) {
  // For AsaaS, we need to get the customer data to find the email
  // The email should be in the externalReference or we need to fetch customer details
  const externalReference = paymentData.externalReference;
  
  if (!externalReference) {
    console.error('Missing external reference in AsaaS payment');
    return;
  }

  // Verify that payment is completed before proceeding
  if (!isCompletedAsaasPayment(paymentData.status)) {
    console.log(
      `AsaaS Payment ${paymentData.id} has status ${paymentData.status || 'undefined'}, not updating user`,
    );
    return;
  }

  try {
    // We need to get the customer details to find the email
    // For now, we'll assume the email is stored in a way we can retrieve it
    // This might need to be adjusted based on how we store the customer relationship
    
    // Get customer details from AsaaS
    const asaasClient = (await import('./asaas')).asaasClient;
    const customer = await asaasClient.getCustomer(paymentData.customer);
    
    const userEmail = customer.email;

    if (!userEmail) {
      console.error('Missing user email in AsaaS customer data');
      return;
    }

    // Initialize Clerk client
    const clerk = await clerkClient();

    // Check if the user already exists
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [userEmail],
    });

    if (existingUsers.data.length > 0) {
      // User already exists, update their metadata to mark as paid
      const userId = existingUsers.data[0].id;
      await clerk.users.updateUser(userId, {
        publicMetadata: {
          paid: true,
          paymentId: paymentData.id,
          paymentGateway: 'asaas',
          paymentDate: paymentData.confirmedDate || paymentData.paymentDate || new Date().toISOString(),
          paymentStatus: paymentData.status,
          paymentValue: paymentData.value,
          externalReference: paymentData.externalReference,
        },
      });
      console.log(`Updated existing user ${userId} with AsaaS payment info`);
      return;
    }

    // Send invitation to the user
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: userEmail,
      publicMetadata: {
        paid: true,
        paymentId: paymentData.id,
        paymentGateway: 'asaas',
        paymentDate: paymentData.confirmedDate || paymentData.paymentDate || new Date().toISOString(),
        paymentStatus: paymentData.status,
        paymentValue: paymentData.value,
        externalReference: paymentData.externalReference,
      },
    });

    console.log(`Invitation sent to ${userEmail} for AsaaS payment, ID: ${invitation.id}`);
  } catch (error) {
    console.error('Error handling AsaaS payment:', error);
  }

  return;
}
