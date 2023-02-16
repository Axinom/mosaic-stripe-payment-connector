import { Application } from 'express';
import { Stripe } from 'stripe';

export const STRIPE_KEY = 'CPC_STRIPE';

/** Store the initialized Stripe SDK in the express app */
export const setStripe = (app: Application, stripe: Stripe): void => {
  app.set(STRIPE_KEY, stripe);
};

/** Retrieve the initialized Stripe SDK from the express app */
export const getStripe = (app: Application): Stripe => {
  return app.get(STRIPE_KEY);
};
