import { getServiceAccountToken } from '@axinom/mosaic-id-link-be';
import { Application } from 'express';
import { GraphQLClient } from 'graphql-request';
import NodeCache from 'node-cache';
import { Config } from '../common';
import {
  CreateSubscriptionSkipValidations,
  CreateSubscriptionTransactionInput,
  getSdk,
  UpdateSubscriptionInput,
} from '../generated';
import { STRIPE_KEY } from '../stripe-domain';

const serviceAccountTokenCache = new NodeCache({ stdTTL: 60 });

export interface BillingSettings {
  successRedirect: string;
  cancelRedirect: string;
  errorRedirect: string;
}

/**
 * GraphQL client to connect to the Mosaic Billing Management Service
 */
export class MosaicBillingClient {
  /**
   * Create an instance of the MosaicBillingClient
   * @param config The configuration settings object
   */
  constructor(private config: Config) {
    const client = new GraphQLClient(
      `${config.billingServiceManagementBaseUrl}graphql`,
    );
    this.sdk = getSdk(client);
  }

  private sdk: ReturnType<typeof getSdk>;

  /** Get a JWT with permissions to access the Mosaic Billing Management Service API */
  private async requestServiceAccountToken(): Promise<string> {
    const cachedToken = serviceAccountTokenCache.get('token');
    if (cachedToken !== undefined) {
      return cachedToken as string;
    }

    const token = await getServiceAccountToken(
      this.config.idServiceAuthBaseUrl,
      this.config.serviceAccountClientId,
      this.config.serviceAccountClientSecret,
    );

    const cacheDuration = token.expiresInSeconds - 60; // to renew it one minute before expiration
    serviceAccountTokenCache.set('token', token.accessToken, cacheDuration);

    return token.accessToken;
  }

  /**
   * Update a subscription in the Mosaic Billing Service
   * @param input The data that should update the subscription
   * @returns The ID of the Mosaic subscription
   */
  async updateSubscription(input: UpdateSubscriptionInput): Promise<string> {
    const data = await this.sdk.updateSubscription(
      { input },
      {
        Authorization: `Bearer ${await this.requestServiceAccountToken()}`,
      },
    );
    return data.updateSubscription.subscription.id;
  }

  /**
   * Create a subscription in the Mosaic Billing Service
   * @param paymentPlanId The Mosaic payment plan ID for which the subscription should be created
   * @param endUserId The ID of the Mosaic end user for whom the subscription should be created
   * @returns The ID of the created subscription and the reference ID of the Stripe price of the Stripe subscription plan that should be purchased
   */
  async createSubscription(
    paymentPlanId: string,
    endUserId: string,
  ): Promise<{ id: string; stripePriceId: string }> {
    const data = await this.sdk.createSubscription(
      {
        input: {
          paymentPlanId: paymentPlanId,
          paymentProviderKey: STRIPE_KEY,
          skipValidations: [
            CreateSubscriptionSkipValidations.SingleSubscription, // Allow multiple subscriptions to make testing easier
          ],
          endUserId: endUserId,
        },
      },
      {
        Authorization: `Bearer ${await this.requestServiceAccountToken()}`,
      },
    );
    const priceId =
      data.createSubscription.subscription.paymentPlan?.providerConfigs.nodes[0]
        .externalId;
    if (!priceId) {
      throw new Error(
        'Could not find a price identifier for the selected payment plan.',
      );
    }
    return {
      id: data.createSubscription.subscription.id,
      stripePriceId: priceId,
    };
  }

  /**
   * Create a subscription transaction in the Mosaic Billing Service
   * @param input The data that should create the new Mosaic subscription transaction
   * @returns The ID of the created subscription transaction
   */
  async createSubscriptionTransaction(
    input: CreateSubscriptionTransactionInput,
  ): Promise<string> {
    const data = await this.sdk.createSubscriptionTransaction(
      { input },
      {
        Authorization: `Bearer ${await this.requestServiceAccountToken()}`,
      },
    );
    return data.createSubscriptionTransaction.transaction.id;
  }

  /**
   * Get Mosaic Billing Service settings
   */
  async getValidatedSettings(): Promise<BillingSettings> {
    const data = await this.sdk.getSettings(
      {},
      {
        Authorization: `Bearer ${await this.requestServiceAccountToken()}`,
      },
    );

    if (!data.getSettings || !data.getSettings.successRedirect) {
      throw new Error('At least the success redirect URL must be configured.');
    }

    return {
      successRedirect: data.getSettings.successRedirect,
      cancelRedirect:
        data.getSettings.cancelRedirect || data.getSettings.successRedirect,
      errorRedirect:
        data.getSettings.errorRedirect || data.getSettings.successRedirect,
    };
  }
}

const MOSAIC_BILLING_CLIENT_KEY = 'MOSAIC_BILLING_CLIENT_KEY';

/** Store the MosaicBillingClient in the express app */
export const setMosaicBillingClient = (
  app: Application,
  client: MosaicBillingClient,
): void => {
  app.set(MOSAIC_BILLING_CLIENT_KEY, client);
};

/** Retrieve the MosaicBillingClient from the express app */
export const getMosaicBillingClient = (
  app: Application,
): MosaicBillingClient => {
  return app.get(MOSAIC_BILLING_CLIENT_KEY);
};
