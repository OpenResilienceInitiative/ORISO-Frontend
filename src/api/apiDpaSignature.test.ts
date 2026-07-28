import { describe, expect, it, vi } from 'vitest';
import {
	apiConfirmDpaSignature,
	apiGetDpaSignPreview,
	DPA_SIGN_ERRORS
} from './apiDpaSignature';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		dpaSignatureConfirm: (token: string) =>
			`https://api.oriso-dev.site/service/tenant/public/dpa/confirm/${encodeURIComponent(token)}`,
		dpaSignaturePreview: (token: string) =>
			`https://api.oriso-dev.site/service/tenant/public/dpa/confirm/${encodeURIComponent(token)}`
	}
}));

describe('apiGetDpaSignPreview', () => {
	it('loads the exact contract preview before the signer can confirm', async () => {
		const preview = {
			tenantName: 'Träger Nord',
			dpaVersion: '2026-07-20T12:30:00',
			content: '{"de":"<p>Vertragstext</p>"}',
			expiresAt: '2026-08-03T12:30:00'
		};
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(preview), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(apiGetDpaSignPreview('signed token')).resolves.toEqual(
			preview
		);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.oriso-dev.site/service/tenant/public/dpa/confirm/signed%20token',
			{
				method: 'GET',
				headers: { Accept: 'application/json' },
				credentials: 'include'
			}
		);
	});
});

describe('apiConfirmDpaSignature', () => {
	it('posts the public DPA signature payload to the token endpoint', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ status: 'SIGNED' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			apiConfirmDpaSignature('signed token', {
				signerName: 'Frank Gerhardt',
				signerPosition: 'Owner',
				signerEmail: 'frank@example.com',
				signerOrganisation: 'ORISO',
				language: 'de',
				accepted: true,
				signerIsMember: false,
				source: 'PUBLIC_SIGN_LINK'
			})
		).resolves.toEqual({ status: 'SIGNED' });

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.oriso-dev.site/service/tenant/public/dpa/confirm/signed%20token',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					signerName: 'Frank Gerhardt',
					signerPosition: 'Owner',
					signerEmail: 'frank@example.com',
					signerOrganisation: 'ORISO',
					language: 'de',
					accepted: true,
					signerIsMember: false,
					source: 'PUBLIC_SIGN_LINK'
				})
			}
		);
	});

	it('maps expired public sign tokens to a stable error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(null, { status: 410 }))
		);

		await expect(
			apiConfirmDpaSignature('expired', {
				signerName: 'Frank Gerhardt',
				signerPosition: 'Owner',
				signerEmail: 'frank@example.com',
				signerOrganisation: 'ORISO',
				language: 'de',
				accepted: true
			})
		).rejects.toThrow(DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN);
	});
});
