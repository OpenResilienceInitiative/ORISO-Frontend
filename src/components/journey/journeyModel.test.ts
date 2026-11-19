import { describe, expect, it } from 'vite-plus/test';
import {
	OTHER_OPTION,
	answerSummary,
	choose,
	emptyAnswers,
	isQuestionAnswered,
	missingRequired,
	textIn
} from './journeyModel';
import {
	arrivalStep,
	situation,
	situationStep,
	worries
} from './journeyFixtures';

describe('journey texts (#2333)', () => {
	it('reads the reader language, then formal German for informal, then German, then English', () => {
		expect(textIn({ de: 'Hallo', en: 'Hello' }, 'en')).toBe('Hello');
		expect(textIn({ de: 'Hallo Sie' }, 'de@informal')).toBe('Hallo Sie');
		expect(textIn({ de: 'Hallo', en: 'Hello' }, 'tr')).toBe('Hallo');
		expect(textIn({ en: 'Hello' }, 'fr')).toBe('Hello');
		expect(textIn(undefined, 'de')).toBe('');
	});
});

describe('answering a journey step', () => {
	it('a single choice keeps one option and drops the "something else" text with it', () => {
		const other = choose(situation, undefined, OTHER_OPTION);
		const withText = { ...other, text: 'Bürgschaft' };
		expect(isQuestionAnswered(situation, withText)).toBe(true);
		expect(choose(situation, withText, 'letters')).toEqual({
			choices: ['letters'],
			text: undefined
		});
	});

	it('"something else" without its text is not an answer', () => {
		expect(isQuestionAnswered(situation, { choices: [OTHER_OPTION] })).toBe(
			false
		);
	});

	it('a multiple choice toggles options', () => {
		const one = choose(worries, undefined, 'rent');
		const two = choose(worries, one, 'energy');
		expect(two.choices).toEqual(['rent', 'energy']);
		expect(choose(worries, two, 'rent').choices).toEqual(['energy']);
	});

	it('names the required questions and ratings still open', () => {
		expect(missingRequired(situationStep, emptyAnswers())).toEqual([
			'situation'
		]);
		expect(missingRequired(arrivalStep, emptyAnswers())).toEqual([
			'satisfaction'
		]);
		expect(
			missingRequired(arrivalStep, {
				questions: {},
				ratings: { satisfaction: 4 }
			})
		).toEqual([]);
	});

	it('sums up what was answered, in the reader language', () => {
		const answers = {
			questions: {
				situation: { choices: [OTHER_OPTION], text: 'Bürgschaft' },
				worries: { choices: ['rent'] }
			},
			ratings: {}
		};
		expect(
			answerSummary(situationStep, answers, 'en', 'Something else')
		).toEqual([
			{
				id: 'situation',
				label: 'How would you describe your situation?',
				value: 'Something else: Bürgschaft'
			},
			{
				id: 'worries',
				label: 'What weighs on you most right now?',
				value: 'Rent'
			}
		]);
		expect(
			answerSummary(
				arrivalStep,
				{ questions: {}, ratings: { satisfaction: 3, feeling: -2 } },
				'de',
				''
			)
		).toEqual([
			{
				id: 'satisfaction',
				label: 'Wie zufrieden sind Sie mit der Beratung?',
				value: '★★★☆☆'
			},
			{ id: 'feeling', label: 'Wie geht es Ihnen jetzt?', value: '-2' }
		]);
	});
});
