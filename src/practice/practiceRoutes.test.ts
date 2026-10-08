import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
	PRACTICE_ENQUIRIES_ROUTE,
	practiceAcceptedSessionRoute,
	practiceEnquirySessionRoute
} from './practiceRoutes';

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

	it('opens the accepted practice case, the one a fresh accept moves into my sessions, on the my-sessions detail route', () => {
		// The team room is !practice-2: an F2 route there opened no case.
		const route = practiceAcceptedSessionRoute();
		const match = matchPath(
			'/sessions/consultant/sessionView/:groupId/:sessionId',
			route
		);
		expect(match?.params.sessionId).toBe('-1');
		expect(decodeURIComponent(match?.params.groupId ?? '')).toBe(
			'!practice-1:practice.invalid'
		);
	});
});
