// @vitest-environment oriso-jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
	forgetAllJoinMedia,
	peekJoinMedia,
	rememberJoinMedia
} from './callPrejoin';
import { useJoinMediaForCall } from './useJoinMediaForCall';

const ROOM = '!conversation:example';
const chosen = {
	audio_enabled: true,
	video_enabled: false,
	microphoneLabel: 'Jabra Evolve2 Headset'
};

describe('useJoinMediaForCall (ElementCall#116)', () => {
	afterEach(() => forgetAllJoinMedia());

	it('holds the choice for the whole call, from the first render on', () => {
		rememberJoinMedia(ROOM, chosen);
		const { result, rerender } = renderHook(
			({ call }) => useJoinMediaForCall(ROOM, call),
			{ initialProps: { call: 'call-1' as string | null } }
		);
		// The widget URL is built from this, so it must be there at once and
		// stay the same through every later render of the same call.
		expect(result.current).toEqual(chosen);
		rerender({ call: 'call-1' });
		rerender({ call: 'call-1' });
		expect(result.current).toEqual(chosen);
	});

	it('takes the choice, so the next call in the room starts afresh', () => {
		rememberJoinMedia(ROOM, chosen);
		const { result, rerender } = renderHook(
			({ call }) => useJoinMediaForCall(ROOM, call),
			{ initialProps: { call: 'call-1' as string | null } }
		);
		expect(peekJoinMedia(ROOM)).toBe(null);

		rerender({ call: 'call-2' });
		expect(result.current).toBe(null);
	});

	it('holds nothing while there is no call', () => {
		rememberJoinMedia(ROOM, chosen);
		const { result } = renderHook(() => useJoinMediaForCall(ROOM, null));
		expect(result.current).toBe(null);
		// Still waiting for the call it was chosen for.
		expect(peekJoinMedia(ROOM)).toEqual(chosen);
	});
});
