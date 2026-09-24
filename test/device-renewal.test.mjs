import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { OpperLogin } from "../src/index.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const deviceResponse = {
    device_code: "device-123",
    user_code: "ABCD-EFGH",
    verification_uri: "https://platform.opper.ai/activate",
    expires_in: 600,
    interval: 5,
};

test("device authorization keeps the existing form body by default", async () => {
    let request;
    globalThis.fetch = async (url, init) => {
        request = { url, init };
        return Response.json(deviceResponse);
    };

    const response = await new OpperLogin({ clientId: "app-123" }).startDeviceAuth();

    assert.equal(request.url, "https://api.opper.ai/oauth/device");
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.deepEqual([...request.init.body], [["client_id", "app-123"]]);
    assert.equal(response.deviceCode, "device-123");
});

test("renewal intent and current credential ID use device authorization form fields", async () => {
    let body;
    globalThis.fetch = async (_url, init) => {
        body = init.body;
        return Response.json(deviceResponse);
    };

    await new OpperLogin({ clientId: "app-123" }).startDeviceAuth({
        renew: true,
        currentCredentialId: "12345",
    });

    assert.deepEqual([...body], [
        ["client_id", "app-123"],
        ["renew", "true"],
        ["current_credential_id", "12345"],
    ]);
});

test("renewal without a known credential ID does not request revocation", async () => {
    let body;
    globalThis.fetch = async (_url, init) => {
        body = init.body;
        return Response.json(deviceResponse);
    };

    await new OpperLogin({ clientId: "app-123" }).startDeviceAuth({ renew: true });

    assert.deepEqual([...body], [["client_id", "app-123"], ["renew", "true"]]);
});
