const DEFAULT_API_VERSION = '2024-10';
const DEFAULT_DRAFT_ORDER_SELECTION = `
id
name
status
invoiceUrl
subtotalPriceSet {
  presentmentMoney {
    amount
    currencyCode
  }
}
totalPriceSet {
  presentmentMoney {
    amount
    currencyCode
  }
}
`
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join('\n');

const GRAPHQL_TEMPLATE = (selection) => `mutation draftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      ${selection}
    }
    userErrors {
      field
      message
    }
  }
}`;

/**
 * Create a Shopify Draft Order via the Admin GraphQL API.
 *
 * @param {Object} options
 * @param {string} options.storeDomain - Your Shopify store domain (e.g. my-shop.myshopify.com).
 * @param {string} options.accessToken - Admin API access token.
 * @param {Object} options.input - DraftOrderInput payload (see Shopify docs).
 * @param {string} [options.apiVersion] - Admin API version to target. Defaults to 2024-10.
 * @param {string} [options.selection] - GraphQL selection set for the draft order fields to return.
 * @returns {Promise<Object>} Resolves with the created draft order object.
 */
export async function createDraftOrder({
  storeDomain,
  accessToken,
  input,
  apiVersion = DEFAULT_API_VERSION,
  selection = DEFAULT_DRAFT_ORDER_SELECTION,
  idempotencyKey,
  headers: extraHeaders = {},
  fetchOptions = {},
} = {}) {
  if (!storeDomain) {
    throw new Error('A Shopify store domain is required (e.g. my-shop.myshopify.com).');
  }

  if (!accessToken) {
    throw new Error('A Shopify Admin API access token is required.');
  }

  if (!input || typeof input !== 'object') {
    throw new Error('A valid DraftOrderInput object must be provided.');
  }

  if (!globalThis.fetch) {
    throw new Error('Global fetch is not available. Use Node.js 18+ or polyfill fetch.');
  }

  const endpoint = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;
  const body = {
    query: GRAPHQL_TEMPLATE(selection),
    variables: { input },
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
    ...extraHeaders,
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const { headers: overrideHeaders, ...restFetchOptions } = fetchOptions;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      ...overrideHeaders,
    },
    body: JSON.stringify(body),
    ...restFetchOptions,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = payload.errors ?? payload;
    throw new Error(
      `Shopify Admin API responded with ${response.status} ${response.statusText}: ${JSON.stringify(reason)}`
    );
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  const draftOrderCreateResult = payload?.data?.draftOrderCreate;

  if (!draftOrderCreateResult) {
    throw new Error('Unexpected Shopify response: draftOrderCreate result missing.');
  }

  const userErrors = draftOrderCreateResult.userErrors ?? [];

  if (userErrors.length > 0) {
    const serializedErrors = userErrors
      .map((error) => `${error.message}${error.field ? ` (field: ${error.field.join('.')})` : ''}`)
      .join('; ');
    throw new Error(`Draft order creation failed: ${serializedErrors}`);
  }

  return draftOrderCreateResult.draftOrder;
}

/**
 * Convenience helper to build a minimal draft order input payload.
 *
 * @param {Array<Object>} lineItems - Draft order line items (variantId & quantity or custom product data).
 * @param {Object} [overrides] - Additional DraftOrderInput fields.
 * @returns {Object} DraftOrderInput object
 */
export function buildDraftOrderInput(lineItems, overrides = {}) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error('At least one line item is required to create a draft order.');
  }

  const sanitizedLineItems = lineItems.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Line item at index ${index} must be an object.`);
    }

    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw new Error(`Line item at index ${index} must include a quantity greater than 0.`);
    }

    if (!item.variantId && !item.title) {
      throw new Error(
        `Line item at index ${index} must include either a variantId (for catalog items) or a title (for custom items).`
      );
    }

    const {
      variantId,
      title,
      quantity,
      originalUnitPrice,
      customAttributes,
      appliedDiscount,
      taxable,
      requiresShipping,
    } = item;

    return {
      variantId,
      title,
      quantity,
      originalUnitPrice,
      customAttributes,
      appliedDiscount,
      taxable,
      requiresShipping,
    };
  });

  return {
    lineItems: sanitizedLineItems,
    ...overrides,
  };
}

export default {
  createDraftOrder,
  buildDraftOrderInput,
};

