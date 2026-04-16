const DEFAULT_PLATFORM_URL = "https://platform.opper.ai";

export interface OpperLoginConfig {
    clientId: string;
    redirectUri: string;
    opperUrl?: string;
    platformUrl?: string;
}

export interface AuthResult {
    apiKey: string;
    user: { email: string; name: string };
}

export class OpperLogin {
    private clientId: string;
    private redirectUri: string;
    private opperUrl: string;
    private platformUrl: string;

    constructor(config: OpperLoginConfig) {
        this.clientId = config.clientId;
        this.redirectUri = config.redirectUri;
        this.opperUrl = config.opperUrl ?? "https://api.opper.ai";
        this.platformUrl = config.platformUrl ?? DEFAULT_PLATFORM_URL;
    }

    /**
     * Get the URL to the user's Opper account portal.
     * Link to this so users can manage billing, connected apps, and settings.
     */
    getPortalUrl(): string {
        return `${this.platformUrl}/user`;
    }

    authorize(state?: string): void {
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
            const handler = (event: MessageEvent) => {
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

    async exchangeCode(code: string, clientSecret: string): Promise<AuthResult> {
        const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: this.clientId,
            client_secret: clientSecret,
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
    async startDeviceAuth(clientSecret: string): Promise<DeviceAuthResponse> {
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
            expiresIn: data.expires_in,
            interval: data.interval,
            clientSecret,
        };
    }

    /**
     * Poll for device authorization result. Resolves when the user approves or denies.
     */
    async pollDeviceToken(device: DeviceAuthResponse): Promise<AuthResult> {
        const interval = (device.interval ?? 5) * 1000;
        const deadline = Date.now() + (device.expiresIn ?? 600) * 1000;

        while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, interval));

            const body = new URLSearchParams({
                device_code: device.deviceCode,
                client_id: this.clientId,
                client_secret: device.clientSecret,
            });
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
            if (detail === "access_denied") {
                throw new Error("User denied access");
            }
            // expired_token or other error
            throw new Error(detail || "Device authorization failed");
        }

        throw new Error("Device authorization timed out");
    }

    private generateState(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    }
}

export interface DeviceAuthResponse {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
    clientSecret: string;
}
