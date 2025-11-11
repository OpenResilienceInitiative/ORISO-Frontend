import * as React from "react";
import { createContext, useCallback, useEffect, useState } from "react";
import {
        apiRocketChatSettingsPublic,
        IBooleanSetting,
        INumberSetting,
        SETTING_E2E_ENABLE,
        SETTING_FILEUPLOAD_MAXFILESIZE,
        SETTING_HIDE_SYSTEM_MESSAGES,
        SETTING_MESSAGE_ALLOWDELETING,
        SETTING_MESSAGE_MAXALLOWEDSIZE,
        SETTING_MESSAGE_SHOWDELETEDSTATUS,
        TSetting
} from "../../api/apiRocketChatSettingsPublic";

const SETTINGS_TO_FETCH = [
        SETTING_E2E_ENABLE,
        SETTING_MESSAGE_MAXALLOWEDSIZE,
        SETTING_FILEUPLOAD_MAXFILESIZE,
        SETTING_MESSAGE_ALLOWDELETING,
        SETTING_MESSAGE_SHOWDELETEDSTATUS,
        SETTING_HIDE_SYSTEM_MESSAGES
];

type RocketChatGlobalSettingsContextProps = {
        settings: TSetting[];
        getSetting: <T extends TSetting>(id: T["_id"]) => T | null;
};

export const RocketChatGlobalSettingsContext =
        createContext<RocketChatGlobalSettingsContextProps>(null);

export const RocketChatGlobalSettingsProvider = (props) => {
        const [settings, setSettings] = useState<TSetting[]>([]);

        useEffect(() => {
                apiRocketChatSettingsPublic(SETTINGS_TO_FETCH).then((res) =>
                        setSettings(res.settings)
                );
        }, []);

        const getSetting = useCallback(
                <T extends TSetting>(id: T["_id"]): T | null => {
                        return (settings.find((s) => s._id === id) as T) ?? null;
                },
                [settings]
        );

        // All Rocket.Chat validations disabled for Matrix integration
        // No more validation errors will be shown

        return (
                <RocketChatGlobalSettingsContext.Provider
                        value={{ settings, getSetting }}
                >
                        {props.children}
                </RocketChatGlobalSettingsContext.Provider>
        );
};
