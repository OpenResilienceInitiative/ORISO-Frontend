import { endpoints } from '../resources/scripts/endpoints';

export const DPA_SIGN_ERRORS = {
	INVALID_OR_EXPIRED_TOKEN: 'DPA_SIGN_INVALID_OR_EXPIRED_TOKEN',
	INVALID_REQUEST: 'DPA_SIGN_INVALID_REQUEST',
	FAILED: 'DPA_SIGN_FAILED'
} as const;

export interface DpaSignatureRequest {
	signerName: string;
	signerPosition: string;
	signerEmail: string;
	signerOrganisation: string;
	language: string;
	accepted: boolean;
	signerIsMember?: boolean;
	forwardedByUserId?: string;
	source?: string;
}

export interface DpaSignatureResponse {
	tenantId?: number;
	versionId?: number;
	status?: string;
	signerName?: string;
	signerPosition?: string;
	signerEmail?: string;
	signerOrganisation?: string;
	forwardedByUserId?: string;
	source?: string;
	signedAt?: string;
}

export interface DpaSignPreviewResponse {
	tenantName: string;
	dpaVersion: string;
	content: string;
	expiresAt: string;
}

export const apiGetDpaSignPreview = async (
	token: string
): Promise<DpaSignPreviewResponse> => {
	const response = await fetch(endpoints.dpaSignaturePreview(token), {
		method: 'GET',
		headers: { Accept: 'application/json' },
		credentials: 'include'
	});

	if (!response.ok) {
		if (response.status === 404 || response.status === 410) {
			throw new Error(DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN);
		}

		throw new Error(DPA_SIGN_ERRORS.FAILED);
	}

	return response.json();
};

export const apiConfirmDpaSignature = async (
	token: string,
	request: DpaSignatureRequest
): Promise<DpaSignatureResponse> => {
	const response = await fetch(endpoints.dpaSignatureConfirm(token), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(request)
	});

	if (!response.ok) {
		if (response.status === 404 || response.status === 410) {
			throw new Error(DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN);
		}

		if (response.status === 400) {
			throw new Error(DPA_SIGN_ERRORS.INVALID_REQUEST);
		}

		throw new Error(DPA_SIGN_ERRORS.FAILED);
	}

	const contentType = response.headers.get('content-type');

	return contentType?.includes('application/json') ? response.json() : {};
};
