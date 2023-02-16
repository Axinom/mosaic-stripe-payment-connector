/**
 * Loads all subscription plans that can be purchased with Stripe
 *
 * @param url The URL to the Mosaic Billing Service GraphQL API
 * @param jwt The JWT of the end user that uses the app
 * @returns Object containing the found subscription plans
 */
async function loadSubscriptionPlans(url, jwt) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + jwt,
    },
    body: JSON.stringify({
      query: `query subscriptionPlans { 
        subscriptionPlans {
          nodes {
            id
            title
            paymentPlans(
              filter: {
                providerConfigs: {
                  some: { paymentProviderKey: { equalTo: "CPC_STRIPE" } }
                }
                pricesExist: true
              }
            ) {
              nodes {
                id
                title
                periodQuantity
                periodUnit
                providerConfigs {
                  nodes {
                    paymentProvider {
                      key
                      title
                    }
                  }
                }
                prices(first: 1) {
                  nodes {
                    country
                    currency
                    price
                  }
                }
              }
            }
          }
        }
      }
      `,
    }),
  });
  return res.json();
}

/**
 * Call the Payment Connector API to create a Stripe subscription purchase session
 * and redirect the end user to the Stripe website.
 *
 * @param url The start-checkout URL to the custom Stripe Payment Connector
 * @param paymentPlanId The ID of the Mosaic payment plan that should be purchased with Stripe
 * @param currency The currency of the purchase
 * @param jwt The JWT of the end user that uses the app
 */
async function startStripeSession(url, paymentPlanId, currency, jwt) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + jwt,
    },
    body: JSON.stringify({ paymentPlanId, currency }),
  });
  const data = await res.json();
  window.location.href = data.redirectUrl;
}

/**
 * Call the Payment Connector API to get a list of all overview pages for the customer.
 *
 * @param url The customer-overview URL to the custom Stripe Payment Connector
 * @param jwt The JWT of the end user that uses the app
 */
async function customerOverviewPages(url, jwt) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + jwt,
    },
  });
  return res.json();
}
