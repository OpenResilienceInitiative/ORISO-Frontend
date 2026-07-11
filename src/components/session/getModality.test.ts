import { describe, expect, it } from 'vitest';
import { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import { getModality, Modality } from './getModality';

const asItem = (partial: unknown): ListItemInterface =>
	partial as ListItemInterface;

describe('getModality', () => {
	it('classifies an anonymous session as LIVE_CHAT', () => {
		const item = asItem({ session: { registrationType: 'ANONYMOUS' } });
		expect(getModality(item)).toBe(Modality.LIVE_CHAT);
	});

	it('keeps the legacy anonymous-postcode fallback during backend rollout', () => {
		const item = asItem({
			session: { registrationType: 'REGISTERED', postcode: 0 }
		});
		expect(getModality(item)).toBe(Modality.LIVE_CHAT);
	});

	it('keeps the legacy anonymous-username fallback on the active-session shape', () => {
		const activeSession = {
			item: { registrationType: 'REGISTERED', postcode: 10115 },
			user: { username: 'Anonymous-legacy' },
			isGroup: false,
			isSession: true
		};

		expect(getModality(activeSession)).toBe(Modality.LIVE_CHAT);
	});

	it('classifies a registered session as AGENCY_COUNSELLING', () => {
		const item = asItem({ session: { registrationType: 'REGISTERED' } });
		expect(getModality(item)).toBe(Modality.AGENCY_COUNSELLING);
	});

	it('classifies a team session as INTERNAL_GROUP even when registered', () => {
		const item = asItem({
			session: { registrationType: 'REGISTERED', teamSession: true }
		});
		expect(getModality(item)).toBe(Modality.INTERNAL_GROUP);
	});

	it('classifies a non-repetitive group chat as INTERNAL_GROUP', () => {
		const item = asItem({ chat: { repetitive: false } });
		expect(getModality(item)).toBe(Modality.INTERNAL_GROUP);
	});

	it('classifies a repetitive group chat as SELF_HELP', () => {
		const item = asItem({ chat: { repetitive: true } });
		expect(getModality(item)).toBe(Modality.SELF_HELP);
	});

	it('classifies a one-occurrence Series as SELF_HELP', () => {
		const item = asItem({
			chat: { repetitive: false, repeatCount: 1 }
		});
		expect(getModality(item)).toBe(Modality.SELF_HELP);
	});

	it('prefers an explicit backend conversationType over the heuristic', () => {
		// looks like AGENCY_COUNSELLING by heuristic, but the backend says LIVE_CHAT
		const item = asItem({
			session: {
				registrationType: 'REGISTERED',
				conversationType: 'LIVE_CHAT'
			}
		});
		expect(getModality(item)).toBe(Modality.LIVE_CHAT);
	});

	it('prefers an explicit modality on the active-session shape over conflicting legacy fields', () => {
		const activeSession = {
			item: {
				conversationType: 'LIVE_CHAT',
				registrationType: 'REGISTERED',
				postcode: 10115
			},
			isGroup: false,
			isSession: true
		};

		expect(getModality(activeSession)).toBe(Modality.LIVE_CHAT);
	});

	it('ignores an unknown explicit conversationType and falls back to the heuristic', () => {
		const item = asItem({
			session: {
				registrationType: 'ANONYMOUS',
				conversationType: 'NONSENSE'
			}
		});
		expect(getModality(item)).toBe(Modality.LIVE_CHAT);
	});

	it('defaults to AGENCY_COUNSELLING for an empty/unknown item', () => {
		expect(getModality(asItem({}))).toBe(Modality.AGENCY_COUNSELLING);
	});
});
