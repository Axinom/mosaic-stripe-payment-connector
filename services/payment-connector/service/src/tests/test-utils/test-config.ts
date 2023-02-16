import { Dict, getValidatedConfig } from '@axinom/mosaic-service-common';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { Config, getConfigDefinitions } from '../../common';

export const createTestConfig = (overrides: Dict<string> = {}): Config => {
  //TODO: Done to support debugging. Review in-code config load when this issue is resolved: https://github.com/firsttris/vscode-jest-runner/issues/166
  process.chdir(resolve(__dirname, '../../../../../../'));
  dotenv.config();

  //This is needed if tests are running from monorepo context instead of project context, e.g. using Jest Runner extension
  process.chdir(resolve(__dirname, '../../../'));
  dotenv.config();

  const defaultOverrides: Dict<string> = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'DEBUG',
    SERVICE_ID: `${process.env.SERVICE_ID}_test`,
  };

  return getValidatedConfig(
    getConfigDefinitions({
      ...process.env,
      ...defaultOverrides,
      ...overrides,
    }),
  );
};
