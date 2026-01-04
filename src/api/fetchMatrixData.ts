import { getValueFromCookie } from "../components/sessionCookie/accessSessionCookie";

export const fetchMatrixData = (
        url: string,
        method: string,
        bodyData: string = null,
        ignoreErrors: boolean = false
): Promise<any> => {
        const matrixToken = getValueFromCookie("matrix_token");
        const matrixUid = getValueFromCookie("matrix_uid");

        const headers: Record<string, string> = {
                "Content-Type": "application/json",
        };

        if (matrixToken) {
                headers["Authorization"] = `Bearer ${matrixToken}`;
        }

        const req = new Request(url, {
                method: method,
                headers: headers,
                credentials: "include",
                body: bodyData,
        });

        return fetch(req)
                .then((response) => {
                        if (response.status === 200) {
                                return response.json();
                        } else if (response.status === 401) {
                                if (!ignoreErrors) {
                                        console.warn("Matrix authentication failed");
                                }
                                return { error: "Authentication failed" };
                        } else {
                                if (!ignoreErrors) {
                                        console.warn(`Matrix API call failed: ${response.status}`);
                                }
                                return { error: `API call failed: ${response.status}` };
                        }
                })
                .catch((error) => {
                        if (!ignoreErrors) {
                                console.error("Matrix API call error:", error);
                        }
                        return { error: error.message };
                });
};
