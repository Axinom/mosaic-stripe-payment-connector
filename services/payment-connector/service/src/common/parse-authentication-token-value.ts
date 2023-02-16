import { getAuthenticatedEndUser } from '@axinom/mosaic-id-guard';
import { Config } from './config-definitions';

export interface EndUser {
  sub: string;
  email: string;
  name: string;
}

/**
 * Verifies and parses the end user JWT and extracts the relevant values.
 *
 * @param authValue The value of the authentication header e.g. "Bearer ldk...."
 * @param config The configuration settings object
 * @returns The parsed user details
 */
export const parseAuthenticationTokenValue = async (
  authValue: string | undefined,
  config: Config,
): Promise<EndUser> => {
  const jwt = authValue?.replace('Bearer ', '');
  if (!jwt) {
    throw new Error('Could not retrieve the end user JWT.');
  }
  const endUser = await getAuthenticatedEndUser(jwt, {
    authEndpoint: config.userServiceAuthBaseUrl,
    tenantId: config.tenantId,
    environmentId: config.environmentId,
  });
  if (!endUser || !endUser.email) {
    throw new Error(
      'Could not retrieve the end user with an email address from the JWT.',
    );
  }
  return {
    email: endUser.email,
    name: endUser.name,
    sub: endUser.sub,
  };
};
