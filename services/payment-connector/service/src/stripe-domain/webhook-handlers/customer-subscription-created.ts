import Stripe from 'stripe';
import { UpdateSubscriptionInput } from '../../generated';
import { MosaicBillingClient } from '../../mosaic-domain';
import { convertToISOString } from '../stripe-utils';

/**
 * After a subscription was created, this handler updates the corresponding Mosaic
 * subscription with the Stripe provided values.
 *
 * @param subscription The Stripe subscription object (see https://stripe.com/docs/api/subscriptions/object)
 * @param billingClient The billing client to access the Mosaic Billing Service Management API
 */
export const handleCustomerSubscriptionCreated = async (
  subscription: Stripe.Subscription,
  billingClient: MosaicBillingClient,
): Promise<void> => {
  const subscriptionId = subscription.metadata['subscriptionId'];
  if (!subscriptionId) {
    return; // Not a valid subscription
  }

  const input: UpdateSubscriptionInput = {
    subscriptionId: subscription.metadata['subscriptionId'],
    paymentProviderReference: subscription.id,
    activationDate: convertToISOString(subscription.start_date),
    periodEndDate: convertToISOString(subscription.current_period_end),
  };
  await billingClient.updateSubscription(input);
};
