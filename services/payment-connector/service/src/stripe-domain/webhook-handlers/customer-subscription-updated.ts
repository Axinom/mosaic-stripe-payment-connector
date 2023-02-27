import { Dict, UnreachableCaseError } from '@axinom/mosaic-service-common';
import Stripe from 'stripe';
import {
  SubscriptionLifecycleStatus,
  UpdateSubscriptionInput,
} from '../../generated';
import { MosaicBillingClient } from '../../mosaic-domain';
import { convertToISOString } from '../stripe-utils';

/**
 * The details of a Stripe subscription are updated for various reasons. This
 * webhook updates the Billing Service subscription with those new details. The
 * Mosaic subscription status is mapped based on changes to the Stripe subscription
 * status and the Stripe logic on how subscription cancellations are managed.
 *
 * @param subscription The Stripe subscription object (see https://stripe.com/docs/api/subscriptions/object)
 * @param previousAttributes A list of the properties that changed and their original value.
 * @param billingClient The billing client to access the Mosaic Billing Service Management API
 */
export const handleCustomerSubscriptionUpdated = async (
  subscription: Stripe.Subscription,
  previousAttributes: Dict<unknown> | undefined,
  billingClient: MosaicBillingClient,
): Promise<void> => {
  const subscriptionId = subscription.metadata['subscriptionId'];
  if (!previousAttributes || !subscriptionId) {
    return; // nothing was changed (why was there an event?) or it was not a valid subscription
  }

  const input: UpdateSubscriptionInput = { subscriptionId };

  // Check for status changes including cancellations
  if (previousAttributes.status) {
    applyLifeCycleChange(
      previousAttributes.status as Stripe.Subscription.Status,
      subscription.status,
      input,
    );
  } else if (
    previousAttributes.cancel_at === null && // only change status if the subscription was not marked as going to be cancelled already
    subscription.cancel_at !== null
  ) {
    // Stripe marks the status of a subscription as cancelled only after it expired
    // Mosaic marks it already as cancelled while not yet expired
    applyLifeCycleChange(subscription.status, 'canceled', input);
  } else if (previousAttributes.cancel_at && subscription.cancel_at === null) {
    // Undo cancellation
    applyLifeCycleChange('canceled', subscription.status, input);
  }

  if (previousAttributes.start_date) {
    input.activationDate = convertToISOString(subscription.start_date);
  }

  if (previousAttributes.current_period_end) {
    input.periodEndDate = convertToISOString(subscription.current_period_end);
  }

  // Stripe has more/different properties than a Mosaic subscription
  // If only "non-relevant" fields were changed in Stripe the Mosaic subscription does not need to be updated
  if (Object.keys(input).length > 1) {
    await billingClient.updateSubscription(input);
  }
};

/** Map the Stripe status to the corresponding Mosaic status and provide a change reason */
const applyLifeCycleChange = (
  oldStatus: Stripe.Subscription.Status,
  newStatus: Stripe.Subscription.Status,
  updateSubscriptionInput: UpdateSubscriptionInput,
): void => {
  let changeReason = 'Unsupported lifecycle change.';
  switch (newStatus) {
    case 'active':
      {
        // The subscription is in good standing and the most recent payment is successful.

        // A subscription can go to the active state:
        // - receiving the successful payment after the initial creation of the subscription
        // - after the trial of the subscription ended (currently not supported)
        // - after a failed payment was recovered (from status past_due or unpaid)
        // - indirectly from canceled as Mosaic tracks cancelled subscription with the lifecycle state
        switch (oldStatus) {
          case 'incomplete':
            changeReason = 'The subscription was successfully paid.';
            break;
          case 'trialing':
            changeReason =
              'The subscription was in a trial period and got now active.';
            break;
          case 'past_due':
          case 'unpaid':
            changeReason =
              'The subscription was was unpaid but got paid again.';
            break;
          case 'canceled':
            changeReason = 'The cancellation of the subscription was reverted.';
            break;
        }
        updateSubscriptionInput.lifecycleStatus =
          SubscriptionLifecycleStatus.Active;
      }
      break;
    case 'canceled':
      // The subscription has been canceled. During cancellation, automatic collection
      // for all unpaid invoices is disabled (auto_advance=false).
      // This is a terminal state that can’t be updated.
      changeReason = 'The subscription was cancelled.';
      updateSubscriptionInput.lifecycleStatus =
        SubscriptionLifecycleStatus.Cancelled;
      break;
    case 'incomplete':
      // A successful payment needs to be made within 23 hours to activate the
      // subscription. Subscriptions can also be incomplete if there’s a pending payment.
      changeReason = 'The subscription got back into the incomplete state.';
      updateSubscriptionInput.lifecycleStatus =
        SubscriptionLifecycleStatus.PendingCompletion;
      break;
    case 'incomplete_expired':
      // The initial payment on the subscription failed and no successful payment
      // was made within 23 hours of creating the subscription. These subscriptions
      // don’t bill customers.
      changeReason = 'The subscription was not successfully paid.';
      updateSubscriptionInput.lifecycleStatus =
        SubscriptionLifecycleStatus.Ended;
      break;
    case 'past_due':
      // Payment on the latest finalized invoice either failed or wasn’t attempted.
      // The subscription continues to create invoices. Your subscription settings
      // determine the subscription’s next state. If the invoice is still unpaid
      // after all Smart Retries have been attempted, you can configure the
      // subscription to move to canceled, unpaid, or leave it as past_due.

      // During this state the Mosaic subscription is kept in the ACTIVE state.
      break;
    case 'unpaid':
      // The initial payment on the subscription failed and no successful payment
      // was made within 23 hours of creating the subscription. These subscriptions
      // don’t bill customers.
      changeReason =
        'The subscription was not successfully paid even after retries.';
      updateSubscriptionInput.lifecycleStatus =
        SubscriptionLifecycleStatus.OnHold;
      break;
    case 'trialing':
      // The subscription is currently in a trial period. The subscription transitions
      // automatically to active when the first payment is made.
      // This is currently not supported!
      changeReason = 'The subscription started a trial period.';
      updateSubscriptionInput.lifecycleStatus =
        SubscriptionLifecycleStatus.Active;
      break;
    case 'paused':
      // The subscription is paused. It can be resumed later.
      changeReason = 'The subscription was paused.';
      updateSubscriptionInput.lifecycleStatus =
        SubscriptionLifecycleStatus.OnHold;
      break;
    default:
      //Exhaustiveness check
      throw new UnreachableCaseError(newStatus);
  }
  updateSubscriptionInput.lifecycleStatusChangeReason = changeReason;
};
