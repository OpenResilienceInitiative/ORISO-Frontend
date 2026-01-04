import { createClient } from "matrix-js-sdk";

export interface MatrixRegistrationData {
    username: string;
    password: string;
    displayName?: string;
}

export interface MatrixRegistrationResult {
    success: boolean;
    userId?: string;
    accessToken?: string;
    deviceId?: string;
    error?: string;
}

export const registerMatrixUser = async (
    registrationData: MatrixRegistrationData
): Promise<MatrixRegistrationResult> => {
    try {
        console.log("🔧 Attempting Matrix registration for user:", registrationData.username);
        
        // Matrix server URL from environment variable
        const homeserverUrl = process.env.REACT_APP_MATRIX_HOMESERVER_URL || "http://91.99.219.182:8008";
        
        // Create Matrix client
        const client = createClient({
            baseUrl: homeserverUrl,
        });

        // Register user with proper type casting
        const response = await client.register(
            registrationData.username,
            registrationData.password,
            null, // auth
            {
                initial_device_display_name: "Caritas Frontend",
                ...(registrationData.displayName && { displayname: registrationData.displayName })
            } as any
        );

        console.log("✅ Matrix registration successful:", response);
        
        return {
            success: true,
            userId: response.user_id,
            accessToken: response.access_token,
            deviceId: response.device_id,
        };
        
    } catch (error: any) {
        console.error("❌ Matrix registration failed:", error);
        
        // If user already exists, try to login instead
        if (error.errcode === "M_USER_IN_USE") {
            console.log("🔄 User exists, attempting login instead...");
            try {
                const loginResult = await loginMatrixUser(registrationData.username, registrationData.password);
                return loginResult;
            } catch (loginError: any) {
                return {
                    success: false,
                    error: `User exists but login failed: ${loginError.message || "Unknown error"}`,
                };
            }
        }
        
        return {
            success: false,
            error: error.message || "Registration failed",
        };
    }
};

export const loginMatrixUser = async (
    username: string,
    password: string
): Promise<MatrixRegistrationResult> => {
    try {
        console.log("🔧 Attempting Matrix login for user:", username);
        
        // Matrix server URL from environment variable
        const homeserverUrl = process.env.REACT_APP_MATRIX_HOMESERVER_URL || "http://91.99.219.182:8008";
        
        // Create Matrix client
        const client = createClient({
            baseUrl: homeserverUrl,
        });

        // Login user
        const response = await client.login("m.login.password", {
            user: username,
            password: password,
        });

        console.log("✅ Matrix login successful:", response);
        
        return {
            success: true,
            userId: response.user_id,
            accessToken: response.access_token,
            deviceId: response.device_id,
        };
        
    } catch (error: any) {
        console.error("❌ Matrix login failed:", error);
        
        return {
            success: false,
            error: error.message || "Login failed",
        };
    }
};
