import { describe, expect, it } from 'vitest';
import { Modality } from '../session/getModality';
import { getErstantwortRenderMode } from './erstantwortRoomGate';

describe('getErstantwortRenderMode', () => {
	it('is none for anything that is not an Erstantwort event', () => {
		expect(
			getErstantwortRenderMode(false, Modality.AGENCY_COUNSELLING)
		).toBe('none');
		expect(getErstantwortRenderMode(false, Modality.INTERNAL_GROUP)).toBe(
			'none'
		);
		expect(getErstantwortRenderMode(false, undefined)).toBe('none');
	});

	it('renders the staged sequence in rooms that have an advice seeker', () => {
		expect(
			getErstantwortRenderMode(true, Modality.AGENCY_COUNSELLING)
		).toBe('sequence');
		expect(getErstantwortRenderMode(true, Modality.LIVE_CHAT)).toBe(
			'sequence'
		);
		expect(getErstantwortRenderMode(true, Modality.SELF_HELP)).toBe(
			'sequence'
		);
	});

	it('renders a neutral line, never the raw payload, in an internal counsellor room', () => {
		expect(getErstantwortRenderMode(true, Modality.INTERNAL_GROUP)).toBe(
			'unavailable'
		);
	});

	it('renders a neutral line when the room modality is unknown', () => {
		expect(getErstantwortRenderMode(true, undefined)).toBe('unavailable');
	});
});
