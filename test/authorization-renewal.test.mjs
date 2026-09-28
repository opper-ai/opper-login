import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { OpperLogin } from "../src/index.ts";

const originalWindow = globalThis.window;
const originalStorage = globalThis.sessionStorage;

afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalStorage;
});

function login() {
    return new OpperLogin({
        clientId: "app-123",
        redirectUri: "https://example.com/callback",
    });
}

test("redirect authorization preserves the existing URL and state by default", () => {
    const saved = new Map();
    globalThis.sessionStorage = { setItem: (key, value) => saved.set(key, value) };
    globalThis.window = { location: { href: "" } };

    login().authorize("existing-state");

    const url = new URL(globalThis.window.location.href);
    assert.equal(url.pathname, "/oauth/authorize");
    assert.deepEqual([...url.searchParams], [
        ["client_id", "app-123"],
        ["redirect_uri", "https://example.com/callback"],
        ["response_type", "code"],
        ["state", "existing-state"],
    ]);
    assert.equal(saved.get("opper_oauth_state"), "existing-state");
});

test("redirect authorization sends renewal intent and known credential ID", () => {
    const saved = new Map();
    globalThis.sessionStorage = { setItem: (key, value) => saved.set(key, value) };
    globalThis.window = { location: { href: "" } };

    login().authorize("renewal-state", { renew: true, currentCredentialId: "12345" });

    const url = new URL(globalThis.window.location.href);
    assert.equal(url.searchParams.get("state"), "renewal-state");
    assert.equal(url.searchParams.get("renew"), "true");
    assert.equal(url.searchParams.get("current_credential_id"), "12345");
    assert.equal(saved.get("opper_oauth_state"), "renewal-state");
});

test("redirect renewal with unknown credential ID omits revocation target", () => {
    globalThis.sessionStorage = { setItem() {} };
    globalThis.window = { location: { href: "" } };

    login().authorize(undefined, { renew: true });

    const url = new URL(globalThis.window.location.href);
    assert.equal(url.searchParams.get("renew"), "true");
    assert.equal(url.searchParams.has("current_credential_id"), false);
    assert.ok(url.searchParams.get("state"));
});

test("popup authorization sends renewal details while preserving the default URL", () => {
    const urls = [];
    const popup = {};
    const listeners = new Set();
    globalThis.window = {
        open: (url) => { urls.push(new URL(url)); return popup; },
        addEventListener: (_name, handler) => listeners.add(handler),
        removeEventListener: (_name, handler) => listeners.delete(handler),
    };

    const normal = login().authorizePopup();
    const renewal = login().authorizePopup({ renew: true, currentCredentialId: "12345" });
    const unknown = login().authorizePopup({ renew: true });

    assert.equal(urls[0].searchParams.has("renew"), false);
    assert.equal(urls[0].searchParams.has("current_credential_id"), false);
    assert.equal(urls[1].searchParams.get("renew"), "true");
    assert.equal(urls[1].searchParams.get("current_credential_id"), "12345");
    assert.ok(urls[1].searchParams.get("state"));
    assert.equal(urls[2].searchParams.get("renew"), "true");
    assert.equal(urls[2].searchParams.has("current_credential_id"), false);

    // Neither promise needs a real popup; settle both to avoid dangling work.
    for (const handler of [...listeners]) {
        handler({ origin: "https://api.opper.ai", source: popup, data: { type: "opper_auth_result", result: {} } });
    }
    return Promise.all([normal, renewal, unknown]);
});
