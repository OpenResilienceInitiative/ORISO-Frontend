import { v4 as uuidv4 } from "uuid";
import { endpoints } from "../resources/scripts/endpoints";
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from "./fetchData";
import { ErrorInfo } from "react";
import StackTrace from "stacktrace-js";

export interface ErrorResponse {}

export const ERROR_LEVEL_FATAL = "FATAL";
export const ERROR_LEVEL_ERROR = "ERROR";
export const ERROR_LEVEL_WARN = "WARN";
export const ERROR_LEVEL_INFO = "INFO";
export const ERROR_LEVEL_DEBUG = "DEBUG";
export const ERROR_LEVEL_TRACE = "TRACE";

type TErrorHeaders = {
        "User-Agent"?: string;
        "Referer"?: string;
};

export type TError = Error & {
        level?:
                | typeof ERROR_LEVEL_FATAL
                | typeof ERROR_LEVEL_ERROR
                | typeof ERROR_LEVEL_WARN
                | typeof ERROR_LEVEL_INFO
                | typeof ERROR_LEVEL_DEBUG
                | typeof ERROR_LEVEL_TRACE;
        url?: string;
        headers?: TErrorHeaders;
        parsedStack?: string;
};

export type ErrorRequestBody = {
        request: {
                correlationId: string;
                timestamp: string;
        };
        serviceName: string;
        error: TError;
        info?: ErrorInfo;
};

export const apiPostError = async (
        error: TError,
        info?: ErrorInfo,
        correlationId?: string
): Promise<ErrorResponse> => {
        // For Matrix integration, we will just log errors to console instead of posting to logstash
        console.warn("Matrix Frontend Error:", {
                error: error.message,
                level: error.level || "ERROR",
                url: window?.location?.href,
                timestamp: new Date().toISOString(),
                correlationId: correlationId || uuidv4(),
                ...(info ? { info: info } : {})
        });
        
        // Return a mock response to avoid breaking the calling code
        return Promise.resolve({});
};
