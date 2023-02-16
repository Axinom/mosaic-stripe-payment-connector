import {
  AuthenticatedManagementSubject,
  ManagementAuthenticationContext,
} from '@axinom/mosaic-id-guard';
import { Dict, Logger } from '@axinom/mosaic-service-common';
import { resolve } from 'path';
import { Config } from '../../common';
import { createTestConfig } from './test-config';
import { createTestUser } from './test-user';

export interface ITestContext {
  config: Config;
  logger: Logger;
}

export interface TestRequestContext {
  authContext: ManagementAuthenticationContext;
}

export const createTestRequestContext = (
  serviceId: string,
  subject?: AuthenticatedManagementSubject,
): TestRequestContext => {
  return {
    authContext: {
      subject: subject ?? createTestUser(serviceId),
    },
  };
};

export const createTestContext = async (
  configOverrides: Dict<string> = {},
): Promise<ITestContext> => {
  jest.setTimeout(60000);

  //This is needed if tests are running from monorepo context instead of project context, e.g. using Jest Runner extension
  process.chdir(resolve(__dirname, '../../../'));

  const config = createTestConfig(configOverrides);

  const logger = new Logger({ config, context: 'TestContext' });

  return {
    config,
    logger,
  };
};
