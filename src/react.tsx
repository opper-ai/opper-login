import { useMemo, useCallback } from "react";
import { OpperLogin, OpperLoginConfig, AuthResult } from "./index.js";

interface LoginWithOpperButtonProps extends OpperLoginConfig {
    onSuccess?: (result: AuthResult) => void;
    onError?: (error: Error) => void;
    mode?: "redirect" | "popup";
    variant?: "gradient" | "dark";
    children?: React.ReactNode;
}

function OpperIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 250 250" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="opper-login-grad" x1="40.93%" y1="18.06%" x2="55.32%" y2="86.57%">
                    <stop stopColor="#8CECF2" offset="0%" />
                    <stop stopColor="#F9B58C" offset="100%" />
                </linearGradient>
            </defs>
            <path
                d="M159.78 250C71.53 250 0 194.16 0 125C0 -15.04 159.78 0.52 159.78 0.52C159.78 69.26 88.36 125 0.2 125C149.8 125.11 159.78 250 159.78 250ZM160.52 173.13C160.52 173.13 156.94 128.39 105.04 125.11C120.6 124.97 160.52 120.35 160.52 76.68C160.52 120.35 200.44 124.97 216 125.11C164.1 128.38 160.52 173.13 160.52 173.13Z"
                fill="url(#opper-login-grad)"
            />
        </svg>
    );
}

export function LoginWithOpperButton({
    clientId, redirectUri, opperUrl,
    onSuccess, onError, mode = "redirect", variant = "gradient", children,
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

    const className = variant === "dark"
        ? "opper-login-button opper-login-button--dark"
        : "opper-login-button";

    return (
        <button type="button" onClick={handleClick} className={className}>
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
    variant?: "gradient" | "dark";
    children?: React.ReactNode;
}

export function ManageOpperAccount({
    platformUrl,
    variant = "dark",
    children,
}: ManageOpperAccountProps) {
    const portalUrl = useMemo(
        () => new OpperLogin({ clientId: "", redirectUri: "", platformUrl }).getPortalUrl(),
        [platformUrl]
    );

    const className = variant === "dark"
        ? "opper-login-button opper-login-button--dark"
        : "opper-login-button";

    return (
        <a href={portalUrl} target="_blank" rel="noopener noreferrer" className={className}>
            {children ?? (
                <>
                    <OpperIcon />
                    <span>Manage Opper Account</span>
                </>
            )}
        </a>
    );
}
