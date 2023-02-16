import Stripe from 'stripe';
import {
  CreateSubscriptionTransactionInput,
  SubscriptionTransactionType,
} from '../../generated';
import { MosaicBillingClient } from '../../mosaic-domain';
import { STRIPE_KEY } from '../stripe-init';
import {
  convertPriceToMosaicFormat,
  convertToISOString,
} from '../stripe-utils';

/**
 * When a Stripe payment succeeded, report this to the Mosaic Billing Service
 *
 * @param invoice The Stripe invoice object (see https://stripe.com/docs/api/invoices/object)
 * @param stripe The initialized Stripe SDK
 * @param billingClient The billing client to access the Mosaic Billing Service Management API
 */

export const handleInvoicePaymentSucceeded = async (
  invoice: Stripe.Invoice,
  stripe: Stripe,
  billingClient: MosaicBillingClient,
): Promise<void> => {
  const stripeSubscription = invoice.subscription;
  if (!stripeSubscription) {
    return; // not a subscription related invoice
  }

  const subscription = await stripe.subscriptions.retrieve(
    typeof stripeSubscription === 'string'
      ? stripeSubscription
      : stripeSubscription.id,
  );
  const subscriptionId = subscription.metadata?.['subscriptionId'];
  if (!subscriptionId) {
    return; // not a valid subscription
  }

  const input: CreateSubscriptionTransactionInput = {
    subscriptionId,
    paymentProviderKey: STRIPE_KEY,
    transactionType: SubscriptionTransactionType.Payment,
    paymentProviderReference: invoice.id,
    totalPrice: convertPriceToMosaicFormat(invoice.amount_paid),
    currency: invoice.currency.toUpperCase(),
    method: invoice.collection_method ?? 'unknown',
    description:
      invoice.description ?? `Payment received for: ${invoice.billing_reason}`,
    transactionDate: convertToISOString(invoice.created),
  };
  await billingClient.createSubscriptionTransaction(input);
};
