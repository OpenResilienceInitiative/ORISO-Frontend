import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { isPracticeId } from './practiceIds';
import {
	PRACTICE_ACCEPTED_ROOM_ID,
	PRACTICE_ACCEPTED_SESSION_ID,
	PRACTICE_ENQUIRIES_ROUTE,
	PRACTICE_ENQUIRY_ROOM_ID,
	PRACTICE_ENQUIRY_SESSION_ID,
	practiceAcceptedSessionRoute,
	practiceEnquirySessionRoute
} from './practiceRoutes';

describe('practice ids', () => {
	it('can never be a real id', () => {
		[
			PRACTICE_ENQUIRY_SESSION_ID,
			PRACTICE_ACCEPTED_SESSION_ID,
			PRACTICE_ENQUIRY_ROOM_ID,
			PRACTICE_ACCEPTED_ROOM_ID
		].forEach((id) => expect(isPracticeId(id)).toBe(true));
	});

	it('uses the agreed values, one pair per start state', () => {
		expect(PRACTICE_ENQUIRY_SESSION_ID).toBe(-1);
		expect(PRACTICE_ACCEPTED_SESSION_ID).toBe(-2);
		expect(PRACTICE_ENQUIRY_ROOM_ID).toBe('!practice-1:practice.invalid');
		expect(PRACTICE_ACCEPTED_ROOM_ID).toBe('!practice-2:practice.invalid');
	});
});

describe('practice routes', () => {
	it('lists the enquiries on the real consultant enquiries route', () => {
		expect(PRACTICE_ENQUIRIES_ROUTE).toBe(
			'/sessions/consultant/sessionPreview'
		);
	});

	it('opens the practice enquiry on the route its list card navigates to', () => {
		// A card whose room id is a Matrix id navigates to `/session/:id`
		// (getSessionNavigationPath), not to the room-id route.
		const route = practiceEnquirySessionRoute();
		expect(route).toBe('/sessions/consultant/sessionPreview/session/-1');
		expect(
			matchPath(
				'/sessions/consultant/sessionPreview/session/:sessionId',
				route
			)?.params.sessionId
		).toBe('-1');
	});

	it('opens the accepted practice case on the my-sessions detail route', () => {
		const route = practiceAcceptedSessionRoute();
		const match = matchPath(
			'/sessions/consultant/sessionView/:groupId/:sessionId',
			route
		);
		expect(match?.params.sessionId).toBe('-2');
		expect(decodeURIComponent(match?.params.groupId ?? '')).toBe(
			PRACTICE_ACCEPTED_ROOM_ID
		);
	});

	it('addresses the case a fresh accept moves into my sessions', () => {
		const route = practiceAcceptedSessionRoute(
			PRACTICE_ENQUIRY_SESSION_ID,
			PRACTICE_ENQUIRY_ROOM_ID
		);
		const match = matchPath(
			'/sessions/consultant/sessionView/:groupId/:sessionId',
			route
		);
		expect(match?.params.sessionId).toBe('-1');
		expect(decodeURIComponent(match?.params.groupId ?? '')).toBe(
			PRACTICE_ENQUIRY_ROOM_ID
		);
	});
});
