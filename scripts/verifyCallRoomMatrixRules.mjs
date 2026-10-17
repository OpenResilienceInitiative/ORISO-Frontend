/**
 * The three Matrix rules the call room's identity transport rests on,
 * checked against a real homeserver instead of being reasoned about.
 *
 * Everything else about Call v2 is covered by unit tests, which can only
 * ever confirm that our code does what we told it to. These three are
 * different: they are assumptions about what SYNAPSE does, and if any of
 * them is wrong the failure is silent — every test green and every face in
 * the call showing initials. That is the shape of bug this epic has already
 * produced five times.
 *
 *   0. The creator may not appear in `power_level_content_override.users`
 *      from room version 12 — which is the DEFAULT on a current Synapse. The
 *      whole `createRoom` call is rejected, so before this was found the call
 *      room could not be created at all on an up-to-date homeserver and every
 *      group call silently ran in the counselling session room instead. On
 *      Omitting the entry is safe on 10 and 11 as well, because
 *      `power_level_content_override` updates the default content key by key
 *      and that default already gives the creator 100 — which is why the fix
 *      is simply to leave it out. That last point is here because I had
 *      assumed the opposite and built a version-sniffing retry on it; the
 *      homeserver said otherwise.
 *
 *   1. `m.room.encrypted` at power level 50 refuses an ordinary participant.
 *      The call room is created with `users_default: 0`, so if this holds,
 *      the old level would have refused everybody's identity but the
 *      creator's. This is why `createElementCallRoom` now grants it at 0.
 *
 *   2. A state event whose state key is somebody else's user id is refused,
 *      even when the event type itself is granted at level 0. This was the
 *      forgery argument for the previous, state-event transport. It could
 *      not be checked when it was made — spec.matrix.org is blocked from
 *      the build container — so it was argued from memory and the reader
 *      was given its own sender check instead. Now it can be checked.
 *
 *   3. `history_visibility: joined` hides timeline events sent before a
 *      member joined. This is the premise of the re-announce: if a newcomer
 *      could read earlier timeline events, nobody would need to repeat
 *      themselves.
 *
 * Usage: start a Synapse with open registration, then
 *   HS=http://127.0.0.1:8008 node scripts/verifyCallRoomMatrixRules.mjs
 *
 * No LiveKit, no ORISO backend and no browser: these are plain client-server
 * API calls, which is all the three rules involve.
 */
import { readFileSync } from 'node:fs';

const HS = process.env.HS ?? 'http://127.0.0.1:8008';
const SERVER = process.env.SERVER_NAME ?? 'oriso.test';
const IDENTITY = 'org.oriso.call.identity';
const stamp = Date.now().toString(36);

let failures = 0;
const check = (ok, what, detail = '') => {
	console.log(
		`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`
	);
	if (!ok) failures += 1;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One request, waiting out a rate limit rather than failing on it.
 *
 * This script creates a dozen rooms in a few seconds, which no real client
 * does, so it trips Synapse's room-creation limiter. Honouring
 * `retry_after_ms` keeps the script working on a default configuration
 * instead of requiring the homeserver to be loosened for it.
 */
async function api(method, path, options = {}) {
	for (let attempt = 0; ; attempt += 1) {
		const result = await once(method, path, options);
		if (result.json?.errcode !== 'M_LIMIT_EXCEEDED' || attempt >= 5)
			return result;
		await sleep(Math.min(result.json.retry_after_ms ?? 1000, 65000) + 250);
	}
}

async function once(method, path, { token, body } = {}) {
	const response = await fetch(`${HS}/_matrix/client/v3${path}`, {
		method,
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {})
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});
	const text = await response.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text };
	}
	return { status: response.status, json };
}

async function register(localpart) {
	const first = await api('POST', '/register', {
		body: { username: localpart, password: 'verify-me-0000', auth: {} }
	});
	const session = first.json?.session;
	const done = await api('POST', '/register', {
		body: {
			username: localpart,
			password: 'verify-me-0000',
			auth: { type: 'm.login.dummy', session }
		}
	});
	if (!done.json?.access_token)
		throw new Error(
			`could not register ${localpart}: ${JSON.stringify(done.json)}`
		);
	return { userId: done.json.user_id, token: done.json.access_token };
}

/**
 * The power levels of `createElementCallRoom`, with the one field under
 * test left as a parameter.
 *
 * Mirrored rather than imported: the source is TypeScript inside a Vite
 * app. The guard below reads the source and fails if the two have drifted,
 * which is the part that actually matters.
 */
const powerLevels = (encryptedLevel, creator) => ({
	invite: 100,
	kick: 100,
	ban: 100,
	redact: 50,
	state_default: 100,
	events_default: 0,
	users_default: 0,
	events: {
		'm.room.power_levels': 100,
		'm.room.join_rules': 100,
		'm.room.guest_access': 100,
		'm.room.history_visibility': 100,
		'm.room.canonical_alias': 100,
		'm.room.server_acl': 100,
		'm.room.tombstone': 100,
		'm.room.encryption': 100,
		'm.room.name': 100,
		'm.room.message': 0,
		'm.room.encrypted': encryptedLevel,
		'm.sticker': 50,
		'org.matrix.msc3401.call.member': 0
	},
	users: { [creator]: 100 }
});

async function makeRoom(
	alice,
	{
		encryptedLevel,
		extraEvents = {},
		invite,
		roomVersion,
		withCreatorPower = true,
		expectFailure = false
	}
) {
	const levels = powerLevels(encryptedLevel, alice.userId);
	levels.events = { ...levels.events, ...extraEvents };
	if (!withCreatorPower) delete levels.users;
	const created = await api('POST', '/createRoom', {
		token: alice.token,
		body: {
			...(roomVersion ? { room_version: roomVersion } : {}),
			visibility: 'private',
			preset: 'private_chat',
			name: `verify ${stamp}`,
			initial_state: [
				{
					type: 'm.room.encryption',
					state_key: '',
					content: { algorithm: 'm.megolm.v1.aes-sha2' }
				},
				{
					type: 'm.room.history_visibility',
					state_key: '',
					content: { history_visibility: 'joined' }
				},
				{
					type: 'm.room.guest_access',
					state_key: '',
					content: { guest_access: 'forbidden' }
				}
			],
			power_level_content_override: levels,
			invite: invite ? [invite] : []
		}
	});
	if (expectFailure) return created;
	if (!created.json?.room_id)
		throw new Error(`createRoom failed: ${JSON.stringify(created.json)}`);
	return created.json.room_id;
}

const send = (who, roomId, type, content) =>
	api(
		'PUT',
		`/rooms/${encodeURIComponent(roomId)}/send/${type}/txn-${stamp}-${Math.random()
			.toString(36)
			.slice(2)}`,
		{ token: who.token, body: content }
	);

const sendState = (who, roomId, type, stateKey, content) =>
	api(
		'PUT',
		`/rooms/${encodeURIComponent(roomId)}/state/${type}/${encodeURIComponent(
			stateKey
		)}`,
		{ token: who.token, body: content }
	);

async function main() {
	console.log(`Homeserver: ${HS}\n`);

	// Guards: the power levels above must still be the ones the app ships,
	// and the retry this script justifies must still be there.
	const source = readFileSync(
		new URL('../src/services/CallManager.ts', import.meta.url),
		'utf8'
	);
	check(
		source.includes("'m.room.encrypted': 0"),
		"CallManager still grants 'm.room.encrypted' at 0",
		'this script mirrors its power levels'
	);
	check(
		!source.includes('[CALL_IDENTITY_EVENT_TYPE]:'),
		'CallManager no longer grants the identity type as room state'
	);
	check(
		!/users:\s*\{/.test(
			source.slice(source.indexOf('power_level_content_override'))
		),
		'CallManager does not name the creator in power_level_content_override'
	);

	const alice = await register(`alice-${stamp}`);
	const bob = await register(`bob-${stamp}`);
	console.log(`alice = ${alice.userId}\nbob   = ${bob.userId}\n`);

	const join = async (roomId) => {
		const joined = await api(
			'POST',
			`/rooms/${encodeURIComponent(roomId)}/join`,
			{ token: bob.token }
		);
		if (joined.status !== 200)
			throw new Error(
				`bob could not join: ${JSON.stringify(joined.json)}`
			);
	};

	// ---- 0. the room version that refused to create the room at all ----
	for (const roomVersion of ['10', '11']) {
		const created = await makeRoom(alice, {
			encryptedLevel: 0,
			roomVersion,
			expectFailure: true
		});
		check(
			created.status === 200,
			`room version ${roomVersion} accepts the creator in content.users`,
			`status ${created.status} ${created.json?.errcode ?? ''}`
		);
	}
	const refusedCreate = await makeRoom(alice, {
		encryptedLevel: 0,
		roomVersion: '12',
		expectFailure: true
	});
	check(
		refusedCreate.status === 400 &&
			/content\.users/i.test(String(refusedCreate.json?.error ?? '')),
		'room version 12 REFUSES the creator in content.users',
		`status ${refusedCreate.status}: ${refusedCreate.json?.error ?? ''}`
	);
	const defaultCreate = await makeRoom(alice, {
		encryptedLevel: 0,
		expectFailure: true
	});
	check(
		defaultCreate.status === 400,
		"and so does this server's DEFAULT room version",
		'which is why the call room could not be created at all'
	);

	// The retry: drop the entry and the room is created, and the creator
	// still holds power implicitly — `m.room.name` needs level 100.
	const retried = await makeRoom(alice, {
		encryptedLevel: 0,
		withCreatorPower: false
	});
	const named = await sendState(alice, retried, 'm.room.name', '', {
		name: 'still in charge'
	});
	check(
		named.status === 200,
		'dropping the entry creates the room, and the creator keeps power',
		`m.room.name -> ${named.status}`
	);

	/*
	 * And omitting it is safe on the OLD versions too, which is the fact that
	 * decided the shape of the fix.
	 *
	 * I had assumed `power_level_content_override` replaced the default power
	 * level content outright, so that dropping `users` would leave the creator
	 * at `users_default: 0`; that assumption made a version-sniffing retry look
	 * necessary. It is wrong. The override updates the default content key by
	 * key, and the default already gives the creator 100 — so omitting `users`
	 * leaves them in charge on every version, and the fix is to leave it out
	 * rather than to retry. `m.room.name` below needs level 100.
	 */
	for (const roomVersion of ['10', '11']) {
		const room = await makeRoom(alice, {
			encryptedLevel: 0,
			roomVersion,
			withCreatorPower: false
		});
		const stillNamed = await sendState(alice, room, 'm.room.name', '', {
			name: 'still in charge'
		});
		check(
			stillNamed.status === 200,
			`on room version ${roomVersion}, omitting the entry still leaves the creator at 100`,
			`m.room.name -> ${stillNamed.status} ${stillNamed.json?.errcode ?? ''}`
		);
	}

	// Everything below uses what the fixed code now produces on this server:
	// the default room version, with no creator entry.
	const callRoom = (extra) =>
		makeRoom(alice, {
			withCreatorPower: false,
			invite: bob.userId,
			...extra
		});

	// ---- 1. the level that would have silenced everybody ----
	const strictRoom = await callRoom({ encryptedLevel: 50 });
	await join(strictRoom);
	const refused = await send(bob, strictRoom, 'm.room.encrypted', {
		algorithm: 'm.megolm.v1.aes-sha2',
		ciphertext: 'not-really'
	});
	check(
		refused.status === 403 && refused.json?.errcode === 'M_FORBIDDEN',
		"at level 50, an ordinary participant may NOT send 'm.room.encrypted'",
		`status ${refused.status} ${refused.json?.errcode ?? ''}`
	);

	const openRoom = await callRoom({ encryptedLevel: 0 });
	await join(openRoom);
	const allowed = await send(bob, openRoom, 'm.room.encrypted', {
		algorithm: 'm.megolm.v1.aes-sha2',
		ciphertext: 'not-really'
	});
	check(
		allowed.status === 200 && Boolean(allowed.json?.event_id),
		"at level 0, an ordinary participant MAY send 'm.room.encrypted'",
		`status ${allowed.status}`
	);

	// ---- 2. the forgery claim, as the state transport made it ----
	const stateRoom = await callRoom({
		encryptedLevel: 0,
		// Exactly what the old transport granted, so a refusal below can
		// only come from the state-key rule and not from the level.
		extraEvents: { [IDENTITY]: 0 }
	});
	await join(stateRoom);
	const own = await sendState(bob, stateRoom, IDENTITY, bob.userId, {
		kind: 'initials',
		bg: '#165E83',
		ink: '#ffffff',
		initials: 'BO'
	});
	check(
		own.status === 200,
		'with the type granted at 0, a participant may write their OWN state key',
		`status ${own.status}`
	);
	const forged = await sendState(bob, stateRoom, IDENTITY, alice.userId, {
		kind: 'initials',
		bg: '#000000',
		ink: '#ffffff',
		initials: 'XX'
	});
	check(
		forged.status === 403 && forged.json?.errcode === 'M_FORBIDDEN',
		"a participant may NOT write a state key that is another user's id",
		`status ${forged.status} ${forged.json?.errcode ?? ''}`
	);

	// ---- 3. the premise of the re-announce ----
	const historyRoom = await makeRoom(alice, {
		encryptedLevel: 0,
		withCreatorPower: false
	});
	const before = await send(alice, historyRoom, IDENTITY, {
		kind: 'initials',
		bg: '#165E83',
		ink: '#ffffff',
		initials: 'AL'
	});
	check(
		before.status === 200,
		'alice announces herself before bob is in the room'
	);
	await api('POST', `/rooms/${encodeURIComponent(historyRoom)}/invite`, {
		token: alice.token,
		body: { user_id: bob.userId }
	});
	await join(historyRoom);
	const messages = await api(
		'GET',
		`/rooms/${encodeURIComponent(historyRoom)}/messages?dir=b&limit=100`,
		{ token: bob.token }
	);
	const visible = (messages.json?.chunk ?? []).filter(
		(event) => event.type === IDENTITY
	);
	check(
		visible.length === 0,
		"with history_visibility 'joined', a newcomer cannot read an identity sent before they joined",
		`saw ${visible.length} such event(s) — this is why everybody re-announces`
	);

	// ---- 4. and nothing identity-shaped in room state ----
	const state = await api(
		'GET',
		`/rooms/${encodeURIComponent(historyRoom)}/state`,
		{ token: bob.token }
	);
	const inState = (state.json ?? []).filter(
		(event) => event.type === IDENTITY
	);
	check(
		Array.isArray(state.json) && inState.length === 0,
		'the room state of a call room holds no identity record at all'
	);

	console.log(
		`\n${failures === 0 ? 'All checks held.' : `${failures} check(s) failed.`}`
	);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error(`\nverification could not run: ${error.message}`);
	process.exit(2);
});
