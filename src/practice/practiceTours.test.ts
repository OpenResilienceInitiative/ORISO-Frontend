import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { describe, expect, it } from 'vite-plus/test';
import deTranslations from '../resources/i18n/de/common.json';
import deInformalTranslations from '../resources/i18n/de@informal/common.json';
import enTranslations from '../resources/i18n/en/common.json';
import frTranslations from '../resources/i18n/fr/common.json';
import ruTranslations from '../resources/i18n/ru/common.json';
import tiTranslations from '../resources/i18n/ti/common.json';
import trTranslations from '../resources/i18n/tr/common.json';
import { frontendTours } from '../components/productTour/tourDefinitions';
import { resolveTourSteps } from '../components/productTour/tourEngine';
import type { TourDefinition } from '../components/productTour/types';
import {
	PRACTICE_ENQUIRIES_ROUTE,
	PRACTICE_LIVE_CHAT_QUEUE_ROUTE,
	PRACTICE_LIVE_CHAT_SETTINGS_ROUTE
} from './practiceRoutes';
import { LIVE_CHAT_QUEUE_PATH } from '../components/app/liveChatRailTarget';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import { PRACTICE_CARD_TOUR_IDS, PRACTICE_TOUR_IDS } from './practiceTourIds';
import {
	isPracticeTourAvailable,
	practiceAcceptTour,
	practiceCalendarTour,
	practiceGroupCircleTour,
	practiceHostedTours,
	practiceLiveChatTour,
	practiceSupervisionTour,
	practiceTours
} from './practiceTours';
import {
	consultantGroupCircleTour,
	GROUP_CIRCLE_SETTINGS_OPENED,
	GROUP_CIRCLE_TOUR_VERSION
} from '../components/productTour/tours/groupCircleTour';
import {
	CALENDAR_TOUR_VERSION,
	consultantCalendarTour
} from '../components/productTour/tours/calendarTour';
import { resolveSupervisionCallFeatureGates } from '../components/call/callFeatureGates';

const resolveKey = (bundle: object, key: string): unknown =>
	key.split('.').reduce<any>((node, part) => node?.[part], bundle);

const bundledLocales: Array<[string, object]> = [
	['de', deTranslations],
	['de@informal', deInformalTranslations],
	['en', enTranslations],
	['fr', frTranslations],
	['ru', ruTranslations],
	['ti', tiTranslations],
	['tr', trTranslations]
];

const resolvesWithFallback = (bundle: object, key: string): boolean =>
	typeof resolveKey(bundle, key) === 'string' ||
	typeof resolveKey(deTranslations, key) === 'string';

const keysOf = (tour: TourDefinition): string[] => [
	tour.titleKey,
	tour.summaryKey,
	...tour.steps.flatMap((s) => [s.titleKey, s.contentKey])
];

const stepIds = (steps: Array<{ id: string }>) => steps.map((s) => s.id);

const TEAM_OFF = { flags: { featureTeamDiscussionEnabled: false } };

describe('practiceTours registry', () => {
	it('holds the one practice card, and every hosted tour under an id the guard allows', () => {
		expect(practiceTours.map((t) => t.id)).toEqual([
			...PRACTICE_CARD_TOUR_IDS
		]);
		// FE#2545: Supervision is a topic tour in Help → Rundgänge now.
		expect([...PRACTICE_CARD_TOUR_IDS]).toEqual([
			'consultant-practice-accept'
		]);
		expect(practiceHostedTours.map((t) => t.id)).toEqual([
			...PRACTICE_TOUR_IDS
		]);
		expect(practiceAcceptTour.id).toBe('consultant-practice-accept');
		expect(practiceSupervisionTour.id).toBe(
			'consultant-practice-supervision'
		);
	});

	it('stays out of frontendTours, which the Help list and its test pin', () => {
		const frontendIds = frontendTours.map((t) => t.id);
		practiceTours.forEach((tour) => {
			expect(frontendIds).not.toContain(tour.id);
			expect(frontendTours).not.toContain(tour);
		});
	});

	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s is a v1 consultant tour that ESC and overlay clicks cannot skip',
		(_id, tour) => {
			expect(tour.version).toBe(1);
			expect(tour.surface).toBe('frontend');
			expect(tour.audiences).toEqual(['consultant']);
			expect(tour.dismissible).toBe(false);
		}
	);

	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s has unique step ids and kebab-case targets',
		(_id, tour) => {
			const ids = stepIds(tour.steps);
			expect(new Set(ids).size).toBe(ids.length);
			tour.steps.forEach((step) => {
				if (step.target) {
					expect(step.target).toMatch(/^[a-z0-9-]+$/);
				}
			});
		}
	);
});

describe('practiceAcceptTour (flow F1)', () => {
	const [first] = practiceAcceptTour.steps;
	const last = practiceAcceptTour.steps[practiceAcceptTour.steps.length - 1];

	it('opens on the Anfragen nav icon with a plain Next', () => {
		expect(first.target).toBe('nav-enquiries');
		expect(first.advanceOn).toBeUndefined();
		expect(first.route).toBeUndefined();
	});

	it('ends on a centered thank-you step', () => {
		expect(last.target).toBe('');
		expect(last.placement).toBe('center');
		expect(last.advanceOn).toBeUndefined();
		expect(last.when).toBeUndefined();
	});

	it('walks the full variant in the spec order', () => {
		expect(stepIds(resolveTourSteps(practiceAcceptTour))).toEqual([
			'nav-enquiries',
			'open-enquiry',
			'accept',
			'first-answer',
			'reply',
			'done'
		]);
	});

	it('walks the same six steps when the Träger switched the team chat off (FE#2491: no team steps)', () => {
		const steps = resolveTourSteps(practiceAcceptTour, TEAM_OFF);
		expect(stepIds(steps)).toEqual([
			'nav-enquiries',
			'open-enquiry',
			'accept',
			'first-answer',
			'reply',
			'done'
		]);
	});

	it('does not depend on the team-chat flag any more', () => {
		const full = stepIds(resolveTourSteps(practiceAcceptTour));
		expect(
			stepIds(resolveTourSteps(practiceAcceptTour, { flags: {} }))
		).toEqual(full);
		expect(
			stepIds(
				resolveTourSteps(practiceAcceptTour, {
					flags: { featureTeamDiscussionEnabled: true }
				})
			)
		).toEqual(full);
	});

	it('is available whatever the supervision flag says', () => {
		expect(
			isPracticeTourAvailable(practiceAcceptTour, {
				featureSupervisionEnabled: false
			})
		).toBe(true);
		expect(
			isPracticeTourAvailable(practiceAcceptTour, TEAM_OFF.flags)
		).toBe(true);
	});

	it('advances on the learner action: click, click, click, event, event', () => {
		const byId = Object.fromEntries(
			practiceAcceptTour.steps.map((s) => [s.id, s])
		);
		expect(byId['open-enquiry'].advanceOn).toEqual({ type: 'click' });
		expect(byId.accept.advanceOn).toEqual({ type: 'click' });
		expect(byId.reply.advanceOn).toEqual({
			type: 'event',
			name: PRACTICE_TOUR_EVENTS.messageSent
		});
		expect(byId['first-answer'].advanceOn).toBeUndefined();
	});

	it('anchors the steps on the practice anchors and the composer', () => {
		expect(
			practiceAcceptTour.steps.map((s) => s.target).filter(Boolean)
		).toEqual([
			'nav-enquiries',
			'enquiry-list-item',
			'enquiry-accept-button',
			'session-composer'
		]);
	});

	it('goes back to the enquiries list for the card step', () => {
		const byId = Object.fromEntries(
			practiceAcceptTour.steps.map((s) => [s.id, s])
		);
		expect(byId['open-enquiry'].route).toBe(
			'/sessions/consultant/sessionPreview'
		);
	});

	it('offers no Back on the step after the accept, which cannot be undone', () => {
		const hidden = practiceAcceptTour.steps.filter((s) => s.hideBack);
		expect(stepIds(hidden)).toEqual(['first-answer']);
	});

	it('gates no step on the team-chat flag (FE#2491: the team chat lives in the menu)', () => {
		expect(practiceAcceptTour.steps.filter((s) => s.when)).toEqual([]);
		expect(practiceAcceptTour.when).toBeUndefined();
	});
});

describe('practiceSupervisionTour (FE#2545, Supervision)', () => {
	const tour = practiceSupervisionTour;
	const step = (id: string) => tour.steps.find((s) => s.id === id)!;
	const de = (key: string) => resolveKey(deTranslations, key) as string;

	it('is the topic tour "Supervision" under the old card id, version 2, practice only', () => {
		expect(tour.id).toBe('consultant-practice-supervision');
		// Version 2 (PO, 25 Nov): new for everyone, also who completed the
		// old card (version 1).
		expect(tour.version).toBe(2);
		expect(tour.titleKey).toBe('tour.supervision.title');
		expect(de(tour.titleKey)).toBe('Supervision');
		expect(practiceTours).not.toContain(tour);
		expect(practiceHostedTours).toContain(tour);
		// No watch-only explanation under the same id any more.
		expect(frontendTours.map((t) => t.id)).not.toContain(tour.id);
	});

	it('is a guided flow: not dismissible, a missing required control stops it', () => {
		expect(tour.dismissible).toBe(false);
		expect(tour.requiredTargetPolicy).toBe('stop');
	});

	it('walks the product owner story in order (2026-11-25)', () => {
		expect(tour.steps.map((s) => [s.id, s.target])).toEqual([
			['intro', ''],
			['open-enquiry', 'enquiry-list-item'],
			['accept', 'enquiry-accept-button'],
			['assigned', ''],
			['find', 'sessions-supervision-chip'],
			['open-panel', 'session-supervision-indicator'],
			['write', 'supervision-panel'],
			['same-access', 'supervision-panel'],
			['change', 'session-supervisor-add'],
			['calls', ''],
			['appointment', 'supervision-panel-menu'],
			['done', '']
		]);
	});

	it('starts on the practice enquiry and acts with the real controls', () => {
		expect(step('open-enquiry').route).toBe(PRACTICE_ENQUIRIES_ROUTE);
		expect(step('open-enquiry').advanceOn).toEqual({ type: 'click' });
		expect(step('accept').advanceOn).toEqual({ type: 'click' });
		expect(step('open-panel').advanceOn).toEqual({ type: 'click' });
		expect(
			tour.steps
				.filter((s) => s.advanceOn?.type === 'event')
				.map((s) => [s.id, (s.advanceOn as { name: string }).name])
		).toEqual([
			['write', PRACTICE_TOUR_EVENTS.supervisionMessageSent],
			['change', PRACTICE_TOUR_EVENTS.supervisorReplaced],
			['appointment', PRACTICE_TOUR_EVENTS.supervisorAppointmentBooked]
		]);
	});

	it('offers no Back where the step before cannot be undone', () => {
		expect(step('assigned').hideBack).toBe(true);
		expect(step('same-access').hideBack).toBe(true);
		expect(step('calls').hideBack).toBe(true);
	});

	it('shows the chip step only where the chip is (optional), everything else is required', () => {
		expect(tour.steps.filter((s) => s.optional).map((s) => s.id)).toEqual([
			'find'
		]);
	});

	it('quotes the real labels: "Supervision", "Supervisor verwalten", the booking entry', () => {
		expect(de(step('find').contentKey)).toMatch(/„Supervision“/);
		expect(de(step('change').contentKey)).toMatch(/„Supervisor verwalten“/);
		expect(de(step('change').contentKey)).toMatch(/„Wechseln“/);
		expect(de(step('appointment').contentKey)).toMatch(
			/„Termin mit Supervisor:in vereinbaren“/
		);
		// The labels themselves, so the copy cannot drift from them.
		expect(de('sessionHeader.supervisor.modal.title')).toBe(
			'Supervisor verwalten'
		);
		expect(de('managePeople.replace.action')).toBe('Wechseln');
		expect(de('supervision.panel.bookAppointment')).toBe(
			'Termin mit Supervisor:in vereinbaren'
		);
		expect(de('sessionList.toolbar.chips.supervision')).toBe('Supervision');
	});

	it('names the standing supervisor and the Admin panel in the intro, as text only', () => {
		const intro = de(step('intro').contentKey);
		expect(intro).toMatch(/Übung/);
		expect(intro).toMatch(/Admin/);
		expect(intro).not.toMatch(/https?:/);
	});

	it('is unavailable (no steps) when the Träger switched supervision off', () => {
		const off = { flags: { featureSupervisionEnabled: false } };
		expect(tour.when).toEqual({ flag: 'featureSupervisionEnabled' });
		expect(resolveTourSteps(tour, off)).toEqual([]);
		expect(isPracticeTourAvailable(tour, {})).toBe(true);
	});

	const SUPERVISION_CALL_FLAGS = [
		'featureCallsEnabled',
		'featureAudioCallsEnabled',
		'featureAudioCallsSupervisionChatsEnabled',
		'featureVideoCallsEnabled',
		'featureVideoCallsSupervisionChatsEnabled'
	] as const;
	const everyCombination = SUPERVISION_CALL_FLAGS.reduce<
		Array<Record<string, boolean>>
	>(
		(combinations, flag) =>
			combinations.flatMap((flags) => [
				{ ...flags, [flag]: true },
				{ ...flags, [flag]: false }
			]),
		[{}]
	);

	it.each(everyCombination.map((flags) => [JSON.stringify(flags), flags]))(
		'books the appointment exactly where the supervision chat allows a call: %s',
		(_name, flags) => {
			const gates = resolveSupervisionCallFeatureGates(flags);
			const ids = stepIds(resolveTourSteps(tour, { flags }));
			expect(ids.includes('appointment')).toBe(
				gates.audio || gates.video
			);
			expect(ids).toHaveLength(gates.audio || gates.video ? 12 : 11);
		}
	);

	it('keeps the one-on-one call keys out of the gate', () => {
		const ids = stepIds(
			resolveTourSteps(tour, {
				flags: {
					featureAudioCallsOneOnOneChatsEnabled: false,
					featureVideoCallsOneOnOneChatsEnabled: false
				}
			})
		);
		expect(ids).toContain('appointment');
	});
});

describe('practice Supervision tour copy', () => {
	const tour = practiceSupervisionTour;
	const both = [['practice', tour]] as const;

	it.each(both)(
		'%s: ships every key natively in every full locale',
		(_name, t) => {
			bundledLocales
				.filter(([locale]) => locale !== 'de@informal')
				.forEach(([locale, bundle]) => {
					keysOf(t).forEach((key) => {
						expect(
							typeof resolveKey(bundle, key),
							`missing ${locale} key ${key}`
						).toBe('string');
					});
				});
		}
	);

	it.each(both)(
		'%s: keeps the informal overlay sparse and complete where de says Sie',
		(_name, t) => {
			keysOf(t).forEach((key) => {
				const de = resolveKey(deTranslations, key) as string;
				const informal = resolveKey(deInformalTranslations, key);
				if (informal !== undefined) {
					expect(informal, `${key} duplicates de`).not.toBe(de);
				}
				if (/\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihnen)\b/.test(de)) {
					expect(
						typeof informal,
						`${key} is formal in de but has no du-form`
					).toBe('string');
				}
			});
		}
	);

	it('keeps practice step intros short (two sentences at most)', () => {
		bundledLocales.forEach(([locale, bundle]) => {
			tour.steps.forEach((s) => {
				const text = resolveKey(bundle, s.contentKey);
				if (typeof text !== 'string') return;
				const sentences = text
					.split(/(?<=[.!?。።])\s+/)
					.filter(Boolean);
				expect(
					sentences.length,
					`${locale} ${s.contentKey} has ${sentences.length} sentences`
				).toBeLessThanOrEqual(2);
			});
		});
	});

	it('says up front that this practice is invented and nothing is sent', () => {
		expect(
			resolveKey(deTranslations, tour.steps[0].contentKey) as string
		).toMatch(/Übung.*erfunden.*nichts wird gesendet oder gespeichert/);
	});

	it('retires the old card copy in every locale', () => {
		bundledLocales.forEach(([locale, bundle]) => {
			[
				'tour.practiceSupervision.step.addSupervisor',
				'tour.practiceSupervision.step.supervisorReply',
				'tour.practiceSupervision.step.standingAssignment',
				'tour.practiceSupervision.step.pickSupervisor',
				'practice.cards.summary.supervision'
			].forEach((key) =>
				expect(
					resolveKey(bundle, key),
					`${locale} still carries ${key}`
				).toBeUndefined()
			);
		});
	});
});

describe('practiceGroupCircleTour (FE#2545, Gesprächskreis anlegen)', () => {
	const tour = practiceGroupCircleTour;
	const step = (id: string) => tour.steps.find((s) => s.id === id)!;

	it('runs under the explanation tour id and version, without a card', () => {
		expect(tour.id).toBe(consultantGroupCircleTour.id);
		expect(tour.version).toBe(GROUP_CIRCLE_TOUR_VERSION);
		expect(tour.version).toBe(consultantGroupCircleTour.version);
		expect(practiceTours).not.toContain(tour);
		expect(practiceHostedTours).toContain(tour);
		expect(tour.when).toEqual(consultantGroupCircleTour.when);
	});

	it('is a guided flow: not dismissible, a missing required control stops it', () => {
		expect(tour.dismissible).toBe(false);
		expect(tour.requiredTargetPolicy).toBe('stop');
	});

	it('creates, opens and starts a circle, then shows the call button', () => {
		expect(tour.steps.map((s) => [s.id, s.target])).toEqual([
			['intro', ''],
			['create', 'groupchat-create-button'],
			['format', 'groupchat-format-circle'],
			['topic', 'groupchat-topic-picker'],
			['configure', 'groupchat-circle-settings'],
			['settings', 'groupchat-circle-create'],
			['open-circle', 'groupchat-list-item'],
			['start', 'groupchat-start-button'],
			['call', 'groupchat-call-button'],
			['done', '']
		]);
	});

	it('advances on the learner action: click, event, event, click, event, event', () => {
		expect(
			tour.steps
				.filter((s) => s.advanceOn)
				.map((s) => [s.id, s.advanceOn])
		).toEqual([
			['create', { type: 'click' }],
			['topic', { type: 'event', name: GROUP_CIRCLE_SETTINGS_OPENED }],
			[
				'settings',
				{ type: 'event', name: PRACTICE_TOUR_EVENTS.circleCreated }
			],
			['open-circle', { type: 'click' }],
			[
				'start',
				{ type: 'event', name: PRACTICE_TOUR_EVENTS.circleStarted }
			],
			[
				'call',
				{ type: 'event', name: PRACTICE_TOUR_EVENTS.circleCallStarted }
			]
		]);
	});

	it('goes on when the call button was used: the simulated start, no call (D3)', () => {
		expect(step('call').target).toBe('groupchat-call-button');
		expect(step('call').advanceOn).toEqual({
			type: 'event',
			name: PRACTICE_TOUR_EVENTS.circleCallStarted
		});
	});

	it('lets the counsellor fill the settings card before "Erstellen", and go back to it', () => {
		const configure = step('configure');
		expect(configure.advanceOn).toBeUndefined();
		expect(configure.interactive).toBe(true);
		expect(configure.optional).toBeFalsy();
		// "Erstellen" stays disabled without a Beratungsstelle: Back must
		// bring the counsellor to the card again.
		expect(step('settings').hideBack).toBeFalsy();
		const ids = tour.steps.map((s) => s.id);
		expect(ids.indexOf('configure') + 1).toBe(ids.indexOf('settings'));
	});

	it('keeps the format card and topic picker optional, like the explanation tour', () => {
		expect(tour.steps.filter((s) => s.optional).map((s) => s.id)).toEqual([
			'format',
			'topic'
		]);
	});

	it('offers no Back after an action that cannot be undone', () => {
		expect(tour.steps.filter((s) => s.hideBack).map((s) => s.id)).toEqual([
			'open-circle',
			'call'
		]);
	});

	it('starts in the counsellor sessions, where "Erstellen" lives', () => {
		expect(step('create').route).toBe('/sessions/consultant/sessionView');
		expect(step('open-circle').route).toBe(
			'/sessions/consultant/sessionView'
		);
	});

	it('says up front that this is an exercise and nothing is real', () => {
		const de = (key: string) => resolveKey(deTranslations, key) as string;
		expect(de(tour.steps[0].contentKey)).toMatch(
			/Übung.*erfunden.*nichts wird gesendet oder gespeichert/
		);
	});

	it('ships its copy in every full locale and a sparse du-form overlay', () => {
		bundledLocales
			.filter(([locale]) => locale !== 'de@informal')
			.forEach(([locale, bundle]) => {
				keysOf(tour).forEach((key) => {
					expect(
						typeof resolveKey(bundle, key),
						`missing ${locale} key ${key}`
					).toBe('string');
				});
			});
		keysOf(tour).forEach((key) => {
			const de = resolveKey(deTranslations, key) as string;
			const informal = resolveKey(deInformalTranslations, key);
			if (informal !== undefined) {
				expect(informal, `${key} duplicates de`).not.toBe(de);
			}
			if (/\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihnen)\b/.test(de)) {
				expect(
					typeof informal,
					`${key} is formal in de but has no du-form`
				).toBe('string');
			}
		});
	});
});

describe('practiceCalendarTour (FE#2545, Kalender)', () => {
	const tour = practiceCalendarTour;
	const step = (id: string) => tour.steps.find((s) => s.id === id)!;

	it('runs under the explanation tour id and version, without a card', () => {
		expect(tour.id).toBe(consultantCalendarTour.id);
		expect(tour.version).toBe(CALENDAR_TOUR_VERSION);
		expect(tour.version).toBe(consultantCalendarTour.version);
		expect(practiceTours).not.toContain(tour);
		expect(practiceHostedTours).toContain(tour);
	});

	it('is a guided flow: not dismissible, a missing required control stops it', () => {
		expect(tour.dismissible).toBe(false);
		expect(tour.requiredTargetPolicy).toBe('stop');
	});

	it('enters an appointment and a Terminlink, cancels one, enters a Sperrzeit and switches automatic confirmation on', () => {
		expect(tour.steps.map((s) => [s.id, s.target])).toEqual([
			['intro', ''],
			['appointment', 'calendar-create'],
			['invitation', 'calendar-create'],
			['cancel', 'calendar-upcoming'],
			['blocker', 'calendar-create'],
			['auto-accept', 'calendar-settings'],
			['done', '']
		]);
	});

	it('waits for each saved result in the practice world, never for a click on the button', () => {
		expect(
			tour.steps
				.filter((s) => s.advanceOn)
				.map((s) => [s.id, s.advanceOn])
		).toEqual([
			[
				'appointment',
				{
					type: 'event',
					name: PRACTICE_TOUR_EVENTS.calendarAppointmentCreated
				}
			],
			[
				'invitation',
				{
					type: 'event',
					name: PRACTICE_TOUR_EVENTS.calendarInvitationCreated
				}
			],
			[
				'cancel',
				{
					type: 'event',
					name: PRACTICE_TOUR_EVENTS.calendarAppointmentCancelled
				}
			],
			[
				'blocker',
				{
					type: 'event',
					name: PRACTICE_TOUR_EVENTS.calendarBlockerCreated
				}
			],
			[
				'auto-accept',
				{
					type: 'event',
					name: PRACTICE_TOUR_EVENTS.calendarAutoAcceptOn
				}
			]
		]);
	});

	it('works on "Meine Termine" throughout', () => {
		tour.steps
			.filter((s) => s.target)
			.forEach((s) => expect(s.route).toBe('/booking/events'));
	});

	it('drops the Terminlink step where the Träger switched video invitations off', () => {
		const ids = (flags: Record<string, unknown>) =>
			stepIds(resolveTourSteps(tour, { flags }));
		expect(ids({})).toContain('invitation');
		expect(ids({ featureDirectInviteVideoEnabled: false })).toEqual([
			'intro',
			'appointment',
			'cancel',
			'blocker',
			'auto-accept',
			'done'
		]);
		expect(step('appointment').when).toBeUndefined();
	});

	it('says up front that this is an exercise and nothing is real', () => {
		const de = (key: string) => resolveKey(deTranslations, key) as string;
		expect(de(tour.steps[0].contentKey)).toMatch(
			/Übung.*erfunden.*nichts wird gesendet oder gespeichert/
		);
	});

	it('names the real controls in its German copy', () => {
		const de = (key: string) => resolveKey(deTranslations, key) as string;
		expect(de(step('invitation').contentKey)).toContain(
			resolveKey(deTranslations, 'directInvitation.dialog.inviteOthers')
		);
		expect(de(step('cancel').contentKey)).toContain(
			resolveKey(deTranslations, 'calendar.upcoming')
		);
		expect(de(step('auto-accept').contentKey)).toContain(
			resolveKey(deTranslations, 'calendar.consultationHours.autoAccept')
		);
	});

	it('ships its copy in every full locale, two sentences at most, and a sparse du-form overlay', () => {
		bundledLocales
			.filter(([locale]) => locale !== 'de@informal')
			.forEach(([locale, bundle]) => {
				keysOf(tour).forEach((key) => {
					expect(
						typeof resolveKey(bundle, key),
						`missing ${locale} key ${key}`
					).toBe('string');
				});
			});
		bundledLocales.forEach(([locale, bundle]) =>
			tour.steps.forEach((s) => {
				const text = resolveKey(bundle, s.contentKey);
				if (typeof text !== 'string') return;
				expect(
					text.split(/(?<=[.!?。።])\s+/).filter(Boolean).length,
					`${locale} ${s.contentKey}`
				).toBeLessThanOrEqual(2);
			})
		);
		keysOf(tour).forEach((key) => {
			const de = resolveKey(deTranslations, key) as string;
			const informal = resolveKey(deInformalTranslations, key);
			if (informal !== undefined) {
				expect(informal, `${key} duplicates de`).not.toBe(de);
			}
			if (/\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihnen)\b/.test(de)) {
				expect(
					typeof informal,
					`${key} is formal in de but has no du-form`
				).toBe('string');
			}
		});
	});
});

describe('practiceLiveChatTour (FE#2545)', () => {
	const step = (id: string) =>
		practiceLiveChatTour.steps.find((s) => s.id === id)!;

	it('switches availability on before the queue', () => {
		expect(stepIds(practiceLiveChatTour.steps)).toEqual([
			'intro',
			'availability',
			'queue',
			'open-request',
			'accept',
			'reply',
			'done'
		]);
	});

	it('points at the control the counsellor uses, on the settings page, and waits for the practice switch-on', () => {
		const availability = step('availability');
		expect(availability.route).toBe(PRACTICE_LIVE_CHAT_SETTINGS_ROUTE);
		expect(availability.target).toBe('livechat-availability-control');
		// Required: whichever preference, exactly one control carries it.
		expect(availability.optional).toBeFalsy();
		expect(availability.advanceOn).toEqual({
			type: 'event',
			name: PRACTICE_TOUR_EVENTS.liveChatAvailable
		});
	});

	it('goes on where switching on lands: the queue with the live-chat filter on', () => {
		expect(PRACTICE_LIVE_CHAT_QUEUE_ROUTE).toBe(LIVE_CHAT_QUEUE_PATH);
		expect(step('queue').route).toBe(PRACTICE_LIVE_CHAT_QUEUE_ROUTE);
		// The filter is already on: a click would switch it off.
		expect(step('queue').advanceOn).toBeUndefined();
		expect(step('open-request').route).toBe(PRACTICE_LIVE_CHAT_QUEUE_ROUTE);
	});

	it('ships the availability copy in every full locale, du-form in the overlay only', () => {
		const { titleKey, contentKey } = step('availability');
		bundledLocales
			.filter(([locale]) => locale !== 'de@informal')
			.forEach(([locale, bundle]) => {
				[titleKey, contentKey].forEach((key) =>
					expect(
						typeof resolveKey(bundle, key),
						`missing ${locale} key ${key}`
					).toBe('string')
				);
			});
		expect(resolveKey(deTranslations, contentKey)).toMatch(/\bSie\b/);
		expect(resolveKey(deInformalTranslations, titleKey)).toBeUndefined();
		expect(resolveKey(deInformalTranslations, contentKey)).toMatch(
			/\bdein\b/
		);
	});
});

describe('practice tour wiring', () => {
	// Anchors are rendered by components that this unit test cannot mount, so
	// it reads the sources: a renamed or removed anchor must break here, not in
	// front of a learner.
	const componentSources = globSync('src/components/**/*.{ts,tsx}', {
		ignore: [
			'**/*.test.*',
			'**/*.stories.*',
			'src/components/productTour/**'
		]
	})
		// The navigation renders `nav-<slug>` from this map (FE#2340); it is
		// the one productTour file that holds rendered anchors, not tours.
		.concat('src/components/productTour/tourCatalogue.ts')
		.map((path) => readFileSync(path, 'utf8'));

	const targetsOf = (tour: TourDefinition): string[] =>
		tour.steps.flatMap((step) => {
			const clickTarget =
				step.advanceOn?.type === 'click'
					? (step.advanceOn.target ?? step.target)
					: undefined;
			return [step.target, clickTarget].filter(Boolean) as string[];
		});

	it.each(practiceHostedTours.map((t) => [t.id, t] as const))(
		'%s: every target and click target exists in a component',
		(_id, tour) => {
			targetsOf(tour).forEach((anchor) => {
				expect(
					componentSources.some(
						(source) =>
							source.includes(`'${anchor}'`) ||
							source.includes(`"${anchor}"`)
					),
					`no component renders the anchor ${anchor}`
				).toBe(true);
			});
		}
	);

	it.each(practiceHostedTours.map((t) => [t.id, t] as const))(
		'%s: a click step has something to click',
		(_id, tour) => {
			tour.steps
				.filter((s) => s.advanceOn?.type === 'click')
				.forEach((step) => {
					const target =
						(step.advanceOn as { target?: string }).target ??
						step.target;
					expect(
						target,
						`click step ${step.id} has no target`
					).toBeTruthy();
				});
		}
	);

	it.each(practiceHostedTours.map((t) => [t.id, t] as const))(
		'%s: every event step waits for a named practice event',
		(_id, tour) => {
			const known = [
				...Object.values(PRACTICE_TOUR_EVENTS),
				// Emitted by the circle settings themselves (FE#2545).
				GROUP_CIRCLE_SETTINGS_OPENED
			] as string[];
			tour.steps
				.filter((s) => s.advanceOn?.type === 'event')
				.forEach((step) => {
					expect(known).toContain(
						(step.advanceOn as { name: string }).name
					);
				});
		}
	);
});

describe('practice tour copy', () => {
	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s resolves every key in every bundled locale (incl. fallback)',
		(_id, tour) => {
			bundledLocales.forEach(([locale, bundle]) => {
				keysOf(tour).forEach((key) => {
					expect(
						resolvesWithFallback(bundle, key),
						`key ${key} unresolvable for ${locale}`
					).toBe(true);
				});
			});
		}
	);

	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s ships its copy natively in every full locale',
		(_id, tour) => {
			// de@informal is a sparse overlay by contract (#1101): only values
			// that differ from `de`.
			bundledLocales
				.filter(([locale]) => locale !== 'de@informal')
				.forEach(([locale, bundle]) => {
					keysOf(tour).forEach((key) => {
						expect(
							typeof resolveKey(bundle, key),
							`missing ${locale} key ${key}`
						).toBe('string');
					});
				});
		}
	);

	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s keeps the informal overlay sparse and complete where de says Sie',
		(_id, tour) => {
			keysOf(tour).forEach((key) => {
				const de = resolveKey(deTranslations, key) as string;
				expect(typeof de, `missing de key ${key}`).toBe('string');
				const informal = resolveKey(deInformalTranslations, key);
				if (informal !== undefined) {
					expect(informal, `${key} duplicates de`).not.toBe(de);
				}
				if (/\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihnen)\b/.test(de)) {
					expect(
						typeof informal,
						`${key} is formal in de but has no du-form`
					).toBe('string');
				}
			});
		}
	);

	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s names itself an exercise and says up front that nothing is real',
		(_id, tour) => {
			const de = (key: string) =>
				resolveKey(deTranslations, key) as string;
			expect(de(tour.titleKey)).toMatch(/Übung/);
			expect(de(tour.summaryKey)).toMatch(/erfunden/);
			expect(de(tour.steps[0].contentKey)).toMatch(
				/Übung.*erfunden.*nichts wird gesendet oder gespeichert/
			);
		}
	);

	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s keeps step intros short (two sentences at most)',
		(_id, tour) => {
			bundledLocales.forEach(([locale, bundle]) => {
				tour.steps.forEach((step) => {
					const text = resolveKey(bundle, step.contentKey);
					if (typeof text !== 'string') {
						return;
					}
					const sentences = text
						.split(/(?<=[.!?。።])\s+/)
						.filter(Boolean);
					expect(
						sentences.length,
						`${locale} ${step.contentKey} has ${sentences.length} sentences`
					).toBeLessThanOrEqual(2);
				});
			});
		}
	);
});
