// @vitest-environment jsdom
/**
 * The artwork contract, from the host's side.
 *
 * The animal a person is given has to arrive in two places: the chat, which
 * this repository draws itself, and the call, which ORISO-ElementCall draws
 * from what we publish. The second one only works while both sides agree
 * about three facts — the shape of the file name, the folder it is served
 * from, and the revision that busts the cache when a drawing changes.
 *
 * The fork's end is `src/oriso/identity.ts` (`ARTWORK_FILE_NAME`) and
 * `src/oriso/artwork.ts` (`ARTWORK_PATH`, `ARTWORK_REVISION`), asserted there
 * by `src/oriso/artworkContract.test.ts`. Each file names the other, so a
 * change on one side turns the other red.
 *
 * Why it is worth a test rather than a comment: the failure is silent. A
 * drawing the call cannot name, or cannot find, ends as initials — which is
 * also what a person who published nothing gets. Without this, "the call
 * shows letters" and "the file is missing" look identical.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import { LANGUAGE_DATA } from './data';
import { AVATAR_ART_REVISION, renderAvatarSvg } from '../pseudonymGenerator';

/** Every drawing the generator can hand out, in any language. */
const shippedFiles = (): string[] => {
	const files = new Set<string>();
	for (const language of Object.values(LANGUAGE_DATA))
		for (const group of language.groups)
			for (const animal of group.animals) files.add(animal.svg);
	return [...files].sort();
};

const ARTWORK_DIR = path.join(
	process.cwd(),
	'public',
	'static',
	'anon-animals'
);

// `ARTWORK_FILE_NAME` in ORISO-ElementCall's `src/oriso/identity.ts`, copied
// deliberately rather than imported: what has to hold is that two separately
// built repositories agree, not that they share a constant.
const FORK_ACCEPTS = /^[a-z0-9][a-z0-9_-]*\.svg$/i;

describe('the artwork the call inherits', () => {
	it('ships every drawing the generator can hand out', () => {
		const missing = shippedFiles().filter(
			(file) => !fs.existsSync(path.join(ARTWORK_DIR, file))
		);
		// A name in `data.ts` without a file under `public/static/anon-animals`
		// is an avatar that renders as letters for whoever draws it — here and
		// in the call.
		expect(missing).toEqual([]);
	});

	it('uses only names the call will accept', () => {
		const refused = shippedFiles().filter(
			(file) => !FORK_ACCEPTS.test(file)
		);
		// A name with a slash, a second dot or a query would be rejected by the
		// fork's reader and the person would appear as initials in calls while
		// looking right in the chat.
		expect(refused).toEqual([]);
	});

	it('asks for the drawing at the address the call looks at', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			headers: { get: () => 'image/svg+xml' },
			// The real drawings begin with an XML prolog, and both loaders
			// parse rather than prefix-match for exactly that reason. Only
			// the URL matters here, so the body is the smallest valid one.
			text: async () =>
				'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'
		} as unknown as Response);

		await renderAvatarSvg({
			file: 'fox.svg',
			bg: '#165E83',
			iconColor: '#ffffff'
		});

		// `/static`, not `/assets`: on this host `/assets` is routed to the
		// call's own bundle, so the drawings would 404 there (#840). The fork
		// joins its file names onto exactly this path.
		expect(String(fetchSpy.mock.calls[0][0])).toBe(
			`/static/anon-animals/fox.svg?v=${AVATAR_ART_REVISION}`
		);
		fetchSpy.mockRestore();
	});

	it('agrees with the call about the cache revision', () => {
		// `ARTWORK_REVISION` in ORISO-ElementCall's `src/oriso/artwork.ts`. If
		// this one moves and that one does not, a viewer in a call keeps the
		// old drawing while the chat shows the new one.
		expect(AVATAR_ART_REVISION).toBe(2);
	});
});
