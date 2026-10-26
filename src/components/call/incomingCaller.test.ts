import { describe, expect, it } from 'vitest';
import type { ListItemInterface } from '../../globalState/interfaces';
import { incomingCallerOf } from './incomingCaller';

const conversation = {
	session: {
		id: 344,
		matrixRoomId: '!chat:example',
		askerMatrixUserId: '@dragonfly_kendall_4108:example',
		consultantMatrixUserId: '@bart_getme_2fa:example'
	},
	consultant: {
		consultantId: 'c-1',
		username: 'bart_getme_2fa',
		displayName: 'Bart Simpson',
		firstName: 'Bartholomew',
		lastName: 'Legal',
		absent: false,
		absenceMessage: ''
	},
	user: { username: 'dragonfly_kendall_4108', sessionData: {} }
} as unknown as ListItemInterface;

// #780: the incoming-call popup said "G" and "Someone is calling…".
describe('incomingCallerOf', () => {
	it('names a calling counsellor by the public display name, never the login or the legal name', () => {
		const caller = incomingCallerOf(
			conversation,
			'@bart_getme_2fa:example'
		);

		expect(caller?.name).toBe('Bart Simpson');
		expect(caller?.avatar).toMatchObject({
			userId: '@bart_getme_2fa:example',
			avatarDisplayName: 'Bart Simpson',
			choice: { kind: 'initials' }
		});
	});

	it('names a calling advice seeker by the User-ID the chat header shows', () => {
		const caller = incomingCallerOf(
			conversation,
			'@dragonfly_kendall_4108:example'
		);

		expect(caller?.name).toBe('dragonfly_kendall_4108');
		expect(caller?.avatar.userId).toBe('@dragonfly_kendall_4108:example');
	});

	it('names nobody who is not a party of the conversation', () => {
		expect(incomingCallerOf(conversation, '@colleague:example')).toBeNull();
		expect(incomingCallerOf(conversation, undefined)).toBeNull();
		expect(
			incomingCallerOf(undefined, '@bart_getme_2fa:example')
		).toBeNull();
	});
});
