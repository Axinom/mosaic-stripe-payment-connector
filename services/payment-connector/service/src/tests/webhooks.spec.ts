/* eslint-disable @typescript-eslint/no-var-requires */
import 'jest-extended';
import { mock } from 'jest-mock-extended';
import { Stripe } from 'stripe';
import { MosaicBillingClient } from '../mosaic-domain';
import {
  handleChargeRefunded,
  handleCustomerSubscriptionCreated,
  handleCustomerSubscriptionDeleted,
  handleCustomerSubscriptionUpdated,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
} from '../stripe-domain/webhook-handlers';

describe('Webhook Tests', () => {
  // The Mosaic billing client would call the GraphQL API of the Billing Service
  const billingClient = mock<MosaicBillingClient>();
  // Return a specific invoice and subscription instead of calling the Stripe API
  const stripe = mock<Stripe>();
  stripe.invoices = mock<Stripe.InvoicesResource>();
  stripe.subscriptions = mock<Stripe.SubscriptionsResource>();
  (stripe.invoices.retrieve as jest.Mock).mockResolvedValue(
    require('./resources/api-invoice-with-subscription.json'),
  );
  (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(
    require('./resources/api-subscription.json'),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('charge.refunded remaining amount', async () => {
    // Arrange
    const event = require('./resources/webhook-charge.refunded-full.json');

    // Act
    await handleChargeRefunded(event.data.object, stripe, billingClient);

    // Assert
    expect(billingClient.createSubscriptionTransaction).toHaveBeenCalledWith({
      totalPrice: '-0.66000',
      currency: 'EUR',
      description: 'Reason: Requested by customer',
      method: 'Refund',
      transactionType: 'REFUND',
      paymentProviderKey: 'CPC_STRIPE',
      paymentProviderReference: 're_3LKzMCF25jWjUFkW1FIJjyIO',
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      transactionDate: '2022-07-13T06:47:37.000Z',
    });
  });

  it('charge.refunded partial amount', async () => {
    // Arrange
    const event = require('./resources/webhook-charge.refunded-partial.json');

    // Act
    await handleChargeRefunded(event.data.object, stripe, billingClient);

    // Assert
    expect(billingClient.createSubscriptionTransaction).toHaveBeenCalledWith({
      totalPrice: '-0.33000',
      currency: 'EUR',
      description: 'Reason: Requested by customer',
      method: 'Refund',
      transactionType: 'REFUND',
      paymentProviderKey: 'CPC_STRIPE',
      paymentProviderReference: 're_3LKzMCF25jWjUFkW1JyryP3W',
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      transactionDate: '2022-07-13T06:47:37.000Z',
    });
  });

  it('customer.subscription.created', async () => {
    // Arrange
    const event = require('./resources/webhook-customer.subscription.created.json');

    // Act
    await handleCustomerSubscriptionCreated(event.data.object, billingClient);

    // Assert
    expect(billingClient.updateSubscription).toHaveBeenCalledWith({
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      paymentProviderReference: 'sub_1LKzMBF25jWjUFkWsmYTumfm',
      activationDate: '2022-07-13T06:47:35.000Z',
      periodEndDate: '2022-07-14T06:47:35.000Z',
    });
  });

  it('customer.subscription.deleted', async () => {
    // Arrange
    const event = require('./resources/webhook-customer.subscription.deleted.json');

    // Act
    await handleCustomerSubscriptionDeleted(event.data.object, billingClient);

    // Assert
    expect(billingClient.updateSubscription).toHaveBeenCalledWith({
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      lifecycleStatus: 'ENDED',
      lifecycleStatusChangeReason: 'The subscription ended.',
    });
  });

  it('customer.subscription.updated subscription got activated', async () => {
    // Arrange
    const event = require('./resources/webhook-customer.subscription.updated-activated.json');

    // Act
    await handleCustomerSubscriptionUpdated(
      event.data.object,
      event.data.previous_attributes,
      billingClient,
    );

    // Assert
    expect(billingClient.updateSubscription).toHaveBeenCalledWith({
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      lifecycleStatus: 'ACTIVE',
      lifecycleStatusChangeReason: 'The subscription was successfully paid.',
    });
  });

  it('customer.subscription.updated subscription was cancelled', async () => {
    // Arrange
    const event = require('./resources/webhook-customer.subscription.updated-cancelled.json');

    // Act
    await handleCustomerSubscriptionUpdated(
      event.data.object,
      event.data.previous_attributes,
      billingClient,
    );

    // Assert
    expect(billingClient.updateSubscription).toHaveBeenCalledWith({
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      lifecycleStatus: 'CANCELLED',
      lifecycleStatusChangeReason: 'The subscription was cancelled.',
    });
  });

  it('customer.subscription.updated subscription cancellation was reverted', async () => {
    // Arrange
    const event = require('./resources/webhook-customer.subscription.updated-revert-cancelling.json');

    // Act
    await handleCustomerSubscriptionUpdated(
      event.data.object,
      event.data.previous_attributes,
      billingClient,
    );

    // Assert
    expect(billingClient.updateSubscription).toHaveBeenCalledWith({
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      lifecycleStatus: 'ACTIVE',
      lifecycleStatusChangeReason:
        'The cancellation of the subscription was reverted.',
    });
  });

  it('invoice.payment_failed for the initial subscription purchase', async () => {
    // Arrange
    const event = require('./resources/webhook-invoice.payment_failed.json');

    // Act
    await handleInvoicePaymentFailed(event.data.object, stripe, billingClient);

    // Assert
    expect(billingClient.createSubscriptionTransaction).toHaveBeenCalledWith({
      totalPrice: '0',
      currency: 'EUR',
      description: 'Payment failed for: subscription_create',
      method: 'charge_automatically',
      transactionType: 'PAYMENT_FAILED',
      paymentProviderKey: 'CPC_STRIPE',
      paymentProviderReference: 'in_1LKzaIF25jWjUFkWzzIloSIs',
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      transactionDate: '2022-07-13T07:02:10.000Z',
    });
  });

  it('invoice.payment_succeeded for the initial subscription purchase', async () => {
    // Arrange
    const event = require('./resources/webhook-invoice.payment_succeeded.json');

    // Act
    await handleInvoicePaymentSucceeded(
      event.data.object,
      stripe,
      billingClient,
    );

    // Assert
    expect(billingClient.createSubscriptionTransaction).toHaveBeenCalledWith({
      totalPrice: '0.99000',
      currency: 'EUR',
      description: 'Payment received for: subscription_create',
      method: 'charge_automatically',
      transactionType: 'PAYMENT',
      paymentProviderKey: 'CPC_STRIPE',
      paymentProviderReference: 'in_1LKzMBF25jWjUFkWxcX1B2Za',
      subscriptionId: 'da6cdb9d-822c-4a33-8953-39a34bd6bc71',
      transactionDate: '2022-07-13T06:47:35.000Z',
    });
  });
});
