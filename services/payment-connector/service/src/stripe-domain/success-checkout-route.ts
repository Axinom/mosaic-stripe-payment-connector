import { assertError, Logger } from '@axinom/mosaic-service-common';
import { Application } from 'express';
import { Config } from '../common';
import { SubscriptionLifecycleStatus } from '../generated';
import { BillingSettings, getMosaicBillingClient } from '../mosaic-domain';
import { getStripe } from './stripe-init';
import { convertToISOString } from './stripe-utils';

/**
 * Registers the express-based route to handle the success case of the Stripe checkout process.
 * It checks if the subscription is already active in Stripe and updates the Mosaic subscription accordingly.
 * The 'customer.subscription.created' webhook will still be handled to ensure the Mosaic subscription is correctly updated.
 *
 * @param app The express application
 * @param config The configuration settings object
 */
export const successCheckoutRoute = (
  app: Application,
  config: Config,
): void => {
  const stripe = getStripe(app);
  const billingClient = getMosaicBillingClient(app);
  const logger = new Logger({ context: 'Success Subscription Redirect' });

  app.get('/success-checkout', async (req, res) => {
    let settings: BillingSettings | null = null;
    try {
      settings = await billingClient.getValidatedSettings();
      const sessionId = req.query.session_id as string;
      if (sessionId) {
        const { subscription } = await stripe.checkout.sessions.retrieve(
          sessionId,
          {
            expand: ['subscription'],
          },
        );
        if (!subscription || typeof subscription === 'string') {
          throw new Error('Could not find the subscription.');
        }

        if (subscription.status === 'active') {
          const subscriptionId = await billingClient.updateSubscription({
            subscriptionId: subscription.metadata['subscriptionId'],
            paymentProviderReference: subscription.id,
            lifecycleStatus: SubscriptionLifecycleStatus.Active,
            lifecycleStatusChangeReason: 'Subscription successfully created',
            activationDate: convertToISOString(subscription.start_date),
            periodEndDate: convertToISOString(subscription.current_period_end),
          });

          const successRedirectUrl = new URL(settings.successRedirect);
          successRedirectUrl.searchParams.append(
            'subscription_id',
            subscriptionId,
          );
          res.redirect(successRedirectUrl.href);
          return;
        }
      }
    } catch (error) {
      assertError(error);
      logger.error(error);
    }

    if (settings !== null) {
      // In all "not active subscription" cases still redirect to the success URL but don't include the subscription ID
      res.redirect(settings.successRedirect);
    } else {
      res
        .status(400)
        .send(
          'An error occurred while retrieving Mosaic Billing Service settings',
        );
    }
  });
};
