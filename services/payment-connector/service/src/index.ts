import {
  ErrorCode,
  handleGlobalErrors,
  Logger,
  setupGlobalConsoleOverride,
  setupGlobalLogMiddleware,
  setupGlobalSkipMaskMiddleware,
  setupLivenessAndReadiness,
  setupMonitoring,
  tenantEnvironmentIdsLogMiddleware,
  trimErrorsSkipMaskMiddleware,
} from '@axinom/mosaic-service-common';
import express from 'express';
import { Stripe } from 'stripe';
import { getFullConfig } from './common';
import { MosaicBillingClient, setMosaicBillingClient } from './mosaic-domain';
import { setStripe, setupExpressServer } from './stripe-domain';

// Create the default logger instance to log the application bootstrap sequence and pass to downstream components (where it makes sense).
const logger = new Logger({ context: 'bootstrap' });

/**
 * Entry point for the Payment Connector Service.
 */
async function bootstrap(): Promise<void> {
  // Adds `on` handlers for `uncaughtException` and `unhandledRejection` events of node process.
  // Logs all caught errors with log level FATAL, exiting the node process with code 1.
  handleGlobalErrors(logger);
  // Enable a global logging middleware that skips certain logs from having their log values masked (skip false positives).
  // A different middleware can be used in every logger instance where needed.
  setupGlobalSkipMaskMiddleware(trimErrorsSkipMaskMiddleware);
  // Override console calls (mainly from other 3-d party libs) to log them using mosaic logger in a JSON format.
  setupGlobalConsoleOverride(logger);
  // Create a config object.
  const config = getFullConfig();
  // Set middleware that modifies resulting log object, e.g. adding tenantId and
  // environmentId to details
  setupGlobalLogMiddleware([tenantEnvironmentIdsLogMiddleware(config)]);

  // Initialize the stripe connection
  const stripe = new Stripe(config.stripeApiSecret, {
    apiVersion: '2022-11-15',
  });

  // Initialize the Mosaic billing service client
  const billingClient = new MosaicBillingClient(config);

  // Create an Express application instance that will be running the webhooks service
  const app = express();
  setStripe(app, stripe);
  setMosaicBillingClient(app, billingClient);
  setupExpressServer(app, config, logger);

  // Monitoring
  setupMonitoring(config);

  // Set up liveness and readiness probe endpoints for Kubernetes.
  const { readiness } = setupLivenessAndReadiness(config);

  // If we got this far we can probably conclude that the service is ready to receive requests.
  readiness.setState(true);
}

// Start the application or crash and burn.
bootstrap().catch((error) => {
  logger.fatal(error, { details: { code: ErrorCode.StartupError } });
  process.exit(-1);
});
