/**
 * Pseudonym generator for anonymous chat users.
 * Generates fun German pseudonyms in the format: "[adjective] [animal] [first_name]"
 * Example: "geschmeidiges Kaninchen Kim"
 *
 * IMPORTANT: This only affects the DISPLAY NAME. The Matrix username
 * stays as "Anonymous-<timestamp>" and must never be changed.
 */

const ADJECTIVES_DE = [
	'geschmeidiges',
	'mutiges',
	'flinkes',
	'sanftes',
	'lustiges',
	'kluges',
	'tapferes',
	'freches',
	'stilles',
	'wildes',
	'goldenes',
	'buntes',
	'schnelles',
	'neugieriges',
	'freundliches',
	'witziges',
	'schlaues',
	'cooles',
	'pfiffiges',
	'flottes',
	'zartes',
	'starkes',
	'helles',
	'warmes',
	'süßes',
	'kleines',
	'großes',
	'rundes',
	'leises',
	'flauschiges'
];

const ANIMALS_DE = [
	'Kaninchen',
	'Katze',
	'Fuchs',
	'Eule',
	'Igel',
	'Delfin',
	'Pinguin',
	'Koala',
	'Panda',
	'Otter',
	'Waschbär',
	'Eichhörnchen',
	'Schildkröte',
	'Schmetterling',
	'Kolibri',
	'Faultier',
	'Seepferdchen',
	'Flamingo',
	'Chamäleon',
	'Glühwürmchen'
];

const FIRST_NAMES = [
	'Kim',
	'Sam',
	'Alex',
	'Robin',
	'Mika',
	'Noa',
	'Sascha',
	'Toni',
	'Jona',
	'Luca',
	'Niki',
	'Remi',
	'Lou',
	'Finn',
	'Jo',
	'Max',
	'Charlie',
	'Jamie',
	'Dana',
	'Chris'
];

export type AnimalType =
	| 'cat'
	| 'rabbit'
	| 'fox'
	| 'owl'
	| 'hedgehog'
	| 'dolphin'
	| 'penguin'
	| 'koala'
	| 'panda'
	| 'otter';

const ANIMAL_TO_TYPE: Record<string, AnimalType> = {
	Kaninchen: 'rabbit',
	Katze: 'cat',
	Fuchs: 'fox',
	Eule: 'owl',
	Igel: 'hedgehog',
	Delfin: 'dolphin',
	Pinguin: 'penguin',
	Koala: 'koala',
	Panda: 'panda',
	Otter: 'otter'
};

const ANIMAL_COLORS: Record<AnimalType, string> = {
	cat: '#FFB3BA',
	rabbit: '#BAFFC9',
	fox: '#FFD9BA',
	owl: '#BAD4FF',
	hedgehog: '#E8BAFF',
	dolphin: '#BAF0FF',
	penguin: '#D4D4D4',
	koala: '#C9C9C9',
	panda: '#E0E0E0',
	otter: '#C4E0BA'
};

export interface Pseudonym {
	displayName: string;
	adjective: string;
	animal: string;
	firstName: string;
	animalType: AnimalType;
	avatarColor: string;
}

function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePseudonym(): Pseudonym {
	const adjective = randomFrom(ADJECTIVES_DE);
	const animal = randomFrom(ANIMALS_DE);
	const firstName = randomFrom(FIRST_NAMES);
	const animalType = ANIMAL_TO_TYPE[animal] || 'cat';
	const avatarColor = ANIMAL_COLORS[animalType] || '#FFB3BA';

	return {
		displayName: `${adjective} ${animal} ${firstName}`,
		adjective,
		animal,
		firstName,
		animalType,
		avatarColor
	};
}

/**
 * Generates a new pseudonym that is different from the current one.
 */
export function regeneratePseudonym(current?: Pseudonym): Pseudonym {
	let next = generatePseudonym();
	let attempts = 0;
	while (
		current &&
		next.displayName === current.displayName &&
		attempts < 10
	) {
		next = generatePseudonym();
		attempts++;
	}
	return next;
}
