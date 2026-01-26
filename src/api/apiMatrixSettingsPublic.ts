import { fetchMatrixData } from "./fetchMatrixData";
// Import types from the original Rocket.Chat file to avoid conflicts
import type { TSetting, TRocketChatSettingsPublicResponse } from "./apiRocketChatSettingsPublic";

export const SETTING_E2E_ENABLE = "E2E_Enable";
export const SETTING_MESSAGE_MAXALLOWEDSIZE = "Message_MaxAllowedSize";
export const SETTING_FILEUPLOAD_MAXFILESIZE = "FileUpload_MaxFileSize";
export const SETTING_MESSAGE_ALLOWDELETING = "Message_AllowDeleting";
export const SETTING_HIDE_SYSTEM_MESSAGES = "Hide_System_Messages";
export const SETTING_MESSAGE_SHOWDELETEDSTATUS = "Message_ShowDeletedStatus";

export const apiMatrixSettingsPublic = async (): Promise<TRocketChatSettingsPublicResponse> => {
        console.log("🔧 Fetching Matrix settings (using defaults)");
        
        const settings: TSetting[] = [
                { _id: "E2E_Enable", enterprise: false, value: true },
                { _id: "Message_MaxAllowedSize", enterprise: false, value: 10000 },
                { _id: "FileUpload_MaxFileSize", enterprise: false, value: 50000000 },
                { _id: "Message_AllowDeleting", enterprise: false, value: true },
                { _id: "Message_ShowDeletedStatus", enterprise: false, value: true },
                { _id: "Hide_System_Messages", enterprise: false, value: false }
        ] as TSetting[];
        
        console.log("✅ Matrix settings loaded (defaults)");
        
        return {
                count: settings.length,
                offset: 0,
                total: settings.length,
                success: true,
                settings: settings
        };
};

// For backward compatibility, also export as Rocket.Chat function name
export const apiRocketChatSettingsPublic = apiMatrixSettingsPublic;
