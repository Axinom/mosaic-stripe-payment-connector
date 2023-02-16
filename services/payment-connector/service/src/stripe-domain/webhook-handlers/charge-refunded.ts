import { Dict } from '@axinom/mosaic-service-common';
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
 * When a refund is issued, this handler creates a Mosaic subscription transaction
 * with the "refund" transaction type.
 *
 * @param charge The Stripe charge object (see https://stripe.com/docs/api/charges/object)
 * @param stripe The initialized Stripe SDK
 * @param billingClient The billing client to access the Mosaic Billing Service Management API
 */
export const handleChargeRefunded = async (
  charge: Stripe.Charge,
  stripe: Stripe,
  billingClient: MosaicBillingClient,
): Promise<void> => {
  if (!charge.invoice) {
    return; // not a charge with an invoice which should be related to a subscription
  }
  const invoice = await stripe.invoices.retrieve(
    typeof charge.invoice === 'string'
      ? charge.invoice
      : charge.invoice.id ?? 'not-provided',
    {
      expand: ['subscription'],
    },
  );
  if (!invoice.subscription || typeof invoice.subscription === 'string') {
    return; // not a subscription related invoice
  }
  const subscriptionId = invoice.subscription.metadata['subscriptionId'];
  if (!subscriptionId) {
    return; // subscription not correct
  }

  // Refunds might use paging but for simplicity we assume that only few partial refunds are granted
  const latestRefund = charge.refunds?.data.reduce((previous, current) =>
    previous.created > current.created ? previous : current,
  );
  if (!latestRefund) {
    return; // no actual refund provided
  }

  const input: CreateSubscriptionTransactionInput = {
    subscriptionId,
    transactionType: SubscriptionTransactionType.Refund,
    paymentProviderKey: STRIPE_KEY,
    paymentProviderReference: latestRefund.id,
    totalPrice: convertPriceToMosaicFormat(latestRefund.amount * -1), // For Mosaic refunds should have negative values
    currency: charge.currency.toUpperCase(),
    method: 'Refund',
    description: `Reason: ${mapReason(latestRefund.reason ?? 'unknown')}`,
    transactionDate: convertToISOString(charge.created),
  };
  await billingClient.createSubscriptionTransaction(input);

  // Only the specific refunds are tracked in this example
  // It would be possible to update e.g. the description of the corresponding
  // Mosaic transaction to reflect full/partial refunds.
};

const reasonMap: Dict<string> = {
  duplicate: 'Duplicate',
  expired_uncaptured_charge: 'Expired uncaptured charge',
  fraudulent: 'Fraudulent',
  requested_by_customer: 'Requested by customer',
};
const mapReason = (reason: string): string =>
  reasonMap[reason] ?? 'unknown reason';
