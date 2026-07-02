/**
 * WP-06 Activity Timeline — unit coverage for the event-descriptor registry
 * (Slice 0a). Pure-logic vitest spec.
 *
 * Imports the pure registry modules directly (NOT the `./index` barrel, which
 * also re-exports `icons.tsx` → SVG React components that the vitest/vite
 * pipeline does not transform). The icon *components* are a thin presentational
 * lookup with a built-in fallback and are exercised when `NotificationsCenter`
 * renders; here we assert every descriptor references a declared icon id.
 *
 * Runs in CI via `npm run test:unit`. Supersedes the non-CI
 * `cypress/e2e/eventDescriptors.cy.ts` logic spec.
 */

import { describe, it, expect } from 'vitest';
import {
	EVENT_DESCRIPTORS,
	KNOWN_EVENT_TYPES,
	FALLBACK_DESCRIPTOR,
	getEventDescriptor,
	isKnownEventType,
	familyLabelKey
} from './registry';
import { renderEventStrings } from './renderEventStrings';
import { EventFamily, EventIconId } from './types';
import enCommon from '../../../resources/i18n/en/common.json';
import deCommon from '../../../resources/i18n/de/common.json';

const EXISTING_EMITTED_TYPES = [
	'inquiry.accepted',
	'message.new',
	'thread.reply.new',
	'supervisor.added',
	'supervisor.removed',
	'supervisor.assigned',
	'counselor.renamed'
];

const ALL_FAMILIES: EventFamily[] = [
	'requests',
	'messages',
	'drafts',
	'handover',
	'calls',
	'system',
	'appointments'
];

// The declared EventIconId union (mirrors types.ts). Descriptors may only point
// at one of these; the id→SVG mapping lives in icons.tsx with a fallback.
const KNOWN_ICON_IDS: EventIconId[] = [
	'requestNew',
	'requestAccepted',
	'message',
	'threadReply',
	'draft',
	'handover',
	'callStarted',
	'callEnded',
	'callMissed',
	'supervisor',
	'rename',
	'system'
];

// Expected action-target kind per seeded type (origin rule).
const EXPECTED_TARGET_KIND: Record<string, string> = {
	'inquiry.accepted': 'conversation',
	'message.new': 'conversation',
	'thread.reply.new': 'conversation',
	'supervisor.added': 'conversation',
	'supervisor.removed': 'conversation',
	'supervisor.assigned': 'conversation',
	'counselor.renamed': 'conversation',
	'request.new': 'request',
	'draft.created': 'draft',
	'handover.requested': 'conversation',
	'handover.partial': 'conversation',
	'handover.all_confirmed': 'conversation',
	'handover.auto_confirmed': 'conversation',
	'handover.denied': 'conversation',
	'case.handover.consent.requested': 'conversation',
	'case.handover.granted': 'conversation',
	'case.handover.consent.declined': 'conversation',
	'call.started': 'join',
	'call.ended': 'conversation',
	'call.missed': 'conversation'
};

// Resolve a dotted i18n key against a loaded common.json object.
const resolveI18nKey = (obj: any, dottedKey: string): unknown =>
	dottedKey
		.split('.')
		.reduce((acc, part) => (acc == null ? acc : acc[part]), obj);

describe('WP-06 event-descriptor registry', () => {
	it('seeds a descriptor for every existing emitted event type', () => {
		EXISTING_EMITTED_TYPES.forEach((type) => {
			expect(isKnownEventType(type)).toBe(true);
			expect(EVENT_DESCRIPTORS[type]).toBeDefined();
		});
	});

	it('seeds every designed family (Appointments deferred) — 20 types total', () => {
		// 7 existing + request.new + draft.created + 8 handover + 3 call = 20.
		expect(KNOWN_EVENT_TYPES.length).toBe(20);
		[
			'request.new',
			'draft.created',
			'handover.requested',
			'handover.partial',
			'handover.all_confirmed',
			'handover.auto_confirmed',
			'handover.denied',
			'case.handover.consent.requested',
			'case.handover.granted',
			'case.handover.consent.declined',
			'call.started',
			'call.ended',
			'call.missed'
		].forEach((type) => expect(isKnownEventType(type)).toBe(true));
	});

	it('exposes every seeded type via KNOWN_EVENT_TYPES with no duplicates', () => {
		const unique = new Set(KNOWN_EVENT_TYPES);
		expect(unique.size).toBe(KNOWN_EVENT_TYPES.length);
		EXISTING_EMITTED_TYPES.forEach((type) =>
			expect(KNOWN_EVENT_TYPES).toContain(type)
		);
	});

	it('gives every descriptor a valid family, category, icon and templates', () => {
		KNOWN_EVENT_TYPES.forEach((type) => {
			const d = EVENT_DESCRIPTORS[type];
			expect(d.eventType).toBe(type);
			expect(ALL_FAMILIES).toContain(d.family);
			expect(['system', 'message']).toContain(d.category);
			// icon id must be a declared EventIconId (resolved to an SVG by icons.tsx).
			expect(KNOWN_ICON_IDS).toContain(d.icon);
			expect(d.titleTemplate).toMatch(/^notifications\.events\./);
			expect(d.textTemplate).toMatch(/^notifications\.events\./);
		});
	});

	it('covers all designed families across the seeded descriptors', () => {
		const seededFamilies = new Set(
			KNOWN_EVENT_TYPES.map((t) => EVENT_DESCRIPTORS[t].family)
		);
		// Appointments are deferred (no seeded types); every other family is present.
		(
			[
				'requests',
				'messages',
				'drafts',
				'handover',
				'calls',
				'system'
			] as EventFamily[]
		).forEach((fam) => expect(seededFamilies.has(fam)).toBe(true));
		// Appointments family is declared but intentionally not seeded yet.
		expect(seededFamilies.has('appointments')).toBe(false);
	});

	it('returns the fallback descriptor for unknown / empty types', () => {
		expect(getEventDescriptor('totally.unknown.type')).toBe(
			FALLBACK_DESCRIPTOR
		);
		expect(getEventDescriptor(null)).toBe(FALLBACK_DESCRIPTOR);
		expect(getEventDescriptor(undefined)).toBe(FALLBACK_DESCRIPTOR);
		expect(isKnownEventType('totally.unknown.type')).toBe(false);
		expect(KNOWN_ICON_IDS).toContain(FALLBACK_DESCRIPTOR.icon);
	});

	describe('resolveActionTarget (origin rule)', () => {
		it('resolves the expected target kind for every seeded type', () => {
			KNOWN_EVENT_TYPES.forEach((type) => {
				const target = EVENT_DESCRIPTORS[type].resolveActionTarget({});
				expect(target.kind).toBe(EXPECTED_TARGET_KIND[type]);
			});
		});

		it('chat events target the conversation, honouring actionPath', () => {
			const target = getEventDescriptor(
				'message.new'
			).resolveActionTarget({
				actionPath: '/sessions/consultant/sessionView/session/42'
			});
			expect(target).toEqual({
				kind: 'conversation',
				path: '/sessions/consultant/sessionView/session/42'
			});
		});

		it('builds a conversation path from sourceSessionId + base when no actionPath', () => {
			const target = getEventDescriptor(
				'message.new'
			).resolveActionTarget({
				sourceSessionId: 7,
				sessionsBasePath: '/sessions/user/view'
			});
			expect(target).toEqual({
				kind: 'conversation',
				path: '/sessions/user/view/session/7'
			});
		});

		it('request-origin events target the request view', () => {
			const target = getEventDescriptor(
				'request.new'
			).resolveActionTarget({
				actionPath: '/sessions/consultant/sessionPreview'
			});
			expect(target.kind).toBe('request');
			expect((target as any).path).toBe(
				'/sessions/consultant/sessionPreview'
			);
		});

		it('draft events resume via forcedScopeKey', () => {
			const target = getEventDescriptor(
				'draft.created'
			).resolveActionTarget({
				forcedScopeKey: 'scope:session:99|thread:main'
			});
			expect(target).toEqual({
				kind: 'draft',
				forcedScopeKey: 'scope:session:99|thread:main',
				path: null
			});
		});

		it('live call events resolve to a Join target (no navigation)', () => {
			const target = getEventDescriptor(
				'call.started'
			).resolveActionTarget({
				callRoomId: '!room:matrix',
				isVideo: true
			});
			expect(target).toEqual({
				kind: 'join',
				callRoomId: '!room:matrix',
				isVideo: true
			});
		});
	});

	describe('i18n templates', () => {
		it('has an English + German string for every descriptor template', () => {
			[...KNOWN_EVENT_TYPES, '__fallback__'].forEach((type) => {
				const d =
					type === '__fallback__'
						? FALLBACK_DESCRIPTOR
						: EVENT_DESCRIPTORS[type];
				[d.titleTemplate, d.textTemplate].forEach((key) => {
					expect(typeof resolveI18nKey(enCommon, key)).toBe('string');
					expect(typeof resolveI18nKey(deCommon, key)).toBe('string');
				});
			});
		});

		it('has a non-empty English + German label for every family', () => {
			ALL_FAMILIES.forEach((fam) => {
				const key = familyLabelKey(fam);
				const en = resolveI18nKey(enCommon, key);
				const de = resolveI18nKey(deCommon, key);
				expect(typeof en).toBe('string');
				expect(en).not.toBe('');
				expect(typeof de).toBe('string');
				expect(de).not.toBe('');
			});
		});
	});

	describe('renderEventStrings (client-side rendering, ADR-AT-01)', () => {
		// Fake translate mimicking i18next: return the en value, else defaultValue.
		const translate = (key: string, options?: Record<string, unknown>) => {
			const value = resolveI18nKey(enCommon, key);
			if (typeof value === 'string' && value.length > 0) {
				return value;
			}
			return (options?.defaultValue as string) ?? '';
		};

		it('renders a known type from its i18n template', () => {
			const { title, text } = renderEventStrings(
				getEventDescriptor('message.new'),
				translate,
				{ fallbackTitle: 'server title', fallbackText: 'server text' }
			);
			expect(title).toBe('New message');
			expect(text).toBe('You received a new message.');
		});

		it('falls back to server-provided text for unknown types', () => {
			const { title, text } = renderEventStrings(
				getEventDescriptor('totally.unknown.type'),
				translate,
				{
					fallbackTitle: 'Server-rendered title',
					fallbackText: 'Server body'
				}
			);
			// Fallback descriptor title template exists ("Activity"); its text
			// template is empty, so the server-provided text is used.
			expect(title).toBe('Activity');
			expect(text).toBe('Server body');
		});
	});
});
