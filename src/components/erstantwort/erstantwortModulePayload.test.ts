// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import {
	ERSTANTWORT_MODULE_PAYLOAD_VERSION,
	parseErstantwortModule
} from './erstantwortModulePayload';
import { parseErstantwortPayload } from './erstantwortPayload';

const event = (payload: unknown) =>
	`${SYSTEM_NOTIFICATION_PREFIX} ${JSON.stringify(payload)}`;

const v2 = (sections: unknown[], extra: Record<string, unknown> = {}) =>
	event({
		type: 'FIRST_RESPONSE',
		version: ERSTANTWORT_MODULE_PAYLOAD_VERSION,
		conversationType: 'AGENCY_COUNSELLING',
		sections,
		...extra
	});

describe('parseErstantwortModule (ADR-036 decision 8)', () => {
	it('ignores everything that is not a version-2 FIRST_RESPONSE event', () => {
		expect(parseErstantwortModule('hello').status).toBe('none');
		expect(
			parseErstantwortModule(
				event({ type: 'FIRST_RESPONSE', version: 1, bausteine: [] })
			).status
		).toBe('none');
		expect(
			parseErstantwortModule(event({ type: 'OTHER', version: 2 })).status
		).toBe('none');
	});

	it('keeps version-1 events on the existing parser, untouched', () => {
		const raw = event({
			type: 'FIRST_RESPONSE',
			version: 1,
			bausteine: [{ id: 'greeting', body: 'Hallo' }]
		});
		expect(parseErstantwortPayload(raw).status).toBe('ok');
		expect(parseErstantwortModule(raw).status).toBe('none');
	});

	it('keeps the section order and the four kinds', () => {
		const parsed = parseErstantwortModule(
			v2([
				{ id: 'a', kind: 'message', body: 'Hallo' },
				{
					id: 'b',
					kind: 'panel',
					title: 'Wer liest mit?',
					display: 'collapsed',
					body: 'Nur Ihre Beratungsstelle.'
				},
				{ id: 'c', kind: 'fixed', module: 'email' },
				{
					id: 'd',
					kind: 'questions',
					display: 'open',
					trigger: 'withGreeting',
					questions: [
						{
							id: 'age',
							version: 1,
							type: 'text',
							required: false,
							label: 'Wie alt sind Sie?'
						}
					]
				}
			])
		);
		expect(parsed.status).toBe('ok');
		expect(parsed.conversationType).toBe('AGENCY_COUNSELLING');
		expect(parsed.sections.map((section) => section.kind)).toEqual([
			'message',
			'panel',
			'fixed',
			'questions'
		]);
	});

	it('drops sections it cannot render instead of rendering them empty', () => {
		const parsed = parseErstantwortModule(
			v2([
				{ id: 'blank', kind: 'message', body: '   ' },
				{ id: 'untitled', kind: 'panel', body: 'Text ohne Titel' },
				{ id: 'unknown', kind: 'video', body: 'x' },
				{ id: 'module', kind: 'fixed', module: 'paymentForm' },
				{ id: 'noQuestions', kind: 'questions', questions: [] },
				{ id: 'ok', kind: 'message', body: 'Bleibt' }
			])
		);
		expect(parsed.sections.map((section) => section.id)).toEqual(['ok']);
	});

	it('defaults a panel to collapsed and a question block to "with the greeting"', () => {
		const parsed = parseErstantwortModule(
			v2([
				{ id: 'p', kind: 'panel', title: 'T', body: 'B' },
				{
					id: 'q',
					kind: 'questions',
					questions: [
						{ id: 'x', version: 1, type: 'hint', label: 'Hinweis' }
					]
				}
			])
		);
		const [panel, questions] = parsed.sections;
		expect(panel.kind === 'panel' && panel.display).toBe('collapsed');
		expect(questions.kind === 'questions' && questions.trigger).toBe(
			'withGreeting'
		);
	});

	it('normalises questions: choice needs two options, a hint is never required, dropdown only for single', () => {
		const parsed = parseErstantwortModule(
			v2([
				{
					id: 'q',
					kind: 'questions',
					questions: [
						{
							id: 'one',
							version: 3,
							type: 'single',
							display: 'dropdown',
							required: true,
							label: 'Bundesland',
							options: [
								{ id: 'by', label: 'Bayern' },
								{ id: 'be', label: 'Berlin' }
							]
						},
						{
							id: 'tooFew',
							version: 1,
							type: 'multi',
							label: 'Nur eine Option',
							options: [{ id: 'a', label: 'A' }]
						},
						{
							id: 'hint',
							version: 1,
							type: 'hint',
							required: true,
							label: 'Nur ein Hinweis'
						},
						{
							id: 'multiDropdown',
							version: 1,
							type: 'multi',
							display: 'dropdown',
							label: 'Mehrere',
							options: [
								{ id: 'a', label: 'A' },
								{ id: 'b', label: 'B' }
							]
						}
					]
				}
			])
		);
		const block = parsed.sections[0];
		if (block.kind !== 'questions') throw new Error('expected questions');
		expect(block.questions.map((question) => question.id)).toEqual([
			'one',
			'hint',
			'multiDropdown'
		]);
		expect(block.questions[0]).toMatchObject({
			version: 3,
			display: 'dropdown',
			required: true
		});
		expect(block.questions[1].required).toBe(false);
		expect(block.questions[2].display).toBeUndefined();
	});

	it('keeps "Etwas anderes" for choices only', () => {
		const parsed = parseErstantwortModule(
			v2([
				{
					id: 'q',
					kind: 'questions',
					questions: [
						{
							id: 'choice',
							type: 'single',
							label: 'Lage',
							other: true,
							options: [
								{ id: 'a', label: 'A' },
								{ id: 'b', label: 'B' }
							]
						},
						{
							id: 'text',
							type: 'text',
							label: 'Freitext',
							other: true
						}
					]
				}
			])
		);
		const block = parsed.sections[0];
		if (block.kind !== 'questions') throw new Error('expected questions');
		expect(block.questions[0].other).toBe(true);
		expect(block.questions[1].other).toBeUndefined();
	});

	it('marks a safety panel, so the renderer can draw it as the emergency row', () => {
		const parsed = parseErstantwortModule(
			v2([
				{
					id: 'e',
					kind: 'panel',
					title: 'Notfallnummern',
					body: '112',
					safety: true
				}
			])
		);
		const [panel] = parsed.sections;
		expect(panel.kind === 'panel' && panel.safety).toBe(true);
	});
});
