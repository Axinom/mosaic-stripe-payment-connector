/** Stripe uses Unix based dates/times based on seconds */
export const convertToISOString = (stripeDate: number): string =>
  new Date(stripeDate * 1000).toISOString();

/**
 * Convert the "cent-based" Stripe price to the decimal-based Mosaic price.
 * To keep this sample project simple, only "cent-based" currencies are supported.
 * Check https://stripe.com/docs/currencies#zero-decimal for exceptional cases
 *
 * @param stripePrice The "cent-based" Stripe price
 * @returns The Mosaic formatted price with five decimal places
 */
export const convertPriceToMosaicFormat = (stripePrice: number): string =>
  (stripePrice / 100).toFixed(5);
