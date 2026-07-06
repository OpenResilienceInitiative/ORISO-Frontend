import * as React from 'react';
import { useEffect } from 'react';
import {
	ActiveSessionContext,
	AUTHORITIES,
	UserDataContext
} from '../../../globalState';
import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE
} from '../../../globalState/interfaces/SessionsDataInterface';

/**
 * Shared Storybook harness for the real MessageSubmitInterfaceComponent.
 *
 * The global preview decorator already provides router, i18n, MUI theme,
 * TenantContext, SessionTypeContext, E2EE and the storybook fetch/WS mocks.
 * This decorator adds the composer-specific pieces: an active session, a
 * null Matrix client (transport is mocked at fetch level) and the consultant
 * user, plus fetch routes for the audience/consultant endpoints that must
 * return arrays instead of the generic `{}` fallback.
 */

export const storybookConsultant = {
	consultantId: 'consultant-storybook',
	id: 'consultant-storybook',
	username: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	absent: false,
	absenceMessage: ''
};

export const storybookAgencyConsultants = [
	{
		consultantId: 'consultant-storybook',
		firstName: 'Berta',
		lastName: 'Beraterin',
		displayName: 'Beraterin ORISO',
		username: 'beraterin@example.invalid'
	},
	{
		consultantId: 'consultant-kraeger',
		firstName: 'Anna',
		lastName: 'Kräger',
		displayName: 'A. Kräger',
		username: 'a.kraeger@example.invalid'
	},
	{
		consultantId: 'consultant-lehmann',
		firstName: 'Jonas',
		lastName: 'Lehmann',
		displayName: 'J. Lehmann',
		username: 'j.lehmann@example.invalid',
		isSupervisor: true
	}
];

export const storybookSessionSupervisors = [
	{
		id: 1,
		sessionId: 360,
		supervisorConsultantId: 'consultant-lehmann',
		supervisorUsername: 'j.lehmann@example.invalid',
		addedByConsultantId: 'consultant-storybook',
		addedDate: '2026-07-01T09:00:00Z'
	}
];

export const mockComposerUserData = {
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: [],
	emailToggles: [],
	e2eEncryptionEnabled: false,
	formalLanguage: false,
	hasArchive: true,
	isDisplayNameEditable: true,
	preferredLanguage: 'de',
	userRoles: [],
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	isWalkThroughEnabled: false,
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

export const buildMockActiveSession = (
	overrides: Record<string, any> = {},
	itemOverrides: Record<string, any> = {}
) =>
	({
		rid: null,
		type: 'session',
		isGroup: false,
		isSession: true,
		item: {
			id: 360,
			agencyId: 101,
			askerRcId: 'alice',
			groupId: '',
			matrixRoomId: '!storybook:oriso.org',
			postcode: 10115,
			registrationType: REGISTRATION_TYPE_REGISTERED,
			status: STATUS_ACTIVE,
			topic: {
				id: 1,
				name: 'Suchtprobleme',
				description: ''
			},
			moderators: [],
			messageDate: Date.now(),
			messagesRead: false,
			...itemOverrides
		},
		user: {
			username: 'sanftes.alpaka.kala@oriso.invalid',
			displayName: 'Sanftes Alpaka Kala',
			sessionData: {}
		},
		consultant: storybookConsultant,
		...overrides
	}) as any;

export const buildMockGroupSession = () =>
	({
		rid: null,
		type: 'chat',
		isGroup: true,
		isSession: false,
		item: {
			id: 9001,
			active: true,
			agencyId: 101,
			assignedAgencies: [],
			consultingType: 2,
			duration: 60,
			groupId: 'storybook-group-caritas',
			matrixRoomId: '!storybook-group:oriso.org',
			hintMessage: '',
			messageDate: Date.now(),
			messagesRead: false,
			moderators: ['consultant-storybook'],
			repetitive: false,
			startDate: '2026-07-01',
			startTime: '10:00',
			subscribed: true,
			topic: 'Träger Admins Caritas'
		},
		user: {
			username: 'mario-k@example.invalid',
			displayName: 'Mario K',
			sessionData: {}
		},
		consultant: storybookConsultant
	}) as any;

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

const requestUrl = (input: RequestInfo | URL): string => {
	if (typeof input === 'string') {
		return input;
	}
	if (input instanceof URL) {
		return input.toString();
	}
	return input.url;
};

let composerFetchMockDepth = 0;
let composerOriginalFetch: typeof globalThis.fetch | null = null;

/**
 * Layered on top of the global storybook fetch mock: specific composer
 * endpoints get array-shaped fixtures; everything else falls through.
 */
const installComposerFetchMocks = () => {
	composerFetchMockDepth += 1;

	const restore = () => {
		composerFetchMockDepth = Math.max(0, composerFetchMockDepth - 1);
		if (composerFetchMockDepth === 0 && composerOriginalFetch) {
			globalThis.fetch = composerOriginalFetch;
			composerOriginalFetch = null;
		}
	};

	if (composerOriginalFetch) {
		return restore;
	}

	const previousFetch = globalThis.fetch.bind(globalThis);
	composerOriginalFetch = previousFetch;

	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		let pathname = '';
		try {
			pathname = new URL(requestUrl(input), window.location.origin)
				.pathname;
		} catch {
			return previousFetch(input, init);
		}

		if (pathname.endsWith('/service/users/consultants')) {
			return jsonResponse(storybookAgencyConsultants);
		}

		if (/\/service\/users\/sessions\/\d+\/supervisors$/.test(pathname)) {
			return jsonResponse(storybookSessionSupervisors);
		}

		if (pathname.endsWith('/service/users/drafts')) {
			return jsonResponse({ items: [], page: 0, perPage: 200 });
		}

		if (pathname.endsWith('/service/messages/draft')) {
			return init?.method === 'GET' || !init?.method
				? new Response(null, { status: 204 })
				: jsonResponse({});
		}

		return previousFetch(input, init);
	};

	return restore;
};

export function ComposerStoryDecorator({
	activeSession,
	children
}: {
	activeSession?: any;
	children: React.ReactNode;
}) {
	useEffect(() => installComposerFetchMocks(), []);

	return (
		<MatrixClientContext.Provider
			value={{
				matrixClientService: null,
				setMatrixClientService: () => {}
			}}
		>
			<ActiveSessionContext.Provider
				value={{
					activeSession: activeSession ?? buildMockActiveSession(),
					reloadActiveSession: () => {},
					readActiveSession: () => {}
				}}
			>
				<UserDataContext.Provider
					value={{
						userData: mockComposerUserData,
						reloadUserData: async () => mockComposerUserData,
						setUserData: () => {}
					}}
				>
					{children}
				</UserDataContext.Provider>
			</ActiveSessionContext.Provider>
		</MatrixClientContext.Provider>
	);
}
