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
import { setupAppServer } from './app';
import { getFullConfig } from './common';

// Create the default logger instance to log the application bootstrap sequence and pass to downstream components (where it makes sense).
const logger = new Logger({ context: 'bootstrap' });

// Entry point for the service.
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

  // Create an Express application instance that will be running the end user app
  const app = express();
  setupAppServer(app, config, logger);

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
