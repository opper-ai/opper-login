# @opper/login

OAuth SDK for **Login with Opper** — let your app's users pay for AI inference through their own Opper account.

## Install

```bash
npm install @opper/login
```

## Web (Redirect Flow)

```js
import { OpperLogin } from '@opper/login'

const opper = new OpperLogin({
  clientId: 'opper_app_...',
  redirectUri: 'https://myapp.com/callback',
})

// Redirect to Opper for login
opper.authorize()

// On callback page, extract the code
const result = opper.parseCallback()
if (result) {
  // Exchange code for API key (do this server-side)
  const { apiKey, user } = await opper.exchangeCode(result.code, CLIENT_SECRET)
}
```

## CLI / Device Flow

```js
import { OpperLogin } from '@opper/login'

const opper = new OpperLogin({
  clientId: 'opper_app_...',
  redirectUri: '',
})

// Start device authorization
const device = await opper.startDeviceAuth(CLIENT_SECRET)
console.log(`Open ${device.verificationUri} and enter code: ${device.userCode}`)

// Poll until user approves
const { apiKey, user } = await opper.pollDeviceToken(device)
```

## React

```jsx
import { LoginWithOpperButton, ManageOpperAccount } from '@opper/login/react'
import '@opper/login/styles.css'

// Login button
<LoginWithOpperButton
  clientId="opper_app_..."
  redirectUri="https://myapp.com/callback"
/>

// Account management button
<ManageOpperAccount />
```

## Button Variants

Both buttons support `variant="gradient"` (default) and `variant="dark"`:

```jsx
<LoginWithOpperButton variant="dark" ... />
<ManageOpperAccount variant="dark" />
```

## Portal URL

Get the user portal URL for custom links:

```js
const opper = new OpperLogin({ clientId: '...', redirectUri: '...' })
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
