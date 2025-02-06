import { assertError, Logger } from '@axinom/mosaic-service-common';
import cors from 'cors';
import { Application, json, Request, Response } from 'express';
import { Config, parseAuthenticationTokenValue } from '../common';
import { getMosaicBillingClient } from '../mosaic-domain';
import { ensureCustomerExists } from './ensure-customer-exists';
import { limiter } from './rate-limit';
import { getStripe } from './stripe-init';

/**
 * Registers the express-based route to start the Stripe checkout process
 *
 * @param app The express application
 * @param config The configuration settings object
 */
export const startCheckoutRoute = (app: Application, config: Config): void => {
  const stripe = getStripe(app);
  const billingClient = getMosaicBillingClient(app);
  const logger = new Logger({ context: 'Start Subscription Creation' });

  const startCheckoutMiddleware = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const endUser = await parseAuthenticationTokenValue(
        req.header('Authorization'),
        config,
      );

      const settings = await billingClient.getValidatedSettings();
      const subscription = await billingClient.createSubscription(
        req.body.paymentPlanId,
        endUser.sub,
      );

      const customerId = await ensureCustomerExists(
        endUser,
        req.body.currency,
        stripe,
      );
      const session = await stripe.checkout.sessions.create({
        billing_address_collection: 'auto',
        line_items: [
          {
            price: subscription.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        customer: customerId,
        // route the Stripe success redirect through the payment connector
        success_url: `${config.paymentConnectorBaseUrl}success-checkout?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: settings.cancelRedirect,
        metadata: {
          source: 'session',
          subscriptionId: subscription.id,
        },
        subscription_data: {
          metadata: {
            source: 'session.subscription_data',
            subscriptionId: subscription.id,
          },
        },
        // There is no way to add metadata up front for (future) invoices
        // Therefore payments only have the Stripe subscription ID as reference but not the Mosaic Billing subscription ID
      });

      res.send({ subscriptionId: subscription.id, redirectUrl: session.url });
    } catch (error) {
      assertError(error);
      logger.error(error);

      res.status(400).send({ subscriptionId: null, redirectUrl: null });
    }
  };
  app.post('/start-checkout', [
    json(),
    cors(),
    limiter,
    startCheckoutMiddleware,
  ]);
  app.options('/start-checkout', [cors()]);
};
