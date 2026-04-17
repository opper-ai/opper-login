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

For confidential-client CLIs, pass `clientSecret` in the config and it will be sent automatically.

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

Both buttons support `variant="gradient"` (default) and `variant="dark"`:

```jsx
<LoginWithOpperButton variant="dark" ... />
<ManageOpperAccount variant="dark" />
```

## Portal URL

```js
const opper = new OpperLogin({ clientId: '...' })
opper.getPortalUrl() // "https://platform.opper.ai/user"
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
