# Shopify Draft Order Helper

Utility helpers for creating Shopify draft orders through the Admin GraphQL API (`POST /admin/api/2024-10/graphql.json`).

## Prerequisites

- Node.js 18 or newer (for built-in `fetch`).
- A Shopify Admin API access token with the `write_draft_orders` scope.
- Your shop domain (e.g. `my-shop.myshopify.com`).

## Installation

Clone this repository (or copy the `src` directory) and install dependencies:

```bash
npm install
```

## Usage

```js
import { createDraftOrder, buildDraftOrderInput } from './src/index.js';

const input = buildDraftOrderInput(
  [
    {
      variantId: 'gid://shopify/ProductVariant/1234567890',
      quantity: 1,
    },
  ],
  {
    note: 'Created by custom function',
    email: 'buyer@example.com',
  }
);

const draftOrder = await createDraftOrder({
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
  input,
  // Optional overrides:
  // apiVersion: '2024-10',
  // selection: 'id\nname\nstatus',
  // idempotencyKey: crypto.randomUUID(),
});

console.log(draftOrder);
```

### Customising the response

Use the `selection` option to control which fields are returned from Shopify. By default, the helper fetches the draft order ID, name, status, invoice URL, subtotal and total price sets.

```js
const draftOrder = await createDraftOrder({
  ...options,
  selection: `
    id
    name
    invoiceUrl
    customer {
      email
    }
  `,
});
```

### Handling custom line items

`buildDraftOrderInput` validates that each line item includes a quantity and either a `variantId` or a custom item `title`. You can provide additional DraftOrderInput properties via the `overrides` argument.

```js
const input = buildDraftOrderInput(
  [
    {
      title: 'Custom service',
      quantity: 2,
      originalUnitPrice: '50.00',
      customAttributes: [{ key: 'ticket', value: 'VIP-42' }],
    },
  ],
  {
    billingAddress: {
      address1: '123 Example Street',
      city: 'Ottawa',
      countryCode: 'CA',
    },
  }
);
```

## Error handling

`createDraftOrder` throws when:

- GraphQL returns top-level `errors`.
- The `draftOrderCreate` mutation contains `userErrors`.
- Shopify responds with a non-2xx status code.

Catch and inspect the error message to review details returned from Shopify.

## REST vs GraphQL

Shopify also exposes a REST endpoint at `POST /admin/api/2024-10/draft_orders.json`. This helper targets the GraphQL equivalent mutation (`draftOrderCreate`) at `POST /admin/api/2024-10/graphql.json` to provide richer responses and selection control.

## Next steps

- Wrap the helper in your preferred framework or automation.
- Add tests that mock the Shopify API responses.
- Extend the selection set to include metafields or custom data relevant to your workflow.

