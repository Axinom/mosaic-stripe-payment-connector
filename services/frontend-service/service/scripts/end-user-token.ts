/* eslint-disable no-console */
import {
  devGenerateUserAccessTokenWithPermissions,
  getServiceAccountToken,
} from '@axinom/mosaic-id-link-be';
import {
  getBasicCustomizableConfigDefinitions,
  getValidatedConfig,
  pick,
} from '@axinom/mosaic-service-common';
import fetch from 'node-fetch';
import { getConfigDefinitions } from '../src/common';

async function main(): Promise<void> {
  // Load and validate the required configuration settings
  const {
    idServiceAuthBaseUrl,
    serviceAccountClientId,
    serviceAccountClientSecret,
    userServiceBaseUrl,
    applicationId,
  } = getValidatedConfig(
    pick(
      {
        ...getConfigDefinitions(),
        ...getBasicCustomizableConfigDefinitions(),
      },
      'idServiceAuthBaseUrl',
      'serviceAccountClientId',
      'serviceAccountClientSecret',
      'userServiceBaseUrl',
      'applicationId',
    ),
  );
  if (!userServiceBaseUrl || !applicationId) {
    console.log(
      `Please define the 'USER_SERVICE_BASE_URL' and 'APPLICATION_ID' env variables in the .env file.`,
    );
    process.exit(-1);
  }

  // Get the JWT of the Mosaic service account
  const idJwt = await getIdToken(
    idServiceAuthBaseUrl,
    serviceAccountClientId,
    serviceAccountClientSecret,
  );

  // Call the Mosaic User Service to generate a development time end user test JWT
  const url = `${userServiceBaseUrl}graphql-management`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idJwt}`,
    },
    body: JSON.stringify({
      query: `
      mutation DevGenerateEndUserToken(
        $input: DevGenerateEndUserAccessTokenInput!
      ) {
        devGenerateEndUserAccessToken(input: $input) {
          accessToken
        }
      }
      `,
      variables: {
        input: {
          applicationId,
        },
      },
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTokenResult = (await res.json()) as any;
  if (userTokenResult.data.errors) {
    console.error(userTokenResult.data.errors);
  } else {
    console.log(userTokenResult.data.devGenerateEndUserAccessToken.accessToken);
  }
}

const getIdToken = async (
  idServiceAuthBaseUrl: string,
  serviceAccountClientId: string,
  serviceAccountClientSecret: string,
): Promise<string> => {
  const permissions = [
    {
      serviceId: 'ax-user-service',
      permissions: ['DEV_END_USER_ACCESS_TOKENS_GENERATE'],
    },
  ];

  const serviceAccountToken = await getServiceAccountToken(
    idServiceAuthBaseUrl,
    serviceAccountClientId,
    serviceAccountClientSecret,
  );
  const devToken = await devGenerateUserAccessTokenWithPermissions(
    idServiceAuthBaseUrl,
    serviceAccountToken.accessToken,
    permissions,
  );

  return devToken.accessToken;
};

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
