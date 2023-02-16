import Stripe from 'stripe';
import {
  SubscriptionLifecycleStatus,
  UpdateSubscriptionInput,
} from '../../generated';
import { MosaicBillingClient } from '../../mosaic-domain';

/**
 * When a Stripe subscription was cancelled immediately ("deleted"), this handler
 * sets the lifecycle status of the corresponding Mosaic subscription to "ended".
 *
 * @param subscription The Stripe subscription object (see https://stripe.com/docs/api/subscriptions/object)
 * @param billingClient The billing client to access the Mosaic Billing Service Management API
 */
export const handleCustomerSubscriptionDeleted = async (
  subscription: Stripe.Subscription,
  billingClient: MosaicBillingClient,
): Promise<void> => {
  const subscriptionId = subscription.metadata['subscriptionId'];
  if (!subscriptionId) {
    return; // Not a valid subscription
  }

  const input: UpdateSubscriptionInput = {
    subscriptionId,
    lifecycleStatus: SubscriptionLifecycleStatus.Ended,
    lifecycleStatusChangeReason: 'The subscription ended.',
  };

  await billingClient.updateSubscription(input);
};
