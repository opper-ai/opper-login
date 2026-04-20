const DEFAULT_PLATFORM_URL = "https://platform.opper.ai";
const DEFAULT_OPPER_URL = "https://api.opper.ai";

export interface OpperLoginConfig {
    clientId: string;
    /**
     * Required for the web redirect/popup flow. Not needed for the device flow.
     */
    redirectUri?: string;
    /**
     * Server-side secret. Required for `exchangeCode`. For the device flow it is
     * only needed if your OAuth app is registered as a confidential client.
     * Never expose this in browser code.
     */
    clientSecret?: string;
    opperUrl?: string;
    platformUrl?: string;
}

export interface AuthResult {
    apiKey: string;
    user: { email: string; name: string };
}

export interface DeviceAuthResponse {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    /**
     * The verification URI with the user code pre-filled. If the authorization
     * server returns this (RFC 8628 §3.3.1), CLIs should prefer opening it so
     * the user only has to click Approve. Falls back to `verificationUri` when
     * unset — callers should still display `userCode` for manual entry.
     */
    verificationUriComplete?: string;
    expiresIn: number;
    interval: number;
}

export class OpperLogin {
    private clientId: string;
    private redirectUri: string;
    private clientSecret?: string;
    private opperUrl: string;
    private platformUrl: string;

    constructor(config: OpperLoginConfig) {
        this.clientId = config.clientId;
        this.redirectUri = config.redirectUri ?? "";
        this.clientSecret = config.clientSecret;
        this.opperUrl = config.opperUrl ?? DEFAULT_OPPER_URL;
        this.platformUrl = config.platformUrl ?? DEFAULT_PLATFORM_URL;
    }

    /**
     * Get the URL to the user's Opper Wallet.
     * Link to this so users can manage balance, connected apps, and
     * auto-recharge settings. The old `/user` path still redirects here
     * for backward compatibility.
     */
    getPortalUrl(): string {
        return `${this.platformUrl}/wallet`;
    }

    authorize(state?: string): void {
        this.requireRedirectUri("authorize");
        const actualState = state ?? this.generateState();
        sessionStorage.setItem("opper_oauth_state", actualState);
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: "code",
            state: actualState,
        });
        window.location.href = `${this.opperUrl}/oauth/authorize?${params}`;
    }

    authorizePopup(): Promise<AuthResult> {
        return new Promise((resolve, reject) => {
            this.requireRedirectUri("authorizePopup");
            const state = this.generateState();
            const params = new URLSearchParams({
                client_id: this.clientId,
                redirect_uri: this.redirectUri,
                response_type: "code",
                state,
            });
            const popup = window.open(
                `${this.opperUrl}/oauth/authorize?${params}`,
                "opper_login",
                "width=500,height=700,scrollbars=yes"
            );
            if (!popup) {
                reject(new Error("Failed to open popup"));
                return;
            }
            const expectedOrigin = new URL(this.opperUrl).origin;
            const handler = (event: MessageEvent) => {
                if (event.origin !== expectedOrigin) return;
                if (event.source !== popup) return;
                if (event.data?.type === "opper_auth_result") {
                    window.removeEventListener("message", handler);
                    if (event.data.error) {
                        reject(new Error(event.data.error));
                    } else {
                        resolve(event.data.result as AuthResult);
                    }
                }
            };
            window.addEventListener("message", handler);
        });
    }

    parseCallback(): { code: string; state: string } | null {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        if (!code || !state) return null;
        const savedState = sessionStorage.getItem("opper_oauth_state");
        if (savedState && savedState !== state) {
            throw new Error("State mismatch — possible CSRF attack");
        }
        sessionStorage.removeItem("opper_oauth_state");
        return { code, state };
    }

    /**
     * Exchange an authorization code for an API key. Server-side only.
     *
     * Requires `clientSecret` to be set on the config. Sends the token request
     * as `application/x-www-form-urlencoded` per RFC 6749 §4.1.3.
     */
    async exchangeCode(code: string): Promise<AuthResult> {
        if (!this.clientSecret) {
            throw new Error(
                "exchangeCode requires `clientSecret` in the OpperLogin config. Never expose this in browser code."
            );
        }
        this.requireRedirectUri("exchangeCode");
        const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri,
        });
        const res = await fetch(`${this.opperUrl}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? "Token exchange failed");
        }
        const data = await res.json();
        return { apiKey: data.api_key, user: data.user };
    }

    /**
     * Start the device authorization flow (for CLIs and environments without a browser).
     * Returns the user code and verification URL. The CLI should display these,
     * then call pollDeviceToken() to wait for the user to approve.
     */
    async startDeviceAuth(): Promise<DeviceAuthResponse> {
        const body = new URLSearchParams({ client_id: this.clientId });
        const res = await fetch(`${this.opperUrl}/oauth/device`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? "Device authorization failed");
        }
        const data = await res.json();
        return {
            deviceCode: data.device_code,
            userCode: data.user_code,
            verificationUri: data.verification_uri,
            verificationUriComplete: data.verification_uri_complete,
            expiresIn: data.expires_in,
            interval: data.interval,
        };
    }

    /**
     * Poll for device authorization result. Resolves when the user approves or denies.
     */
    async pollDeviceToken(device: DeviceAuthResponse): Promise<AuthResult> {
        let interval = (device.interval ?? 5) * 1000;
        const deadline = Date.now() + (device.expiresIn ?? 600) * 1000;

        while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, interval));

            const body = new URLSearchParams({
                device_code: device.deviceCode,
                client_id: this.clientId,
            });
            if (this.clientSecret) {
                body.set("client_secret", this.clientSecret);
            }
            const res = await fetch(`${this.opperUrl}/oauth/device/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            });

            if (res.ok) {
                const data = await res.json();
                return { apiKey: data.api_key, user: data.user };
            }

            const err = await res.json().catch(() => ({}));
            const detail = err.detail ?? err.errors?.[0]?.detail ?? "";

            if (detail === "authorization_pending") {
                continue;
            }
            if (detail === "slow_down") {
                // RFC 8628 §3.5: back off by at least 5 s and keep polling.
                interval += 5000;
                continue;
            }
            if (detail === "access_denied") {
                throw new Error("User denied access");
            }
            throw new Error(detail || "Device authorization failed");
        }

        throw new Error("Device authorization timed out");
    }

    private requireRedirectUri(method: string): void {
        if (!this.redirectUri) {
            throw new Error(`${method} requires \`redirectUri\` in the OpperLogin config.`);
        }
    }

    private generateState(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    }
}
