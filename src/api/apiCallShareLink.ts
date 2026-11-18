import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from './fetchData';
import type { CallShareSettings } from '../components/call/share/callShareSettings';
import {
	GUEST_ACCOUNT_MODES,
	GuestAccountMode,
	isGuestAccountMode,
	offersTemporaryAccount,
	readGuestAccountMode
} from '../components/guestAccountMode/guestAccountMode';

/** The share link of one running call (UserService#1487). */
export interface CallShareLink {
	id: number;
	url: string;
	/** Effective on the server: a forbidden mode reads as its fallback. */
	settings: CallShareSettings;
	/** Some mode the counsellor may choose creates a temporary account. */
	temporaryAccountAllowed: boolean;
	/** UserService#1662: the select's options. */
	allowedGuestAccountModes: GuestAccountMode[];
}

/* A server from before #1662 knows only whether temporary accounts are allowed. */
const allowedModes = (
	data: Record<string, unknown>,
	temporaryAccountAllowed: boolean
): GuestAccountMode[] =>
	Array.isArray(data.allowedGuestAccountModes)
		? data.allowedGuestAccountModes.filter(isGuestAccountMode)
		: temporaryAccountAllowed
			? GUEST_ACCOUNT_MODES
			: ['PERMANENT'];

const parse = (value: unknown): CallShareLink | null => {
	if (!value || typeof value !== 'object') return null;
	const data = value as Record<string, unknown>;
	if (
		typeof data.id !== 'number' ||
		typeof data.url !== 'string' ||
		!/^https?:\/\//.test(data.url) ||
		typeof data.knock !== 'boolean' ||
		typeof data.temporaryAccount !== 'boolean' ||
		typeof data.temporaryAccountAllowed !== 'boolean' ||
		data.active === false
	)
		return null;
	return {
		id: data.id,
		url: data.url,
		settings: {
			knock: data.knock,
			guestAccountMode: readGuestAccountMode(
				data.guestAccountMode,
				data.temporaryAccount
			)
		},
		temporaryAccountAllowed: data.temporaryAccountAllowed,
		allowedGuestAccountModes: allowedModes(
			data,
			data.temporaryAccountAllowed
		)
	};
};

/**
 * Creates the link of this call, or returns the one it already has with its
 * settings unchanged. `null` when the call cannot be shared: not allowed for
 * this medium (403), not in the call (404), call over (410) or the server
 * did not answer.
 */
export async function apiCreateCallShareLink(call: {
	sourceRoomId: string;
	callId: string;
}): Promise<CallShareLink | null> {
	try {
		return parse(
			await fetchData({
				url: endpoints.matrixCallShareLinks,
				method: FETCH_METHODS.POST,
				bodyData: JSON.stringify(call),
				// Without CONTENT a POST resolves with the raw Response.
				responseHandling: [
					FETCH_SUCCESS.CONTENT,
					FETCH_ERRORS.FORBIDDEN,
					FETCH_ERRORS.NO_MATCH,
					FETCH_ERRORS.CATCH_ALL
				]
			})
		);
	} catch {
		return null;
	}
}

/** Changes the settings of the same link; throws when the change did not land. */
export async function apiUpdateCallShareLink(
	id: number,
	settings: CallShareSettings
): Promise<CallShareSettings> {
	const link = parse(
		await fetchData({
			url: `${endpoints.matrixCallShareLinks}/${id}`,
			method: FETCH_METHODS.PATCH,
			// The old switch for a server from before #1662; the mode wins.
			bodyData: JSON.stringify({
				...settings,
				temporaryAccount: offersTemporaryAccount(
					settings.guestAccountMode
				)
			}),
			responseHandling: [
				FETCH_SUCCESS.CONTENT,
				FETCH_ERRORS.NO_MATCH,
				FETCH_ERRORS.CATCH_ALL
			]
		})
	);
	if (!link) throw new Error(FETCH_ERRORS.CATCH_ALL);
	return link.settings;
}
