/**
 * WP-06 Activity Timeline — unit coverage for the event-descriptor registry
 * (Slice 0a).
 *
 * Pure-logic spec: imports the registry directly and asserts with chai's
 * `expect`. It does not visit the app or require a backend, so it runs against
 * a blank page. Mirrors the existing logic-spec pattern (e.g. tokens.cy.ts).
 */

import {
	EVENT_DESCRIPTORS,
	KNOWN_EVENT_TYPES,
	FALLBACK_DESCRIPTOR,
	EVENT_ICONS,
	getEventDescriptor,
	isKnownEventType,
	familyLabelKey,
	renderEventStrings,
	getEventIcon,
	EventFamily
} from '../../src/components/notificationsCenter/eventDescriptors';
import enCommon from '../../src/resources/i18n/en/common.json';
import deCommon from '../../src/resources/i18n/de/common.json';

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
	'call.started': 'join',
	'call.ended': 'conversation',
	'call.missed': 'conversation'
};

// Resolve a dotted i18n key against a loaded common.json object.
const resolveI18nKey = (obj: any, dottedKey: string): unknown =>
	dottedKey.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);

describe('WP-06 event-descriptor registry', () => {
	it('seeds a descriptor for every existing emitted event type', () => {
		EXISTING_EMITTED_TYPES.forEach((type) => {
			expect(isKnownEventType(type), `known: ${type}`).to.equal(true);
			expect(EVENT_DESCRIPTORS[type], `descriptor: ${type}`).to.exist;
		});
	});

	it('exposes every seeded type via KNOWN_EVENT_TYPES with no duplicates', () => {
		const unique = new Set(KNOWN_EVENT_TYPES);
		expect(unique.size).to.equal(KNOWN_EVENT_TYPES.length);
		EXISTING_EMITTED_TYPES.forEach((type) =>
			expect(KNOWN_EVENT_TYPES).to.include(type)
		);
	});

	it('gives every descriptor a valid family, category, icon and templates', () => {
		KNOWN_EVENT_TYPES.forEach((type) => {
			const d = EVENT_DESCRIPTORS[type];
			expect(d.eventType, `eventType: ${type}`).to.equal(type);
			expect(ALL_FAMILIES, `family: ${type}`).to.include(d.family);
			expect(['system', 'message'], `category: ${type}`).to.include(
				d.category
			);
			// icon id must resolve to a real SVG component
			expect(EVENT_ICONS[d.icon], `icon component: ${type}`).to.exist;
			expect(getEventIcon(d.icon), `getEventIcon: ${type}`).to.exist;
			expect(d.titleTemplate, `title key: ${type}`).to.match(
				/^notifications\.events\./
			);
			expect(d.textTemplate, `text key: ${type}`).to.match(
				/^notifications\.events\./
			);
		});
	});

	it('covers all designed families across the seeded descriptors', () => {
		const seededFamilies = new Set(
			KNOWN_EVENT_TYPES.map((t) => EVENT_DESCRIPTORS[t].family)
		);
		// Appointments are deferred (no seeded types); every other family is present.
		(['requests', 'messages', 'drafts', 'handover', 'calls', 'system'] as EventFamily[]).forEach(
			(fam) => expect(seededFamilies.has(fam), `family seeded: ${fam}`).to.equal(true)
		);
	});

	it('returns the fallback descriptor for unknown / empty types', () => {
		expect(getEventDescriptor('totally.unknown.type')).to.equal(
			FALLBACK_DESCRIPTOR
		);
		expect(getEventDescriptor(null)).to.equal(FALLBACK_DESCRIPTOR);
		expect(getEventDescriptor(undefined)).to.equal(FALLBACK_DESCRIPTOR);
		expect(isKnownEventType('totally.unknown.type')).to.equal(false);
	});

	describe('resolveActionTarget (origin rule)', () => {
		it('resolves the expected target kind for every seeded type', () => {
			KNOWN_EVENT_TYPES.forEach((type) => {
				const target = EVENT_DESCRIPTORS[type].resolveActionTarget({});
				expect(target.kind, `kind: ${type}`).to.equal(
					EXPECTED_TARGET_KIND[type]
				);
			});
		});

		it('chat events target the conversation, honouring actionPath', () => {
			const target = getEventDescriptor('message.new').resolveActionTarget(
				{ actionPath: '/sessions/consultant/sessionView/session/42' }
			);
			expect(target).to.deep.equal({
				kind: 'conversation',
				path: '/sessions/consultant/sessionView/session/42'
			});
		});

		it('builds a conversation path from sourceSessionId + base when no actionPath', () => {
			const target = getEventDescriptor('message.new').resolveActionTarget(
				{ sourceSessionId: 7, sessionsBasePath: '/sessions/user/view' }
			);
			expect(target).to.deep.equal({
				kind: 'conversation',
				path: '/sessions/user/view/session/7'
			});
		});

		it('request-origin events target the request view', () => {
			const target = getEventDescriptor('request.new').resolveActionTarget(
				{ actionPath: '/sessions/consultant/sessionPreview' }
			);
			expect(target.kind).to.equal('request');
			expect((target as any).path).to.equal(
				'/sessions/consultant/sessionPreview'
			);
		});

		it('draft events resume via forcedScopeKey', () => {
			const target = getEventDescriptor('draft.created').resolveActionTarget(
				{ forcedScopeKey: 'scope:session:99|thread:main' }
			);
			expect(target).to.deep.equal({
				kind: 'draft',
				forcedScopeKey: 'scope:session:99|thread:main',
				path: null
			});
		});

		it('live call events resolve to a Join target (no navigation)', () => {
			const target = getEventDescriptor('call.started').resolveActionTarget(
				{ callRoomId: '!room:matrix', isVideo: true }
			);
			expect(target).to.deep.equal({
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
					expect(
						typeof resolveI18nKey(enCommon, key),
						`en ${key}`
					).to.equal('string');
					expect(
						typeof resolveI18nKey(deCommon, key),
						`de ${key}`
					).to.equal('string');
				});
			});
		});

		it('has an English + German label for every family', () => {
			ALL_FAMILIES.forEach((fam) => {
				const key = familyLabelKey(fam);
				expect(resolveI18nKey(enCommon, key), `en ${key}`).to.be.a(
					'string'
				).and.not.be.empty;
				expect(resolveI18nKey(deCommon, key), `de ${key}`).to.be.a(
					'string'
				).and.not.be.empty;
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
			expect(title).to.equal('New message');
			expect(text).to.equal('You received a new message.');
		});

		it('falls back to server-provided text for unknown types', () => {
			const { title, text } = renderEventStrings(
				getEventDescriptor('totally.unknown.type'),
				translate,
				{ fallbackTitle: 'Server-rendered title', fallbackText: 'Server body' }
			);
			// fallback descriptor title template exists ("Activity"); text template
			// is empty, so the server text is used.
			expect(title).to.equal('Activity');
			expect(text).to.equal('Server body');
		});
	});
});
