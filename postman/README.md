# Postman assets

Run `node scripts/generate-postman.mjs` to regenerate the two v2.1 collections and the no-secret public environment. The shared `baseUrl` points to the intended production host; that hostname is not yet deployed. Never publish saved response examples until they have been captured from the verified production endpoint.

The collections contain GET requests and Postman tests. The reference collection keeps the twelve 2027 month fixtures in one folder, with each fixture linked only to its corresponding canonical month page.
