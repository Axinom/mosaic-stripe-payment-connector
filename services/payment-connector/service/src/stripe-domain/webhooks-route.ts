import { assertError, Dict, Logger } from '@axinom/mosaic-service-common';
import { Application, raw } from 'express';
import Stripe from 'stripe';
import { Config } from '../common';
import { getMosaicBillingClient } from '../mosaic-domain';
import { getStripe } from './stripe-init';
import {
  handleChargeRefunded,
  handleCustomerSubscriptionCreated,
  handleCustomerSubscriptionDeleted,
  handleCustomerSubscriptionUpdated,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
} from './webhook-handlers';

/**
 * Registers the express-based route to start the webhook endpoint called by Stripe
 *
 * @param app The express application
 * @param config The configuration settings object
 */
export const webhooksRoute = (app: Application, config: Config): void => {
  const stripe = getStripe(app);
  const billingClient = getMosaicBillingClient(app);
  const logger = new Logger({ context: 'Webhooks' });
  const unhandledEventLog = config.isDev
    ? logger.debug.bind(logger)
    : logger.warn.bind(logger);

  // The webhooks endpoint must retain the raw body for signature validation
  app.post('/webhooks', raw({ type: '*/*' }), async (request, response) => {
    try {
      // Get the signature and raw webhook body, validate it and construct a Stripe event
      const signature = request.headers['stripe-signature'] as string;
      const event = stripe.webhooks.constructEvent(
        request.body,
        signature,
        config.stripeWebsocketSecret,
      );

      const handle = async (
        event: Stripe.Event,
        callback: () => Promise<void>,
      ): Promise<void> => {
        // first log the event that we (try to) handle
        logger.debug({
          message: `Webhook event "${event.type}" arrived from Stripe`,
          details: (event as unknown) as Dict<unknown>,
        });
        await callback();
      };

      // Handle the relevant Stripe events
      switch (event.type) {
        case 'customer.subscription.created':
          await handle(event, () =>
            handleCustomerSubscriptionCreated(
              event.data.object as Stripe.Subscription,
              billingClient,
            ),
          );
          break;
        case 'customer.subscription.updated':
          await handle(event, () =>
            handleCustomerSubscriptionUpdated(
              event.data.object as Stripe.Subscription,
              event.data.previous_attributes as Dict<unknown>,
              billingClient,
            ),
          );
          break;
        case 'customer.subscription.deleted':
          await handle(event, () =>
            handleCustomerSubscriptionDeleted(
              event.data.object as Stripe.Subscription,
              billingClient,
            ),
          );
          break;
        case 'invoice.payment_succeeded':
          await handle(event, () =>
            handleInvoicePaymentSucceeded(
              event.data.object as Stripe.Invoice,
              stripe,
              billingClient,
            ),
          );
          break;
        case 'invoice.payment_failed':
          await handle(event, () =>
            handleInvoicePaymentFailed(
              event.data.object as Stripe.Invoice,
              stripe,
              billingClient,
            ),
          );
          break;
        case 'charge.refunded':
          await handle(event, () =>
            handleChargeRefunded(
              event.data.object as Stripe.Charge,
              stripe,
              billingClient,
            ),
          );
          break;
        default:
          // During development all events are sent so this creates a lot of debug logs.
          // For production use the dashboard to configure exactly the events
          // that are handled above: https://dashboard.stripe.com/webhooks
          unhandledEventLog(`Unhandled event type "${event.type}".`);
      }

      // Return a 200 response to acknowledge receipt of the event if no exception was thrown
      response.status(200).send();
    } catch (error) {
      assertError(error);
      logger.error(error);

      // Return a 400 error response so Stripe will send the event again.
      response.status(400).send(/*html*/ `<!DOCTYPE html>
        <html>
          <body>
            <h1>Could not process the webhook: ${(error as Error).message}</h1>
          </body>
        </html>
        `);
    }
  });
};
