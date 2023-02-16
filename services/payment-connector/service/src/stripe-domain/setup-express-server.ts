import { Logger } from '@axinom/mosaic-service-common';
import { Application } from 'express';
import { Config } from '../common';
import { customerOverviewRoute } from './customer-overview-route';
import { startCheckoutRoute } from './start-checkout-route';
import { successCheckoutRoute } from './success-checkout-route';
import { webhooksRoute } from './webhooks-route';

/**
 * Initialized the express application with the available routes and starts the server.
 *
 * @param app The express application
 * @param config The configuration settings object
 * @param logger The bootstrapping logger object
 */
export const setupExpressServer = (
  app: Application,
  config: Config,
  logger: Logger,
): void => {
  startCheckoutRoute(app, config);
  successCheckoutRoute(app, config);
  customerOverviewRoute(app, config);
  webhooksRoute(app, config);

  app.listen(config.port, () =>
    logger.log(
      `The payment connector server is up and running: http://localhost:${config.port}`,
    ),
  );
};
