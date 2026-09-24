import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { OpperLogin } from "../src/index.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const issued = {
    api_key: "op-test-secret",
    user: { email: "dev@example.com", name: "Developer" },
    credential_id: "cred-123",
    org_id: 42,
    expires_at: "2026-10-24T12:00:00Z",
};

test("code exchange returns the shared credential metadata", async () => {
    globalThis.fetch = async () => Response.json(issued);
    const login = new OpperLogin({
        clientId: "app-123",
        clientSecret: "secret",
        redirectUri: "https://example.com/callback",
    });

    const result = await login.exchangeCode("code-123");

    assert.deepEqual(result, {
        apiKey: issued.api_key,
        user: issued.user,
        credentialId: issued.credential_id,
        orgId: issued.org_id,
        expiresAt: issued.expires_at,
    });
});

test("device exchange returns the same metadata", async () => {
    globalThis.fetch = async () => Response.json(issued);
    const login = new OpperLogin({ clientId: "app-123" });

    const result = await login.pollDeviceToken({
        deviceCode: "device-123",
        userCode: "ABCD-EFGH",
        verificationUri: "https://platform.opper.ai/activate",
        expiresIn: 5,
        interval: 0,
    });

    assert.deepEqual(result, {
        apiKey: issued.api_key,
        user: issued.user,
        credentialId: issued.credential_id,
        orgId: issued.org_id,
        expiresAt: issued.expires_at,
    });
});

test("legacy responses preserve the existing result shape", async () => {
    globalThis.fetch = async () => Response.json({
        api_key: issued.api_key,
        user: issued.user,
    });
    const login = new OpperLogin({
        clientId: "app-123",
        clientSecret: "secret",
        redirectUri: "https://example.com/callback",
    });

    assert.deepEqual(await login.exchangeCode("code-123"), {
        apiKey: issued.api_key,
        user: issued.user,
    });
});
