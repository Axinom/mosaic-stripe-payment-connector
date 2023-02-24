/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
  getBasicConfigDefinitions,
  getBasicCustomizableConfigDefinitions,
  getBasicMetricsEndpointDefinitions,
  getConfigType,
  getValidatedConfig,
} from '@axinom/mosaic-service-common';
import { from } from 'env-var';

/**
 * Get an object that contains all the configuration declaration functions to
 * load and validate the environment configurations.
 * @param variables `undefined` to use the process environment - or provide custom variables
 */
export const getConfigDefinitions = (
  variables: NodeJS.ProcessEnv = process.env,
) => {
  const env = from(variables);
  return {
    ...getBasicConfigDefinitions(variables),
    ...getBasicCustomizableConfigDefinitions(variables),
    ...getBasicMetricsEndpointDefinitions(variables),
    port: () => env.get('PORT').required().asPortNumber(),
    paymentConnectorBaseUrl: () =>
      env.get('PAYMENT_CONNECTOR_BASE_URL').required().asUrlString(),
    frontendApplicationBaseUrl: () =>
      env.get('FRONTEND_APPLICATION_BASE_URL').required().asUrlString(),
    userServiceAuthBaseUrl: () =>
      env.get('USER_SERVICE_AUTH_BASE_URL').required().asUrlString(),
    billingServiceManagementBaseUrl: () =>
      env.get('BILLING_SERVICE_MANAGEMENT_BASE_URL').required().asUrlString(),
    stripeApiSecret: () => env.get('STRIPE_API_SECRET').required().asString(),
    stripeWebsocketSecret: () =>
      env.get('STRIPE_WEBSOCKET_SECRET').required().asString(),
  };
};

/**
 * Get the full, validated configuration object.
 */
export const getFullConfig = (
  variables: NodeJS.ProcessEnv = process.env,
): Config => {
  return getValidatedConfig(getConfigDefinitions(variables));
};

const config = getConfigType(getConfigDefinitions());
/**
 * The full Configuration type
 */
export type Config = typeof config;
