import { assertError, Logger } from '@axinom/mosaic-service-common';
import cors from 'cors';
import { Application, Request, Response } from 'express';
import { Config, parseAuthenticationTokenValue } from '../common';
import { getStripe } from './stripe-init';

/**
 * Get the URLs to the Stripe customer overview page
 *
 * @param app The express application
 * @param config The configuration settings object
 */
export const customerOverviewRoute = (
  app: Application,
  config: Config,
): void => {
  const stripe = getStripe(app);
  const logger = new Logger({ context: 'Customer Overview Page' });

  const customerOverviewMiddleware = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const endUser = await parseAuthenticationTokenValue(
        req.header('Authorization'),
        config,
      );
      const stripeCustomers = await stripe.customers.search({
        query: `metadata['end_user_id']:'${endUser.sub}'`,
      });
      if (stripeCustomers.data && stripeCustomers.data.length > 0) {
        const overviewPages = [];
        for (const customer of stripeCustomers.data) {
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: process.env.API_URL,
          });
          overviewPages.push({
            name: `${customer.name} (${customer.metadata['end_user_currency']})`,
            url: portalSession.url,
          });
        }
        res.send(overviewPages);
      } else {
        res.send([]);
      }
    } catch (error) {
      assertError(error);
      logger.error(error);

      res.status(400).send([]);
    }
  };
  app.get('/customer-overview', [cors(), customerOverviewMiddleware]);
  app.options('/customer-overview', [cors()]);
};
