/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
  getBasicConfigDefinitions,
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
    ...getBasicMetricsEndpointDefinitions(variables),
    tenantId: () => env.get('TENANT_ID').required().asString(),
    environmentId: () => env.get('ENVIRONMENT_ID').required().asString(),
    port: () => env.get('PORT').required().asPortNumber(),
    paymentConnectorBaseUrl: () =>
      env.get('PAYMENT_CONNECTOR_BASE_URL').required().asUrlString(),
    billingServiceEndUserBaseUrl: () =>
      env.get('BILLING_SERVICE_END_USER_BASE_URL').required().asUrlString(),
    userServiceBaseUrl: () => env.get('USER_SERVICE_BASE_URL').asUrlString(),
    applicationId: () => env.get('APPLICATION_ID').asString(),
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
