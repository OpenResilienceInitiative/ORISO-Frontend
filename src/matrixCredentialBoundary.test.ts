import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
	readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const productionSource = (): string =>
	readdirSync(resolve(process.cwd(), 'src'), {
		recursive: true,
		withFileTypes: true
	})
		.filter(
			(entry) =>
				entry.isFile() &&
				/\.(?:ts|tsx)$/.test(entry.name) &&
				!/\.(?:test|stories)\.(?:ts|tsx)$/.test(entry.name)
		)
		.map((entry) =>
			readFileSync(resolve(entry.parentPath, entry.name), 'utf8')
		)
		.join('\n');

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

	it('keeps generated UserService contracts Matrix-only', () => {
		expect(source('./generated/userservice.d.ts')).not.toMatch(
			/RocketChat|RCToken|RcId|RcGroup|askerRc|consultantRc|GetRocket/
		);
	});

	it('does not disclose chat credentials to the booking provider', () => {
		expect(
			source('./containers/bookings/components/Booking/booking.tsx')
		).not.toMatch(/rcToken|rcUserId|rc_uid|rc_token/);
	});

	it('has no credential-bearing Element Call SPA fallback', () => {
		expect(productionSource()).not.toMatch(
			/ORISO_CALL_|getElementCallAccessToken|matrix_call_device_id|oriso-call-(?:ended|action)|widgetModeEnabled/
		);
	});
});
