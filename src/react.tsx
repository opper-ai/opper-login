import { useMemo, useCallback } from "react";
import { OpperLogin, OpperLoginConfig, AuthResult } from "./index.js";

// Exclude clientSecret from browser-side props — it should never touch frontend code.
interface LoginWithOpperButtonProps extends Omit<OpperLoginConfig, "clientSecret"> {
    onSuccess?: (result: AuthResult) => void;
    onError?: (error: Error) => void;
    mode?: "redirect" | "popup";
    /**
     * Visual style. Defaults to "default" — the Opper brand dark-blue
     * button modelled on "Continue with Google". Pass "gradient" for the
     * original light Opper gradient, or "dark" (kept as an alias of
     * default for backward compat).
     */
    variant?: "default" | "gradient" | "dark";
    children?: React.ReactNode;
}

function OpperIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 250 250" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M159.78 250C71.53 250 0 194.16 0 125C0 -15.04 159.78 0.52 159.78 0.52C159.78 69.26 88.36 125 0.2 125C149.8 125.11 159.78 250 159.78 250ZM160.52 173.13C160.52 173.13 156.94 128.39 105.04 125.11C120.6 124.97 160.52 120.35 160.52 76.68C160.52 120.35 200.44 124.97 216 125.11C164.1 128.38 160.52 173.13 160.52 173.13Z"
                fill="#fff"
            />
        </svg>
    );
}

export function LoginWithOpperButton({
    clientId, redirectUri, opperUrl,
    onSuccess, onError, mode = "redirect", variant = "default", children,
}: LoginWithOpperButtonProps) {
    const handleClick = useCallback(async () => {
        const opper = new OpperLogin({ clientId, redirectUri, opperUrl });
        if (mode === "popup") {
            try {
                const result = await opper.authorizePopup();
                onSuccess?.(result);
            } catch (err) {
                onError?.(err as Error);
            }
        } else {
            opper.authorize();
        }
    }, [clientId, redirectUri, opperUrl, mode, onSuccess, onError]);

    return (
        <button
            type="button"
            onClick={handleClick}
            className={opperButtonClass(variant)}
            aria-label="Login with Opper"
        >
            {children ?? (
                <>
                    <OpperIcon />
                    <span>Login with Opper</span>
                </>
            )}
        </button>
    );
}

interface ManageOpperAccountProps {
    platformUrl?: string;
    /**
     * Visual style. Defaults to "default" — the Opper brand dark-blue
     * button. Pass "gradient" for the original light Opper gradient, or
     * "dark" (kept as an alias of default for backward compat).
     */
    variant?: "default" | "gradient" | "dark";
    children?: React.ReactNode;
}

export function ManageOpperAccount({
    platformUrl,
    variant = "default",
    children,
}: ManageOpperAccountProps) {
    const portalUrl = useMemo(
        () => new OpperLogin({ clientId: "", redirectUri: "", platformUrl }).getPortalUrl(),
        [platformUrl]
    );

    return (
        <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={opperButtonClass(variant)}
            aria-label="Manage Opper Wallet"
        >
            {children ?? (
                <>
                    <OpperIcon />
                    <span>Manage Opper Wallet</span>
                </>
            )}
        </a>
    );
}

function opperButtonClass(variant: "default" | "gradient" | "dark"): string {
    if (variant === "gradient") {
        return "opper-login-button opper-login-button--gradient";
    }
    // "default" and "dark" both resolve to the new brand navy button.
    return "opper-login-button";
}
