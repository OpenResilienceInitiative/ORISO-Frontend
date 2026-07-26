import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
	readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Matrix credential boundary', () => {
	it('does not mirror Matrix credentials into Rocket.Chat cookies', () => {
		expect(
			source('./components/sessionCookie/getMatrixAccessToken.ts')
		).not.toMatch(/rc_uid|rc_token/);
	});

	it('does not send retired Rocket.Chat identity headers', () => {
		expect(source('./api/fetchData.ts')).not.toMatch(
			/RCToken|RCUserId|sendChatUserHeaders|rc_uid|rc_token/
		);
	});

	it('does not disclose chat credentials to the booking provider', () => {
		expect(
			source('./containers/bookings/components/Booking/booking.tsx')
		).not.toMatch(/rcToken|rcUserId|rc_uid|rc_token/);
	});

	it('has no credential-bearing Element Call SPA fallback', () => {
		expect(source('./components/call/GroupCallWidget.tsx')).not.toMatch(
			/getElementCallAccessToken|accessToken|oriso-call-(?:ended|action)|widgetModeEnabled/
		);
		expect(
			source('./components/sessionCookie/getMatrixAccessToken.ts')
		).not.toMatch(
			/ORISO_CALL|getElementCallAccessToken|matrix_call_device_id/
		);
	});
});
