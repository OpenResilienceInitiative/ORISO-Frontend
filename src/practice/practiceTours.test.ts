import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
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
import { practiceAcceptedSessionRoute } from './practiceRoutes';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import { PRACTICE_TOUR_IDS } from './practiceTourIds';
import {
	isPracticeTourAvailable,
	practiceAcceptTour,
	practiceSupervisionTour,
	practiceTours
} from './practiceTours';

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
	it('holds the two practice tours under the ids the guard allows', () => {
		expect(practiceTours.map((t) => t.id)).toEqual([...PRACTICE_TOUR_IDS]);
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
			'open-team',
			'team-reply',
			'accept',
			'first-answer',
			'reply',
			'done'
		]);
	});

	it('drops exactly the two team steps when the Träger switched the team discussion off', () => {
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

	it('keeps the team steps while the flag is unset or on (unset counts as ON)', () => {
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
		expect(byId['open-team'].advanceOn).toEqual({ type: 'click' });
		expect(byId['team-reply'].advanceOn).toEqual({
			type: 'event',
			name: PRACTICE_TOUR_EVENTS.teamMessageSent
		});
		expect(byId.accept.advanceOn).toEqual({ type: 'click' });
		expect(byId.reply.advanceOn).toEqual({
			type: 'event',
			name: PRACTICE_TOUR_EVENTS.messageSent
		});
		expect(byId['first-answer'].advanceOn).toBeUndefined();
	});

	it('anchors the steps on the five practice anchors plus the team button and the composer', () => {
		expect(
			practiceAcceptTour.steps.map((s) => s.target).filter(Boolean)
		).toEqual([
			'nav-enquiries',
			'enquiry-list-item',
			'enquiry-team-button',
			'team-discussion-panel',
			'enquiry-accept-button',
			'session-composer'
		]);
	});

	it('goes back to the enquiries list for the card step and to the open enquiry for the team button', () => {
		const byId = Object.fromEntries(
			practiceAcceptTour.steps.map((s) => [s.id, s])
		);
		expect(byId['open-enquiry'].route).toBe(
			'/sessions/consultant/sessionPreview'
		);
		expect(byId['open-team'].route).toBe(
			'/sessions/consultant/sessionPreview/session/-1'
		);
	});

	it('offers no Back on the step after the accept, which cannot be undone', () => {
		const hidden = practiceAcceptTour.steps.filter((s) => s.hideBack);
		expect(stepIds(hidden)).toEqual(['first-answer']);
	});

	it('gates only the team steps on the team-discussion flag', () => {
		const gated = practiceAcceptTour.steps.filter((s) => s.when);
		expect(stepIds(gated)).toEqual(['open-team', 'team-reply']);
		gated.forEach((s) =>
			expect(s.when).toEqual({ flag: 'featureTeamDiscussionEnabled' })
		);
		expect(practiceAcceptTour.when).toBeUndefined();
	});

	it('warns about the team discussion closing in the team step, before accepting', () => {
		const teamReply = practiceAcceptTour.steps.find(
			(s) => s.id === 'team-reply'
		)!;
		expect(
			resolveKey(deTranslations, teamReply.contentKey) as string
		).toMatch(/Team-?[Bb]esprechung.*(geschlossen|schließt|endet)/);
	});
});

describe('practiceSupervisionTour (flow F2)', () => {
	const [first] = practiceSupervisionTour.steps;
	const last =
		practiceSupervisionTour.steps[practiceSupervisionTour.steps.length - 1];

	it('opens on the supervisor "+" inside the accepted practice case', () => {
		expect(first.target).toBe('session-supervisor-add');
		expect(first.route).toBe(practiceAcceptedSessionRoute());
	});

	it('waits for the confirmed add, not for the click on the "+"', () => {
		// The real picker dialog covers the tooltip, so the
		// first step explains the whole add and lets the confirm advance it.
		expect(first.advanceOn).toEqual({
			type: 'event',
			name: PRACTICE_TOUR_EVENTS.supervisorAdded
		});
	});

	it('ends on a centered final step', () => {
		expect(last.target).toBe('');
		expect(last.placement).toBe('center');
		expect(last.advanceOn).toBeUndefined();
	});

	it('walks the four steps', () => {
		expect(stepIds(resolveTourSteps(practiceSupervisionTour))).toEqual([
			'add-supervisor',
			'supervisor-reply',
			'standing-assignment',
			'done'
		]);
	});

	it('points the reply step at the supervision side panel and offers no Back after the add', () => {
		const reply = practiceSupervisionTour.steps[1];
		expect(reply.target).toBe('supervision-panel');
		expect(reply.placement).toBe('left');
		expect(reply.hideBack).toBe(true);
		expect(reply.advanceOn).toBeUndefined();
	});

	it('is read-only after the add: replies and the standing assignment advance with Next', () => {
		practiceSupervisionTour.steps.slice(1, 3).forEach((step) => {
			expect(step.advanceOn).toBeUndefined();
		});
	});

	it('is unavailable (no steps) when the Träger switched supervision off, available when unset', () => {
		const off = { flags: { featureSupervisionEnabled: false } };
		expect(practiceSupervisionTour.when).toEqual({
			flag: 'featureSupervisionEnabled'
		});
		expect(resolveTourSteps(practiceSupervisionTour, off)).toEqual([]);
		expect(
			isPracticeTourAvailable(practiceSupervisionTour, off.flags)
		).toBe(false);
		expect(isPracticeTourAvailable(practiceSupervisionTour, {})).toBe(true);
		expect(isPracticeTourAvailable(practiceSupervisionTour)).toBe(true);
		expect(
			isPracticeTourAvailable(practiceSupervisionTour, {
				featureSupervisionEnabled: true
			})
		).toBe(true);
	});

	it('does not depend on the team-discussion flag', () => {
		expect(
			stepIds(resolveTourSteps(practiceSupervisionTour, TEAM_OFF))
		).toHaveLength(4);
	});

	it('tells the learner up front to click, choose and confirm', () => {
		const intro = resolveKey(deTranslations, first.contentKey) as string;
		expect(intro).toMatch(/„\+“/);
		expect(intro).toMatch(/bestätigen/);
	});

	// The add dialog refuses to confirm without a reason (reasonError); the
	// words are those of its reason field in each language.
	it.each([
		['de', deTranslations, /Grund/],
		['de@informal', deInformalTranslations, /Grund/],
		['en', enTranslations, /reason/],
		['fr', frTranslations, /motif/],
		['ru', ruTranslations, /причин/],
		['ti', tiTranslations, /ምኽንያት/],
		['tr', trTranslations, /neden/]
	] as const)(
		'asks for the short reason the add dialog requires (%s)',
		(_locale, bundle, reasonWord) => {
			expect(resolveKey(bundle, first.contentKey) as string).toMatch(
				reasonWord
			);
		}
	);

	it('keeps the retired picker step out of every locale', () => {
		bundledLocales.forEach(([locale, bundle]) => {
			expect(
				resolveKey(
					bundle,
					'tour.practiceSupervision.step.pickSupervisor'
				),
				`${locale} still carries pickSupervisor`
			).toBeUndefined();
		});
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
	}).map((path) => readFileSync(path, 'utf8'));

	const targetsOf = (tour: TourDefinition): string[] =>
		tour.steps.flatMap((step) => {
			const clickTarget =
				step.advanceOn?.type === 'click'
					? (step.advanceOn.target ?? step.target)
					: undefined;
			return [step.target, clickTarget].filter(Boolean) as string[];
		});

	it.each(practiceTours.map((t) => [t.id, t] as const))(
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

	it.each(practiceTours.map((t) => [t.id, t] as const))(
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

	it.each(practiceTours.map((t) => [t.id, t] as const))(
		'%s: every event step waits for a named practice event',
		(_id, tour) => {
			const known = Object.values(PRACTICE_TOUR_EVENTS) as string[];
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
