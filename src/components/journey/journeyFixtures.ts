import type {
	Journey,
	JourneyQuestion,
	JourneyRating,
	JourneyStep
} from './journeyModel';

/** Story and test data: what UserService answers for a debt-counselling journey. */
export const situation: JourneyQuestion = {
	id: 'situation',
	type: 'single',
	required: true,
	label: {
		de: 'Wie würden Sie Ihre Lage beschreiben?',
		en: 'How would you describe your situation?'
	},
	help: { de: 'Das hilft der Beratungsstelle, sich vorzubereiten.' },
	options: [
		{
			id: 'overview',
			label: {
				de: 'Ich habe den Überblick verloren',
				en: 'I have lost track'
			}
		},
		{
			id: 'letters',
			label: {
				de: 'Mahnungen oder Inkasso',
				en: 'Reminders or debt collection'
			}
		},
		{
			id: 'seizure',
			label: {
				de: 'Pfändung oder Kontosperre',
				en: 'Seizure or blocked account'
			}
		}
	],
	other: true,
	version: 1
};

export const worries: JourneyQuestion = {
	id: 'worries',
	type: 'multi',
	required: false,
	label: {
		de: 'Was belastet Sie gerade am meisten?',
		en: 'What weighs on you most right now?'
	},
	options: [
		{ id: 'rent', label: { de: 'Miete', en: 'Rent' } },
		{ id: 'energy', label: { de: 'Strom und Heizung', en: 'Energy' } },
		{ id: 'family', label: { de: 'Familie', en: 'Family' } }
	],
	other: true,
	version: 1
};

export const since: JourneyQuestion = {
	id: 'since',
	type: 'single',
	display: 'dropdown',
	required: false,
	label: { de: 'Seit wann?', en: 'Since when?' },
	options: [
		{ id: 'weeks', label: { de: 'Einige Wochen', en: 'A few weeks' } },
		{ id: 'months', label: { de: 'Einige Monate', en: 'A few months' } },
		{
			id: 'years',
			label: { de: 'Länger als ein Jahr', en: 'More than a year' }
		}
	],
	version: 1
};

export const note: JourneyQuestion = {
	id: 'note',
	type: 'text',
	required: false,
	label: {
		de: 'Möchten Sie noch etwas sagen?',
		en: 'Anything else you want to say?'
	},
	options: [],
	version: 1
};

export const privacyHint: JourneyQuestion = {
	id: 'hint',
	type: 'hint',
	required: false,
	label: { de: 'Ihre Angaben sieht nur die Beratungsstelle.' },
	help: {
		de: 'Sie können jede Frage überspringen, die nicht als Pflicht markiert ist.'
	},
	options: [],
	version: 1
};

export const stars: JourneyRating = {
	id: 'satisfaction',
	type: 'stars',
	label: {
		de: 'Wie zufrieden sind Sie mit der Beratung?',
		en: 'How satisfied are you?'
	},
	min: 1,
	max: 5,
	required: true,
	version: 1
};

export const range: JourneyRating = {
	id: 'feeling',
	type: 'range',
	label: { de: 'Wie geht es Ihnen jetzt?', en: 'How do you feel now?' },
	min: -5,
	max: 5,
	minLabel: { de: 'viel schlechter', en: 'much worse' },
	midLabel: { de: 'normal', en: 'normal' },
	maxLabel: { de: 'viel besser', en: 'much better' },
	required: false,
	version: 1
};

export const situationStep: JourneyStep = {
	id: 'debt:situation',
	kind: 'question',
	title: { de: 'Ihre Situation', en: 'Your situation' },
	description: {
		de: 'Zwei kurze Fragen, damit die Beratung gut vorbereitet ist.'
	},
	questions: [situation, worries, since, privacyHint]
};

export const flightStep: JourneyStep = {
	id: 'debt:between',
	kind: 'question',
	title: { de: 'Wie geht es weiter?', en: 'How is it going?' },
	description: {
		de: 'Ihre Beraterin hat geantwortet. Eine kurze Frage dazu:'
	},
	questions: [situation, note]
};

export const arrivalStep: JourneyStep = {
	id: 'debt:survey',
	kind: 'rating',
	title: { de: 'Ihre Rückmeldung zur Beratung', en: 'Your feedback' },
	description: { de: 'Das dauert keine Minute und hilft uns sehr.' },
	ratings: [stars, range],
	questions: [note]
};

const core = (id: string, coreId: JourneyStep['core']): JourneyStep => ({
	id,
	kind: 'core',
	core: coreId,
	title: {},
	description: {}
});

export const debtJourney: Journey = {
	id: 'debt',
	conversationType: 'AGENCY_COUNSELLING',
	phases: {
		departure: [
			core('debt:topic', 'topic'),
			situationStep,
			core('debt:postcode', 'postcode'),
			core('debt:agency', 'agency'),
			core('debt:username', 'username'),
			core('debt:consent', 'consent')
		],
		flight: [flightStep],
		arrival: [arrivalStep]
	},
	survey: { anonymous: true }
};
