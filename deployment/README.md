# Production deployment checklist

The API is designed to run as a small Node.js 22+ service. No hosting provider is configured in this repository because access to the Beta Calendars production account and DNS zone has not been established.

1. Build and run `npm test`, `npm run typecheck`, `npm run openapi:check`, and `npm run postman:check` in CI.
2. Deploy the Node process behind a managed HTTPS edge. Set `PORT` if required by the platform. The app binds to `0.0.0.0` and requires no runtime secret.
3. Configure `api.betacalendars.com` to the host using the provider's exact DNS target and enable TLS.
4. Apply host-level rate limiting; a conservative starting point is 120 requests per minute per source IP. Avoid application logs containing query details.
5. Verify `/health`, every route in `openapi.yaml`, CORS preflight, and the public OpenAPI file from an external client.
6. Run the Postman collections against the production base URL and save response examples from those successful live responses before publication.

Do not point public Postman content to localhost, preview, or temporary tunnel hosts. No deployment has been performed by this source package.
