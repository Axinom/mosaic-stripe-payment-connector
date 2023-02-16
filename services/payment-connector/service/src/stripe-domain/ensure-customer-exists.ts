import { Stripe } from 'stripe';

/**
 * Checks if a Mosaic end user was already registered as a Stripe customer.
 * Stripe users are currency specific. If one Mosaic end user wants to purchase
 * subscriptions with different currencies this results in multiple Stripe customers.
 * If the end user was already registered before, the Stripe customer ID is returned.
 * Otherwise the customer is created in the Stripe system.
 *
 * @param endUser The end user details e.g. taken from the end user JWT
 * @param currency The currency in which this Stripe user can pay for subscriptions.
 * @param stripe The initialized Stripe SDK
 * @returns The stripe customer ID
 */
export const ensureCustomerExists = async (
  endUser: {
    sub: string;
    email: string;
    name: string;
  },
  currency: string,
  stripe: Stripe,
): Promise<string> => {
  const stripeCustomers = await stripe.customers.search({
    query: `metadata['end_user_id']:'${endUser.sub}' AND metadata['end_user_currency']:'${currency}'`,
  });
  if (stripeCustomers.data && stripeCustomers.data.length > 0) {
    return stripeCustomers.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      metadata: { end_user_id: endUser.sub, end_user_currency: currency },
      description: 'End-user created via Stripe payment connector',
      email: endUser.email,
      name: endUser.name,
    });
    return customer.id;
  }
};
