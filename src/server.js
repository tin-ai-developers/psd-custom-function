import express from 'express';
import { createDraftOrder, buildDraftOrderInput } from './index.js';

const REQUIRED_ENV_VARS = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_API_TOKEN'];

function assertEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Set them before starting the service.`
    );
  }
}

function createApp() {
  assertEnvironment();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/draft-orders', async (req, res) => {
    try {
      const {
        input,
        lineItems,
        overrides,
        selection,
        idempotencyKey,
        apiVersion,
        storeDomain = process.env.SHOPIFY_STORE_DOMAIN,
        accessToken = process.env.SHOPIFY_ADMIN_API_TOKEN,
      } = req.body ?? {};

      if (!storeDomain || !accessToken) {
        throw new Error('Store domain and access token are required.');
      }

      const draftOrderInput =
        input ??
        (Array.isArray(lineItems) && lineItems.length > 0
          ? buildDraftOrderInput(lineItems, overrides)
          : null);

      if (!draftOrderInput) {
        throw new Error('Provide either a full `input` object or `lineItems` (with optional `overrides`).');
      }

      const draftOrder = await createDraftOrder({
        storeDomain,
        accessToken,
        input: draftOrderInput,
        selection,
        apiVersion,
        idempotencyKey,
      });

      res.status(201).json({ draftOrder });
    } catch (error) {
      res.status(400).json({
        error: error.message,
      });
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const app = createApp();
  app.listen(port, () => {
    console.log(`Draft order service listening on port ${port}`);
  });
}

export { createApp };

