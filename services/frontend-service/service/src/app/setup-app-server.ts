import { Logger } from '@axinom/mosaic-service-common';
import express, { Application } from 'express';
import { join } from 'path';
import { Config } from '../common';

/**
 * Set up the application server used for the frontend application
 *
 * @param app The express application that serves the end user application
 * @param config The configuration settings object
 * @param logger The Mosaic based logger
 */
export const setupAppServer = (
  app: Application,
  config: Config,
  logger: Logger,
): void => {
  app.use(function(req, res, next) {
    // A very simplified way to configure the service URLs for the client side code.
    res.cookie(
      'billing-service-base-url',
      `${config.billingServiceEndUserBaseUrl}`,
    );
    res.cookie(
      'payment-connector-base-url',
      `${config.paymentConnectorBaseUrl}`,
    );
    next();
  });
  // Expose the contents of the "public" folder
  app.use(express.static(join(__dirname, 'public')));

  app.listen(config.port, () =>
    logger.log(
      `The frontend app server is up and running: http://localhost:${config.port}`,
    ),
  );
};
