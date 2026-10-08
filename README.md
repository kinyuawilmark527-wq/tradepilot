# Deriv Trading Dashboard

This is a starter web dashboard using Deriv's current public WebSocket market-data endpoint.

## What is included
- Live public quotes for Volatility 10/25/50/75/100
- Live line chart
- Market selector
- Trade ticket UI
- Mobile responsive layout

## To make it a REAL authenticated trading app
Register an OAuth 2.0 application with Deriv and configure an HTTPS callback.
Use OAuth 2.0 + PKCE. The authorization-code exchange must happen on a backend, not in browser JavaScript.
Then use the authenticated Deriv WebSocket for the user's account and implement proposal/buy/sell operations.

Official docs:
https://developers.deriv.com/docs/intro/authentication/
https://developers.deriv.com/docs/intro/oauth/
https://developers.deriv.com/docs/intro/api-overview/

IMPORTANT: Never put a Deriv password, client secret, PAT, or long-lived trading token directly into index.html.
