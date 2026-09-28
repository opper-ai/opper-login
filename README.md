# @opperai/login

OAuth SDK for **Login with Opper** — let your app's users pay for AI inference through their own Opper account.

Ships as a dual ESM / CommonJS package, so it works in both `import` and `require` projects (including Next.js server bundles compiled to `.cjs`).

## Install

```bash
npm install @opperai/login
```

## Web (Redirect Flow)

```js
import { OpperLogin } from '@opperai/login'

// On your server (keep clientSecret out of the browser bundle):
const opper = new OpperLogin({
  clientId: 'opper_app_...',
  clientSecret: process.env.OPPER_CLIENT_SECRET,
  redirectUri: 'https://myapp.com/callback',
})

// On the callback route:
const { apiKey, user } = await opper.exchangeCode(code)
```

> **Note:** `exchangeCode` posts to the token endpoint as
> `application/x-www-form-urlencoded` per [RFC 6749 §4.1.3](https://www.rfc-editor.org/rfc/rfc6749#section-4.1.3).
> Keep that in mind if you ever reimplement this call without the SDK —
> posting JSON will fail with 422.

In the browser, start the flow and parse the callback:

```js
const opper = new OpperLogin({
  clientId: 'opper_app_...',
  redirectUri: 'https://myapp.com/callback',
})

opper.authorize()

// On the callback page:
const result = opper.parseCallback()
if (result) {
  // POST result.code to your server, then call exchangeCode there.
}
```

To renew a credential through the authorization-code flow, pass renewal options
as the second argument to `authorize` (the first remains the optional OAuth
state). Popup clients pass the same options to `authorizePopup`:

```js
const renewal = {
  renew: true,
  currentCredentialId: savedCredential.credentialId, // omit if unknown
}

opper.authorize(undefined, renewal)
// Or: const replacement = await opper.authorizePopup(renewal)
```

The SDK adds `renew=true` and, when supplied, `current_credential_id` to the
`GET /oauth/authorize` query. The authorization server carries this intent
through browser approval and code exchange. Save the returned replacement key
and credential metadata together. Existing calls to `authorize(state)` and
`authorizePopup()` keep their previous request shape.

## CLI / Device Flow

```js
import { OpperLogin } from '@opperai/login'

const opper = new OpperLogin({ clientId: 'opper_app_...' })

const device = await opper.startDeviceAuth()

// Prefer verification_uri_complete (RFC 8628 §3.3.1) when the server returns
// it — the user code is pre-filled, so users only click Approve. Always
// show userCode too as a fallback (if the browser opens on another device).
const url = device.verificationUriComplete ?? device.verificationUri
console.log(`Open ${url}`)
console.log(`Code: ${device.userCode}`)

const { apiKey, user } = await opper.pollDeviceToken(device)
```

To renew an existing key, begin another device authorization flow and pass the
credential ID retained from the previous `AuthResult` when available:

```js
const device = await opper.startDeviceAuth({
  renew: true,
  currentCredentialId: savedCredential.credentialId, // omit if unknown
})
// Open device.verificationUriComplete ?? device.verificationUri, then:
const replacement = await opper.pollDeviceToken(device)
```

`startDeviceAuth()` sends only `client_id` as before. The options above add
`renew=true` and, when supplied, `current_credential_id` to the form POST at
`/oauth/device`. The Opper API decides whether it can revoke the previous key;
an unknown credential ID should leave that key active. Store the replacement
`apiKey` and any returned credential metadata together. The SDK does not store
or replace local credentials itself.

For confidential-client CLIs, pass `clientSecret` in the config and it will be sent automatically.

Both `pollDeviceToken()` and the server-side `exchangeCode()` return the same
`AuthResult`. Alongside `apiKey` and `user`, the result can contain
`credentialId`, `orgId`, `projectId`, `projectUuid`, `projectName`, and
`expiresAt` (an absolute ISO 8601 timestamp) when the Opper API supplies them.
These fields are optional for compatibility with existing responses. Clients
should retain them with the key so they can show the issuing organization,
project, and expiry; the server remains authoritative when a key is used. The
SDK handles the OAuth transport and does not store credentials on disk. Renewal
and organization expiry behavior require the corresponding Opper API support.

## React

```jsx
import { LoginWithOpperButton, ManageOpperAccount } from '@opperai/login/react'
import '@opperai/login/styles.css'

<LoginWithOpperButton
  clientId="opper_app_..."
  redirectUri="https://myapp.com/callback"
/>

<ManageOpperAccount />
```

The React login button also accepts `renew` and `currentCredentialId` for
either redirect or popup mode. Set its `children` to a suitable renewal label.

Both buttons support `variant="gradient"` (default) and `variant="dark"`:

```jsx
<LoginWithOpperButton variant="dark" ... />
<ManageOpperAccount variant="dark" />
```

## Portal URL

Returns the URL to the user's Opper Wallet — where they manage their
balance, auto-recharge, and connected apps.

```js
const opper = new OpperLogin({ clientId: '...' })
opper.getPortalUrl() // "https://platform.opper.ai/wallet"
```

## Using the API Key

After authentication, use the API key with any OpenAI-compatible client:

```js
const response = await fetch('https://api.opper.ai/v2/call', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'my-function',
    instructions: 'Answer the question.',
    input: 'What is 2+2?',
  }),
})
```

## API

### `new OpperLogin(config)`

| Field          | Type     | Required                  | Notes                                                                 |
| -------------- | -------- | ------------------------- | --------------------------------------------------------------------- |
| `clientId`     | `string` | yes                       | Your OAuth app client ID.                                             |
| `redirectUri`  | `string` | for web redirect / popup  | Must match the redirect registered on your OAuth app.                  |
| `clientSecret` | `string` | for `exchangeCode`        | **Server-side only.** Never expose in browser code.                    |
| `opperUrl`     | `string` | no                        | Defaults to `https://api.opper.ai`.                                    |
| `platformUrl`  | `string` | no                        | Defaults to `https://platform.opper.ai`.                               |
