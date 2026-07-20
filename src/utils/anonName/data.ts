// Originally scaffolded from Storypapst/anonymous-name-generator, but the word
// tables (esp. the localized labels) have since been curated IN-REPO and now
// diverge from upstream — upstream ships only the SVGs, not these lists. Treat
// THIS file as the source of truth and edit it directly; do not blindly
// regenerate from upstream, which would drop the curated labels.
//
// The German set intentionally offers every available animal (all 62 SVGs) for
// maximum variation; animals are grouped by grammatical gender so the adjective
// agreement in `displayName` stays correct (group 0 = feminine "-e", group 1 =
// the rest "-es").
// Word tables for all six languages of the shared name generator.
export interface NickAnimal {
	label: string;
	svg: string;
}
export interface NickGroup {
	adjectives: string[];
	animals: NickAnimal[];
}
export interface NickLang {
	groups: NickGroup[];
	names: string[];
}

export const LANGUAGE_DATA: Record<string, NickLang> = {
	de: {
		groups: [
			{
				adjectives: [
					'ruhige',
					'sanfte',
					'freundliche',
					'warme',
					'leise',
					'entspannte',
					'achtsame',
					'sanftmütige',
					'neugierige',
					'offene',
					'freie',
					'geduldige',
					'ehrliche',
					'behutsame',
					'zulassende',
					'absichtslose',
					'kostbare',
					'friedliche',
					'beständige',
					'niedliche',
					'liebevolle',
					'zärtliche',
					'sorgsame',
					'einfühlsame',
					'mitfühlende',
					'fürsorgliche',
					'aufmerksame',
					'gütige',
					'stille',
					'offenherzige',
					'versöhnliche'
				],
				animals: [
					{
						label: 'Eule',
						svg: 'owl.svg'
					},
					{
						label: 'Katze',
						svg: 'cat.svg'
					},
					{
						label: 'Libelle',
						svg: 'dragonfly.svg'
					},
					{
						label: 'Biene',
						svg: 'bee.svg'
					},
					{
						label: 'Ameise',
						svg: 'ant.svg'
					},
					{
						label: 'Koralle',
						svg: 'coral.svg'
					},
					{
						label: 'Schildkröte',
						svg: 'turtle.svg'
					},
					{
						label: 'Antilope',
						svg: 'antelope.svg'
					},
					{
						label: 'Forelle',
						svg: 'trout.svg'
					},
					{
						label: 'Giraffe',
						svg: 'giraffe.svg'
					},
					{
						label: 'Maus',
						svg: 'mouse.svg'
					},
					{
						label: 'Elster',
						svg: 'magpie.svg'
					},
					{
						label: 'Schwalbe',
						svg: 'swallow.svg'
					},
					{
						label: 'Nachtigall',
						svg: 'Nightingale.svg'
					},
					{
						label: 'Lerche',
						svg: 'lark.svg'
					},
					{
						label: 'Ente',
						svg: 'duck.svg'
					},
					{
						label: 'Robbe',
						svg: 'seal.svg'
					}
				]
			},
			{
				adjectives: [
					'ruhiges',
					'sanftes',
					'freundliches',
					'warmes',
					'leises',
					'entspanntes',
					'achtsames',
					'sanftmütiges',
					'neugieriges',
					'offenes',
					'freies',
					'geduldiges',
					'ehrliches',
					'behutsames',
					'zulassendes',
					'absichtsloses',
					'kostbares',
					'friedliches',
					'beständiges',
					'niedliches',
					'liebevolles',
					'zärtliches',
					'sorgsames',
					'einfühlsames',
					'mitfühlendes',
					'fürsorgliches',
					'aufmerksames',
					'gütiges',
					'stilles',
					'offenherziges',
					'versöhnliches'
				],
				animals: [
					{
						label: 'Chamäleon',
						svg: 'chameleon.svg'
					},
					{
						label: 'Gecko',
						svg: 'gecko.svg'
					},
					{
						label: 'Panda',
						svg: 'panda.svg'
					},
					{
						label: 'Seepferdchen',
						svg: 'seahorse.svg'
					},
					{
						label: 'Eichhörnchen',
						svg: 'squirrel.svg'
					},
					{
						label: 'Kaninchen',
						svg: 'rabbit.svg'
					},
					{
						label: 'Meerschweinchen',
						svg: 'guinea-pig.svg'
					},
					{
						label: 'Lamm',
						svg: 'lamb.svg'
					},
					{
						label: 'Reh',
						svg: 'deer.svg'
					},
					{
						label: 'Pferd',
						svg: 'horse.svg'
					},
					{
						label: 'Kamel',
						svg: 'camel.svg'
					},
					{
						label: 'Zebra',
						svg: 'zebra.svg'
					},
					{
						label: 'Alpaka',
						svg: 'alpaca.svg'
					},
					{
						label: 'Känguru',
						svg: 'kangaroo.svg'
					},
					{
						label: 'Okapi',
						svg: 'okapi.svg'
					},
					{
						label: 'Schnabeltier',
						svg: 'platypus.svg'
					},
					{
						label: 'Hündchen',
						svg: 'puppy.svg'
					},
					{
						label: 'Glühwürmchen',
						svg: 'firefly.svg'
					},
					{
						label: 'Mufflon',
						svg: 'mouflon.svg'
					},
					{
						label: 'Yak',
						svg: 'yak.svg'
					},
					{
						label: 'Bär',
						svg: 'bear.svg'
					},
					{
						label: 'Käfer',
						svg: 'beetle.svg'
					},
					{
						label: 'Schmetterling',
						svg: 'butterfly.svg'
					},
					{
						label: 'Kranich',
						svg: 'crane.svg'
					},
					{
						label: 'Hund',
						svg: 'dog.svg'
					},
					{
						label: 'Delfin',
						svg: 'dolphin.svg'
					},
					{
						label: 'Adler',
						svg: 'eagle.svg'
					},
					{
						label: 'Fisch',
						svg: 'fish.svg'
					},
					{
						label: 'Fuchs',
						svg: 'fox.svg'
					},
					{
						label: 'Frosch',
						svg: 'frog.svg'
					},
					{
						label: 'Hase',
						svg: 'hare.svg'
					},
					{
						label: 'Falke',
						svg: 'hawk.svg'
					},
					{
						label: 'Igel',
						svg: 'hedgehog.svg'
					},
					{
						label: 'Kolibri',
						svg: 'hummingbird.svg'
					},
					{
						label: 'Koala',
						svg: 'koala.svg'
					},
					{
						label: 'Marienkäfer',
						svg: 'ladybird.svg'
					},
					{
						label: 'Löwe',
						svg: 'lion.svg'
					},
					{
						label: 'Otter',
						svg: 'otter.svg'
					},
					{
						label: 'Papagei',
						svg: 'parrot.svg'
					},
					{
						label: 'Pinguin',
						svg: 'penguin.svg'
					},
					{
						label: 'Rabe',
						svg: 'raven.svg'
					},
					{
						label: 'Spatz',
						svg: 'sparrow.svg'
					},
					{
						label: 'Storch',
						svg: 'stork.svg'
					},
					{
						label: 'Schwan',
						svg: 'swan.svg'
					},
					{
						label: 'Wolf',
						svg: 'wolf.svg'
					}
				]
			}
		],
		names: [
			'Alex',
			'Sam',
			'Sasha',
			'Robin',
			'Noa',
			'Noel',
			'Ari',
			'Eli',
			'Luca',
			'Mika',
			'Nico',
			'Jona',
			'Jan',
			'Janne',
			'Kai',
			'Kim',
			'Toni',
			'Ali',
			'Juri',
			'Rene',
			'Andrea',
			'Jo',
			'Lou',
			'Chris',
			'Pat',
			'Eike',
			'Bente',
			'Kaya',
			'Lian',
			'Elia',
			'Lior',
			'Yael',
			'Milan',
			'Bela',
			'Rio',
			'Romy',
			'Remy',
			'Marlo',
			'Leni',
			'Hedi',
			'Geri',
			'Uli',
			'Indy',
			'Cleo',
			'Jules',
			'Sami',
			'Dani',
			'Nuri',
			'Ayan',
			'Eren',
			'Arda',
			'Deniz',
			'Yuki',
			'Haru',
			'Akira',
			'Ren',
			'Shin',
			'Asa',
			'Aki',
			'Tao',
			'Lei',
			'Bo',
			'Yan',
			'Jun',
			'Min',
			'An',
			'Hoa',
			'Elin',
			'Sorin',
			'Tarin',
			'Lorin',
			'Arin',
			'Alva',
			'Alden',
			'Briar',
			'Linden',
			'Rowan',
			'Sage',
			'Sky',
			'Storm',
			'Winter',
			'Nova',
			'Echo',
			'Vale',
			'Sol',
			'Zen',
			'Ori',
			'Aven',
			'Kiran',
			'Zuri',
			'Amari',
			'Noor',
			'Rayan',
			'Shai'
		]
	},
	en: {
		groups: [
			{
				adjectives: [
					'calm',
					'kind',
					'gentle',
					'smart',
					'bright',
					'free',
					'clear',
					'awake',
					'strong',
					'light',
					'soft',
					'warm',
					'cool',
					'open',
					'honest',
					'playful',
					'curious',
					'tender',
					'caring',
					'patient',
					'steady',
					'precious',
					'peaceful',
					'sweet',
					'loving',
					'mindful',
					'attentive',
					'gracious',
					'quiet',
					'sincere',
					'devoted'
				],
				animals: [
					{
						label: 'Fox',
						svg: 'fox.svg'
					},
					{
						label: 'Wolf',
						svg: 'wolf.svg'
					},
					{
						label: 'Cat',
						svg: 'cat.svg'
					},
					{
						label: 'Dog',
						svg: 'dog.svg'
					},
					{
						label: 'Owl',
						svg: 'owl.svg'
					},
					{
						label: 'Hawk',
						svg: 'hawk.svg'
					},
					{
						label: 'Eagle',
						svg: 'eagle.svg'
					},
					{
						label: 'Sparrow',
						svg: 'sparrow.svg'
					},
					{
						label: 'Raven',
						svg: 'raven.svg'
					},
					{
						label: 'Swan',
						svg: 'swan.svg'
					},
					{
						label: 'Deer',
						svg: 'deer.svg'
					},
					{
						label: 'Hare',
						svg: 'hare.svg'
					},
					{
						label: 'Otter',
						svg: 'otter.svg'
					},
					{
						label: 'Mouse',
						svg: 'mouse.svg'
					},
					{
						label: 'Squirrel',
						svg: 'squirrel.svg'
					},
					{
						label: 'Hedgehog',
						svg: 'hedgehog.svg'
					},
					{
						label: 'Panda',
						svg: 'panda.svg'
					},
					{
						label: 'Penguin',
						svg: 'penguin.svg'
					},
					{
						label: 'Dolphin',
						svg: 'dolphin.svg'
					},
					{
						label: 'Fish',
						svg: 'fish.svg'
					},
					{
						label: 'Seal',
						svg: 'seal.svg'
					},
					{
						label: 'Chameleon',
						svg: 'chameleon.svg'
					},
					{
						label: 'Gecko',
						svg: 'gecko.svg'
					},
					{
						label: 'Dragonfly',
						svg: 'dragonfly.svg'
					},
					{
						label: 'Butterfly',
						svg: 'butterfly.svg'
					},
					{
						label: 'Bee',
						svg: 'bee.svg'
					},
					{
						label: 'Beetle',
						svg: 'beetle.svg'
					},
					{
						label: 'Ant',
						svg: 'ant.svg'
					},
					{
						label: 'Ladybird',
						svg: 'ladybird.svg'
					},
					{
						label: 'Hummingbird',
						svg: 'hummingbird.svg'
					},
					{
						label: 'Parrot',
						svg: 'parrot.svg'
					},
					{
						label: 'Stork',
						svg: 'stork.svg'
					},
					{
						label: 'Alpaca',
						svg: 'alpaca.svg'
					},
					{
						label: 'Lamb',
						svg: 'lamb.svg'
					},
					{
						label: 'Duck',
						svg: 'duck.svg'
					},
					{
						label: 'Guinea Pig',
						svg: 'guinea-pig.svg'
					},
					{
						label: 'Turtle',
						svg: 'turtle.svg'
					},
					{
						label: 'Seahorse',
						svg: 'seahorse.svg'
					},
					{
						label: 'Rabbit',
						svg: 'rabbit.svg'
					},
					{
						label: 'Antelope',
						svg: 'antelope.svg'
					},
					{
						label: 'Trout',
						svg: 'trout.svg'
					},
					{
						label: 'Giraffe',
						svg: 'giraffe.svg'
					},
					{
						label: 'Magpie',
						svg: 'magpie.svg'
					},
					{
						label: 'Swallow',
						svg: 'swallow.svg'
					},
					{
						label: 'Nightingale',
						svg: 'Nightingale.svg'
					},
					{
						label: 'Lark',
						svg: 'lark.svg'
					},
					{
						label: 'Horse',
						svg: 'horse.svg'
					},
					{
						label: 'Camel',
						svg: 'camel.svg'
					},
					{
						label: 'Zebra',
						svg: 'zebra.svg'
					},
					{
						label: 'Kangaroo',
						svg: 'kangaroo.svg'
					},
					{
						label: 'Okapi',
						svg: 'okapi.svg'
					},
					{
						label: 'Platypus',
						svg: 'platypus.svg'
					},
					{
						label: 'Puppy',
						svg: 'puppy.svg'
					},
					{
						label: 'Firefly',
						svg: 'firefly.svg'
					},
					{
						label: 'Mouflon',
						svg: 'mouflon.svg'
					},
					{
						label: 'Yak',
						svg: 'yak.svg'
					},
					{
						label: 'Koala',
						svg: 'koala.svg'
					},
					{
						label: 'Frog',
						svg: 'frog.svg'
					},
					{
						label: 'Bear',
						svg: 'bear.svg'
					},
					{
						label: 'Coral',
						svg: 'coral.svg'
					},
					{
						label: 'Crane',
						svg: 'crane.svg'
					},
					{
						label: 'Lion',
						svg: 'lion.svg'
					}
				]
			}
		],
		names: [
			'Alex',
			'Sam',
			'Sasha',
			'Robin',
			'Charlie',
			'Jamie',
			'Taylor',
			'Jordan',
			'Casey',
			'Riley',
			'Avery',
			'Quinn',
			'Reese',
			'Morgan',
			'Cameron',
			'Drew',
			'Skyler',
			'Rowan',
			'Parker',
			'Dakota',
			'Emerson',
			'Finley',
			'Harper',
			'Kai',
			'Noel',
			'Jesse',
			'Terry',
			'Kris',
			'Lee',
			'Pat',
			'Tracy',
			'Dana',
			'Kim',
			'Andy',
			'Ali',
			'Jo',
			'Nico',
			'Mika',
			'Luca',
			'Eli',
			'Noa',
			'Ari',
			'Jan',
			'Jona',
			'Toni',
			'Uli',
			'Geri',
			'Bela',
			'Leni',
			'Marlo',
			'Remy',
			'Sandy',
			'Shawn',
			'Addison',
			'Arden',
			'Arlo',
			'Ash',
			'Ashton',
			'Ariel',
			'Bailey',
			'Blair',
			'Bobby',
			'Billie',
			'Brett',
			'Brook',
			'Cary',
			'Charly',
			'Cleo',
			'Cory',
			'Dallas',
			'Devon',
			'Eden',
			'Elliot',
			'Ellis',
			'Frankie',
			'Georgie',
			'Glenn',
			'Gray',
			'Hollis',
			'Indy',
			'Jaden',
			'Jay',
			'Jules',
			'Justice',
			'Kerry',
			'Kaya',
			'Kendall',
			'Kenny',
			'Lane',
			'Logan',
			'Lou',
			'Lior',
			'Lynn',
			'Marlowe',
			'Max',
			'Milan',
			'Nikita',
			'Ocean',
			'Paris',
			'Peyton',
			'Phoenix',
			'René',
			'Rio',
			'Romy',
			'Sage',
			'Shiloh',
			'Sidney',
			'Sky',
			'Stevie',
			'Storm',
			'Tatum',
			'Val',
			'Winter',
			'Yael'
		]
	},
	fr: {
		groups: [
			{
				adjectives: [
					'calme',
					'doux',
					'gentil',
					'chaleureux',
					'tranquille',
					'détendu',
					'attentif',
					'tendre',
					'curieux',
					'ouvert',
					'libre',
					'patient',
					'honnête',
					'prudent',
					'tolérant',
					'désintéressé',
					'précieux',
					'paisible',
					'constant',
					'adorable',
					'aimant',
					'délicat',
					'bienveillant',
					'sensible',
					'compatissant',
					'protecteur',
					'vigilant',
					'gracieux',
					'serein',
					'sincère',
					'indulgent'
				],
				animals: [
					{
						label: 'Renard',
						svg: 'fox.svg'
					},
					{
						label: 'Loup',
						svg: 'wolf.svg'
					},
					{
						label: 'Chat',
						svg: 'cat.svg'
					},
					{
						label: 'Chien',
						svg: 'dog.svg'
					},
					{
						label: 'Aigle',
						svg: 'eagle.svg'
					},
					{
						label: 'Cygne',
						svg: 'swan.svg'
					},
					{
						label: 'Cerf',
						svg: 'deer.svg'
					},
					{
						label: 'Panda',
						svg: 'panda.svg'
					},
					{
						label: 'Dauphin',
						svg: 'dolphin.svg'
					},
					{
						label: 'Phoque',
						svg: 'seal.svg'
					},
					{
						label: 'Caméléon',
						svg: 'chameleon.svg'
					},
					{
						label: 'Gecko',
						svg: 'gecko.svg'
					},
					{
						label: 'Scarabée',
						svg: 'beetle.svg'
					},
					{
						label: 'Colibri',
						svg: 'hummingbird.svg'
					},
					{
						label: 'Perroquet',
						svg: 'parrot.svg'
					},
					{
						label: 'Canard',
						svg: 'duck.svg'
					},
					{
						label: 'Agneau',
						svg: 'lamb.svg'
					},
					{
						label: 'Hérisson',
						svg: 'hedgehog.svg'
					},
					{
						label: 'Moineau',
						svg: 'sparrow.svg'
					},
					{
						label: 'Corbeau',
						svg: 'raven.svg'
					},
					{
						label: 'Faucon',
						svg: 'hawk.svg'
					},
					{
						label: 'Lièvre',
						svg: 'hare.svg'
					},
					{
						label: 'Hippocampe',
						svg: 'seahorse.svg'
					},
					{
						label: 'Ornithorynque',
						svg: 'platypus.svg'
					},
					{
						label: 'Chiot',
						svg: 'puppy.svg'
					},
					{
						label: 'Mouflon',
						svg: 'mouflon.svg'
					},
					{
						label: 'Yak',
						svg: 'yak.svg'
					},
					{
						label: 'Koala',
						svg: 'koala.svg'
					},
					{
						label: 'Zèbre',
						svg: 'zebra.svg'
					},
					{
						label: 'Kangourou',
						svg: 'kangaroo.svg'
					},
					{
						label: 'Okapi',
						svg: 'okapi.svg'
					},
					{
						label: 'Chameau',
						svg: 'camel.svg'
					},
					{
						label: 'Cheval',
						svg: 'horse.svg'
					},
					{
						label: 'Ours',
						svg: 'bear.svg'
					},
					{
						label: 'Papillon',
						svg: 'butterfly.svg'
					},
					{
						label: 'Poisson',
						svg: 'fish.svg'
					},
					{
						label: 'Cobaye',
						svg: 'guinea-pig.svg'
					},
					{
						label: 'Lion',
						svg: 'lion.svg'
					},
					{
						label: 'Pingouin',
						svg: 'penguin.svg'
					},
					{
						label: 'Lapin',
						svg: 'rabbit.svg'
					},
					{
						label: 'Écureuil',
						svg: 'squirrel.svg'
					}
				]
			},
			{
				adjectives: [
					'calme',
					'douce',
					'gentille',
					'chaleureuse',
					'tranquille',
					'détendue',
					'attentive',
					'tendre',
					'curieuse',
					'ouverte',
					'libre',
					'patiente',
					'honnête',
					'prudente',
					'tolérante',
					'désintéressée',
					'précieuse',
					'paisible',
					'constante',
					'adorable',
					'aimante',
					'délicate',
					'bienveillante',
					'sensible',
					'compatissante',
					'protectrice',
					'vigilante',
					'gracieuse',
					'sereine',
					'sincère',
					'indulgente'
				],
				animals: [
					{
						label: 'Chouette',
						svg: 'owl.svg'
					},
					{
						label: 'Libellule',
						svg: 'dragonfly.svg'
					},
					{
						label: 'Abeille',
						svg: 'bee.svg'
					},
					{
						label: 'Fourmi',
						svg: 'ant.svg'
					},
					{
						label: 'Coccinelle',
						svg: 'ladybird.svg'
					},
					{
						label: 'Tortue',
						svg: 'turtle.svg'
					},
					{
						label: 'Loutre',
						svg: 'otter.svg'
					},
					{
						label: 'Souris',
						svg: 'mouse.svg'
					},
					{
						label: 'Cigogne',
						svg: 'stork.svg'
					},
					{
						label: 'Corail',
						svg: 'coral.svg'
					},
					{
						label: 'Antilope',
						svg: 'antelope.svg'
					},
					{
						label: 'Truite',
						svg: 'trout.svg'
					},
					{
						label: 'Girafe',
						svg: 'giraffe.svg'
					},
					{
						label: 'Pie',
						svg: 'magpie.svg'
					},
					{
						label: 'Hirondelle',
						svg: 'swallow.svg'
					},
					{
						label: 'Rossignol',
						svg: 'Nightingale.svg'
					},
					{
						label: 'Alouette',
						svg: 'lark.svg'
					},
					{
						label: 'Alpaga',
						svg: 'alpaca.svg'
					},
					{
						label: 'Luciole',
						svg: 'firefly.svg'
					},
					{
						label: 'Grenouille',
						svg: 'frog.svg'
					},
					{
						label: 'Grue',
						svg: 'crane.svg'
					}
				]
			}
		],
		names: [
			'Camille',
			'Dominique',
			'Claude',
			'Morgan',
			'Alix',
			'Maxime',
			'Sacha',
			'Andrea',
			'Lou',
			'Noa',
			'Eden',
			'Charlie',
			'Ange',
			'Louison',
			'Yael',
			'Maël',
			'Robin',
			'Ariel',
			'Céleste',
			'Marin',
			'Alex',
			'Sam',
			'Jules',
			'Remy',
			'Kim',
			'Nico',
			'Luca',
			'Eli',
			'Ari',
			'Jo',
			'Lior',
			'Nour',
			'Sami',
			'Nuri',
			'Dani',
			'Chris',
			'Pat',
			'Toni',
			'Bela',
			'Rio',
			'Cleo',
			'Indy',
			'Milan',
			'Leni',
			'Mika',
			'Jona',
			'Kai',
			'Lian',
			'Elia',
			'Kaya',
			'Ayan',
			'Eren',
			'Deniz',
			'Yuki',
			'Haru',
			'Akira',
			'Ren',
			'Tao',
			'Jun',
			'An',
			'Elin',
			'Alva',
			'Rowan',
			'Sage',
			'Sky',
			'Nova',
			'Echo',
			'Sol',
			'Zen',
			'Ori',
			'Kiran',
			'Zuri',
			'Amari',
			'Noor',
			'Rayan',
			'Shai',
			'Briar',
			'Linden',
			'Storm',
			'Vale'
		]
	},
	es: {
		groups: [
			{
				adjectives: [
					'tranquilo',
					'gentil',
					'amable',
					'cálido',
					'callado',
					'relajado',
					'atento',
					'tierno',
					'curioso',
					'abierto',
					'libre',
					'paciente',
					'honesto',
					'cuidadoso',
					'tolerante',
					'desinteresado',
					'precioso',
					'pacífico',
					'constante',
					'dulce',
					'amoroso',
					'delicado',
					'bondadoso',
					'sensible',
					'compasivo',
					'protector',
					'vigilante',
					'gracioso',
					'sereno',
					'sincero',
					'indulgente'
				],
				animals: [
					{
						label: 'Zorro',
						svg: 'fox.svg'
					},
					{
						label: 'Lobo',
						svg: 'wolf.svg'
					},
					{
						label: 'Gato',
						svg: 'cat.svg'
					},
					{
						label: 'Perro',
						svg: 'dog.svg'
					},
					{
						label: 'Búho',
						svg: 'owl.svg'
					},
					{
						label: 'Cisne',
						svg: 'swan.svg'
					},
					{
						label: 'Ciervo',
						svg: 'deer.svg'
					},
					{
						label: 'Panda',
						svg: 'panda.svg'
					},
					{
						label: 'Delfín',
						svg: 'dolphin.svg'
					},
					{
						label: 'Camaleón',
						svg: 'chameleon.svg'
					},
					{
						label: 'Gecko',
						svg: 'gecko.svg'
					},
					{
						label: 'Escarabajo',
						svg: 'beetle.svg'
					},
					{
						label: 'Colibrí',
						svg: 'hummingbird.svg'
					},
					{
						label: 'Loro',
						svg: 'parrot.svg'
					},
					{
						label: 'Pato',
						svg: 'duck.svg'
					},
					{
						label: 'Cordero',
						svg: 'lamb.svg'
					},
					{
						label: 'Conejo',
						svg: 'rabbit.svg'
					},
					{
						label: 'Erizo',
						svg: 'hedgehog.svg'
					},
					{
						label: 'Pingüino',
						svg: 'penguin.svg'
					},
					{
						label: 'Cuervo',
						svg: 'raven.svg'
					},
					{
						label: 'Pez',
						svg: 'fish.svg'
					},
					{
						label: 'Caballo',
						svg: 'horse.svg'
					},
					{
						label: 'Camello',
						svg: 'camel.svg'
					},
					{
						label: 'Canguro',
						svg: 'kangaroo.svg'
					},
					{
						label: 'Okapi',
						svg: 'okapi.svg'
					},
					{
						label: 'Ornitorrinco',
						svg: 'platypus.svg'
					},
					{
						label: 'Cachorro',
						svg: 'puppy.svg'
					},
					{
						label: 'Muflón',
						svg: 'mouflon.svg'
					},
					{
						label: 'Yak',
						svg: 'yak.svg'
					},
					{
						label: 'Koala',
						svg: 'koala.svg'
					},
					{
						label: 'Sapo',
						svg: 'frog.svg'
					},
					{
						label: 'Ruiseñor',
						svg: 'Nightingale.svg'
					},
					{
						label: 'Antílope',
						svg: 'antelope.svg'
					},
					{
						label: 'Oso',
						svg: 'bear.svg'
					},
					{
						label: 'Halcón',
						svg: 'hawk.svg'
					},
					{
						label: 'León',
						svg: 'lion.svg'
					},
					{
						label: 'Ratón',
						svg: 'mouse.svg'
					},
					{
						label: 'Caballito de mar',
						svg: 'seahorse.svg'
					},
					{
						label: 'Gorrión',
						svg: 'sparrow.svg'
					}
				]
			},
			{
				adjectives: [
					'tranquila',
					'gentil',
					'amable',
					'cálida',
					'callada',
					'relajada',
					'atenta',
					'tierna',
					'curiosa',
					'abierta',
					'libre',
					'paciente',
					'honesta',
					'cuidadosa',
					'tolerante',
					'desinteresada',
					'preciosa',
					'pacífica',
					'constante',
					'dulce',
					'amorosa',
					'delicada',
					'bondadosa',
					'sensible',
					'compasiva',
					'protectora',
					'vigilante',
					'graciosa',
					'serena',
					'sincera',
					'indulgente'
				],
				animals: [
					{
						label: 'Lechuza',
						svg: 'owl.svg'
					},
					{
						label: 'Libélula',
						svg: 'dragonfly.svg'
					},
					{
						label: 'Abeja',
						svg: 'bee.svg'
					},
					{
						label: 'Hormiga',
						svg: 'ant.svg'
					},
					{
						label: 'Mariquita',
						svg: 'ladybird.svg'
					},
					{
						label: 'Tortuga',
						svg: 'turtle.svg'
					},
					{
						label: 'Nutria',
						svg: 'otter.svg'
					},
					{
						label: 'Ardilla',
						svg: 'squirrel.svg'
					},
					{
						label: 'Cigüeña',
						svg: 'stork.svg'
					},
					{
						label: 'Foca',
						svg: 'seal.svg'
					},
					{
						label: 'Liebre',
						svg: 'hare.svg'
					},
					{
						label: 'Mariposa',
						svg: 'butterfly.svg'
					},
					{
						label: 'Alpaca',
						svg: 'alpaca.svg'
					},
					{
						label: 'Cobaya',
						svg: 'guinea-pig.svg'
					},
					{
						label: 'Trucha',
						svg: 'trout.svg'
					},
					{
						label: 'Jirafa',
						svg: 'giraffe.svg'
					},
					{
						label: 'Urraca',
						svg: 'magpie.svg'
					},
					{
						label: 'Golondrina',
						svg: 'swallow.svg'
					},
					{
						label: 'Alondra',
						svg: 'lark.svg'
					},
					{
						label: 'Cebra',
						svg: 'zebra.svg'
					},
					{
						label: 'Luciérnaga',
						svg: 'firefly.svg'
					},
					{
						label: 'Corala',
						svg: 'coral.svg'
					},
					{
						label: 'Grulla',
						svg: 'crane.svg'
					},
					{
						label: 'Águila',
						svg: 'eagle.svg'
					}
				]
			}
		],
		names: [
			'Álex',
			'Cris',
			'Mar',
			'Ari',
			'Sol',
			'Noa',
			'Luca',
			'Mika',
			'Nico',
			'Dani',
			'Sami',
			'Rubi',
			'Eli',
			'Lou',
			'Kim',
			'Kai',
			'Joss',
			'Jules',
			'Robin',
			'Sasha',
			'Noel',
			'Remy',
			'Val',
			'Paz',
			'Ren',
			'Rio',
			'Yael',
			'Lior',
			'Bo',
			'Jun',
			'Tao',
			'An',
			'Min',
			'Haru',
			'Yuki',
			'Akira',
			'Shin',
			'Lei',
			'Yan',
			'Asa',
			'Aven',
			'Sage',
			'Sky',
			'Nova',
			'Echo',
			'Ori',
			'Zen',
			'Briar',
			'Rowan',
			'Alva',
			'Linden',
			'Storm',
			'Winter',
			'Vale',
			'Kiran',
			'Zuri',
			'Amari',
			'Noor',
			'Rayan',
			'Shai',
			'Erin',
			'Quinn',
			'Ariel',
			'Cruz',
			'Lux',
			'Cleo',
			'Isa',
			'Neri',
			'Toni',
			'Rafa',
			'Javi',
			'Edu',
			'Gabi',
			'Quique',
			'Adri',
			'Áuri',
			'Pau',
			'Ona',
			'Neus',
			'Iker'
		]
	},
	ru: {
		groups: [
			{
				adjectives: [
					'спокойная',
					'нежная',
					'добрая',
					'тёплая',
					'тихая',
					'расслабленная',
					'внимательная',
					'ласковая',
					'любопытная',
					'открытая',
					'свободная',
					'терпеливая',
					'честная',
					'заботливая',
					'бережная',
					'драгоценная',
					'мирная',
					'верная',
					'милая',
					'любящая',
					'чуткая',
					'сострадательная',
					'отзывчивая',
					'кроткая',
					'искренняя',
					'прощающая'
				],
				animals: [
					{
						label: 'Сова',
						svg: 'owl.svg'
					},
					{
						label: 'Кошка',
						svg: 'cat.svg'
					},
					{
						label: 'Стрекоза',
						svg: 'dragonfly.svg'
					},
					{
						label: 'Пчела',
						svg: 'bee.svg'
					},
					{
						label: 'Бабочка',
						svg: 'butterfly.svg'
					},
					{
						label: 'Черепаха',
						svg: 'turtle.svg'
					},
					{
						label: 'Выдра',
						svg: 'otter.svg'
					},
					{
						label: 'Мышь',
						svg: 'mouse.svg'
					},
					{
						label: 'Белка',
						svg: 'squirrel.svg'
					},
					{
						label: 'Антилопа',
						svg: 'antelope.svg'
					},
					{
						label: 'Форель',
						svg: 'trout.svg'
					},
					{
						label: 'Жирафа',
						svg: 'giraffe.svg'
					},
					{
						label: 'Сорока',
						svg: 'magpie.svg'
					},
					{
						label: 'Ласточка',
						svg: 'swallow.svg'
					},
					{
						label: 'Лошадь',
						svg: 'horse.svg'
					},
					{
						label: 'Зебра',
						svg: 'zebra.svg'
					},
					{
						label: 'Альпака',
						svg: 'alpaca.svg'
					},
					{
						label: 'Лягушка',
						svg: 'frog.svg'
					},
					{
						label: 'Коала',
						svg: 'koala.svg'
					},
					{
						label: 'Божья коровка',
						svg: 'ladybird.svg'
					},
					{
						label: 'Собака',
						svg: 'dog.svg'
					},
					{
						label: 'Утка',
						svg: 'duck.svg'
					},
					{
						label: 'Рыба',
						svg: 'fish.svg'
					},
					{
						label: 'Лиса',
						svg: 'fox.svg'
					},
					{
						label: 'Морская свинка',
						svg: 'guinea-pig.svg'
					},
					{
						label: 'Панда',
						svg: 'panda.svg'
					}
				]
			},
			{
				adjectives: [
					'спокойный',
					'нежный',
					'добрый',
					'тёплый',
					'тихий',
					'расслабленный',
					'внимательный',
					'ласковый',
					'любопытный',
					'открытый',
					'свободный',
					'терпеливый',
					'честный',
					'заботливый',
					'бережный',
					'драгоценный',
					'мирный',
					'верный',
					'милый',
					'любящий',
					'чуткий',
					'сострадательный',
					'отзывчивый',
					'кроткий',
					'искренний',
					'прощающий'
				],
				animals: [
					{
						label: 'Хамелеон',
						svg: 'chameleon.svg'
					},
					{
						label: 'Геккон',
						svg: 'gecko.svg'
					},
					{
						label: 'Кролик',
						svg: 'rabbit.svg'
					},
					{
						label: 'Олень',
						svg: 'deer.svg'
					},
					{
						label: 'Пингвин',
						svg: 'penguin.svg'
					},
					{
						label: 'Дельфин',
						svg: 'dolphin.svg'
					},
					{
						label: 'Тюлень',
						svg: 'seal.svg'
					},
					{
						label: 'Попугай',
						svg: 'parrot.svg'
					},
					{
						label: 'Жук',
						svg: 'beetle.svg'
					},
					{
						label: 'Ёж',
						svg: 'hedgehog.svg'
					},
					{
						label: 'Аист',
						svg: 'stork.svg'
					},
					{
						label: 'Верблюд',
						svg: 'camel.svg'
					},
					{
						label: 'Окапи',
						svg: 'okapi.svg'
					},
					{
						label: 'Утконос',
						svg: 'platypus.svg'
					},
					{
						label: 'Щенок',
						svg: 'puppy.svg'
					},
					{
						label: 'Муфлон',
						svg: 'mouflon.svg'
					},
					{
						label: 'Як',
						svg: 'yak.svg'
					},
					{
						label: 'Жаворонок',
						svg: 'lark.svg'
					},
					{
						label: 'Соловей',
						svg: 'Nightingale.svg'
					},
					{
						label: 'Муравей',
						svg: 'ant.svg'
					},
					{
						label: 'Медведь',
						svg: 'bear.svg'
					},
					{
						label: 'Коралл',
						svg: 'coral.svg'
					},
					{
						label: 'Журавль',
						svg: 'crane.svg'
					},
					{
						label: 'Орёл',
						svg: 'eagle.svg'
					},
					{
						label: 'Светлячок',
						svg: 'firefly.svg'
					},
					{
						label: 'Заяц',
						svg: 'hare.svg'
					},
					{
						label: 'Ястреб',
						svg: 'hawk.svg'
					},
					{
						label: 'Колибри',
						svg: 'hummingbird.svg'
					},
					{
						label: 'Кенгуру',
						svg: 'kangaroo.svg'
					},
					{
						label: 'Ягнёнок',
						svg: 'lamb.svg'
					},
					{
						label: 'Лев',
						svg: 'lion.svg'
					},
					{
						label: 'Ворон',
						svg: 'raven.svg'
					},
					{
						label: 'Морской конёк',
						svg: 'seahorse.svg'
					},
					{
						label: 'Воробей',
						svg: 'sparrow.svg'
					},
					{
						label: 'Лебедь',
						svg: 'swan.svg'
					},
					{
						label: 'Волк',
						svg: 'wolf.svg'
					}
				]
			}
		],
		names: [
			'Alex',
			'Sam',
			'Sasha',
			'Robin',
			'Noa',
			'Noel',
			'Ari',
			'Eli',
			'Luca',
			'Mika',
			'Nico',
			'Jona',
			'Kai',
			'Kim',
			'Женя',
			'Валя',
			'Slava',
			'Nikita',
			'Yura',
			'Toni',
			'Dani',
			'Yuki',
			'Haru',
			'Rio',
			'Remy',
			'Cleo',
			'Jules',
			'Milan',
			'Bela',
			'Indy',
			'Lou',
			'Jo',
			'Pat',
			'Kaya',
			'Lian',
			'Lior',
			'Yael',
			'Rowan',
			'Sage',
			'Sky',
			'Storm',
			'Winter',
			'Nova',
			'Echo',
			'Sol',
			'Zen',
			'Ori',
			'Kiran',
			'Zuri',
			'Amari',
			'Noor',
			'Rayan',
			'Shai',
			'Aven',
			'Alva',
			'Briar',
			'Linden',
			'Vale',
			'Bo',
			'Jun',
			'An',
			'Elin',
			'Arin',
			'Lorin',
			'Sorin',
			'Tarin',
			'Hoa',
			'Lei',
			'Tao'
		]
	},
	uk: {
		groups: [
			{
				adjectives: [
					'спокійна',
					'ніжна',
					'добра',
					'тепла',
					'тиха',
					'розслаблена',
					'уважна',
					'лагідна',
					'допитлива',
					'відкрита',
					'вільна',
					'терпляча',
					'чесна',
					'дбайлива',
					'обережна',
					'дорогоцінна',
					'мирна',
					'вірна',
					'мила',
					'люблячa',
					'чуйна',
					'співчутлива',
					'відгукна',
					'лагідна',
					'щира',
					'поблажлива'
				],
				animals: [
					{
						label: 'Сова',
						svg: 'owl.svg'
					},
					{
						label: 'Кішка',
						svg: 'cat.svg'
					},
					{
						label: 'Бабка',
						svg: 'dragonfly.svg'
					},
					{
						label: 'Бджола',
						svg: 'bee.svg'
					},
					{
						label: 'Мурашка',
						svg: 'ant.svg'
					},
					{
						label: 'Черепаха',
						svg: 'turtle.svg'
					},
					{
						label: 'Видра',
						svg: 'otter.svg'
					},
					{
						label: 'Миша',
						svg: 'mouse.svg'
					},
					{
						label: 'Білка',
						svg: 'squirrel.svg'
					},
					{
						label: 'Антилопа',
						svg: 'antelope.svg'
					},
					{
						label: 'Форель',
						svg: 'trout.svg'
					},
					{
						label: 'Жирафа',
						svg: 'giraffe.svg'
					},
					{
						label: 'Сорока',
						svg: 'magpie.svg'
					},
					{
						label: 'Ластівка',
						svg: 'swallow.svg'
					},
					{
						label: 'Кобила',
						svg: 'horse.svg'
					},
					{
						label: 'Зебра',
						svg: 'zebra.svg'
					},
					{
						label: 'Альпака',
						svg: 'alpaca.svg'
					},
					{
						label: 'Жаба',
						svg: 'frog.svg'
					},
					{
						label: 'Коала',
						svg: 'koala.svg'
					},
					{
						label: 'Корівка',
						svg: 'ladybird.svg'
					},
					{
						label: 'Собака',
						svg: 'dog.svg'
					},
					{
						label: 'Качка',
						svg: 'duck.svg'
					},
					{
						label: 'Риба',
						svg: 'fish.svg'
					},
					{
						label: 'Лисиця',
						svg: 'fox.svg'
					},
					{
						label: 'Морська свинка',
						svg: 'guinea-pig.svg'
					},
					{
						label: 'Панда',
						svg: 'panda.svg'
					}
				]
			},
			{
				adjectives: [
					'спокійний',
					'ніжний',
					'добрий',
					'теплий',
					'тихий',
					'розслаблений',
					'уважний',
					'лагідний',
					'допитливий',
					'відкритий',
					'вільний',
					'терплячий',
					'чесний',
					'дбайливий',
					'обережний',
					'дорогоцінний',
					'мирний',
					'вірний',
					'милий',
					'люблячий',
					'чуйний',
					'співчутливий',
					'відгукний',
					'лагідний',
					'щирий',
					'поблажливий'
				],
				animals: [
					{
						label: 'Хамелеон',
						svg: 'chameleon.svg'
					},
					{
						label: 'Геккон',
						svg: 'gecko.svg'
					},
					{
						label: 'Кролик',
						svg: 'rabbit.svg'
					},
					{
						label: 'Олень',
						svg: 'deer.svg'
					},
					{
						label: 'Пінгвін',
						svg: 'penguin.svg'
					},
					{
						label: 'Дельфін',
						svg: 'dolphin.svg'
					},
					{
						label: 'Тюлень',
						svg: 'seal.svg'
					},
					{
						label: 'Папуга',
						svg: 'parrot.svg'
					},
					{
						label: 'Жук',
						svg: 'beetle.svg'
					},
					{
						label: 'Їжак',
						svg: 'hedgehog.svg'
					},
					{
						label: 'Лелека',
						svg: 'stork.svg'
					},
					{
						label: 'Верблюд',
						svg: 'camel.svg'
					},
					{
						label: 'Окапі',
						svg: 'okapi.svg'
					},
					{
						label: 'Качкодзьоб',
						svg: 'platypus.svg'
					},
					{
						label: 'Муфлон',
						svg: 'mouflon.svg'
					},
					{
						label: 'Як',
						svg: 'yak.svg'
					},
					{
						label: 'Жайворонок',
						svg: 'lark.svg'
					},
					{
						label: 'Соловей',
						svg: 'Nightingale.svg'
					},
					{
						label: 'Метелик',
						svg: 'butterfly.svg'
					},
					{
						label: 'Колібрі',
						svg: 'hummingbird.svg'
					},
					{
						label: 'Заєць',
						svg: 'hare.svg'
					},
					{
						label: 'Ведмідь',
						svg: 'bear.svg'
					},
					{
						label: 'Корал',
						svg: 'coral.svg'
					},
					{
						label: 'Журавель',
						svg: 'crane.svg'
					},
					{
						label: 'Орел',
						svg: 'eagle.svg'
					},
					{
						label: 'Світлячок',
						svg: 'firefly.svg'
					},
					{
						label: 'Яструб',
						svg: 'hawk.svg'
					},
					{
						label: 'Кенгуру',
						svg: 'kangaroo.svg'
					},
					{
						label: 'Ягня',
						svg: 'lamb.svg'
					},
					{
						label: 'Лев',
						svg: 'lion.svg'
					},
					{
						label: 'Цуценя',
						svg: 'puppy.svg'
					},
					{
						label: 'Ворон',
						svg: 'raven.svg'
					},
					{
						label: 'Морський коник',
						svg: 'seahorse.svg'
					},
					{
						label: 'Горобець',
						svg: 'sparrow.svg'
					},
					{
						label: 'Лебідь',
						svg: 'swan.svg'
					},
					{
						label: 'Вовк',
						svg: 'wolf.svg'
					}
				]
			}
		],
		names: [
			'Alex',
			'Sam',
			'Sasha',
			'Robin',
			'Noa',
			'Noel',
			'Ari',
			'Eli',
			'Luca',
			'Mika',
			'Nico',
			'Jona',
			'Kai',
			'Kim',
			'Zhenya',
			'Valya',
			'Slava',
			'Nikita',
			'Toni',
			'Dani',
			'Yuki',
			'Haru',
			'Rio',
			'Remy',
			'Cleo',
			'Jules',
			'Milan',
			'Bela',
			'Indy',
			'Lou',
			'Jo',
			'Pat',
			'Kaya',
			'Lian',
			'Lior',
			'Yael',
			'Rowan',
			'Sage',
			'Sky',
			'Storm',
			'Winter',
			'Nova',
			'Echo',
			'Sol',
			'Zen',
			'Ori',
			'Kiran',
			'Zuri',
			'Amari',
			'Noor',
			'Rayan',
			'Shai',
			'Aven',
			'Alva',
			'Briar',
			'Linden',
			'Vale',
			'Bo',
			'Jun',
			'An',
			'Elin',
			'Arin',
			'Lorin',
			'Sorin',
			'Tarin',
			'Hoa',
			'Lei',
			'Tao'
		]
	}
};
