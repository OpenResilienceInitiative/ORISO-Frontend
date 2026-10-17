import { CallEntryBlocker } from './callEntryTypes';

/**
 * Prototype copy for ORISO-Frontend#1386. German only and not in i18n yet on
 * purpose: the wording is part of what the product owner reviews in
 * Storybook. It moves to `registration.callEntry.*` keys when the room is
 * wired.
 */
export const callEntryCopy = {
	kicker: { video: 'Videogespräch', audio: 'Telefongespräch' },
	statusLine: {
		video: 'Prüfen Sie Bild und Ton, dann treten Sie bei.',
		audio: 'Prüfen Sie Ihren Ton, dann treten Sie bei.'
	},
	title: {
		video: 'Sehen und hören Sie sich kurz an',
		audio: 'Hört man Sie gut?'
	},
	intro: {
		video: 'Niemand sieht Sie, bevor Sie beitreten. Die Vorschau sehen nur Sie.',
		audio: 'Es gibt kein Bild, nur Ihre Stimme. Niemand hört Sie, bevor Sie beitreten.'
	},
	devices: {
		camera: 'Kamera',
		microphone: 'Mikrofon',
		speaker: 'Lautsprecher'
	},
	cameraOff: 'Ihre Kamera ist aus',
	micOn: 'Mikrofon an',
	micOff: 'Mikrofon aus',
	cameraOn: 'Kamera an',
	cameraOffToggle: 'Kamera aus',
	cameraMissing: 'Keine Kamera gefunden',
	micMeter: 'Lautstärke Ihres Mikrofons',
	micHeard: 'Wir hören Sie.',
	micWaiting: 'Sagen Sie etwas, dann schlägt die Anzeige aus.',
	micMuted: 'Sie treten stumm bei. Sie können sich jederzeit zuschalten.',
	speakerTest: 'Testton abspielen',
	speakerPlaying: 'Ton läuft …',
	speakerQuestion: 'Haben Sie den Ton gehört?',
	speakerYes: 'Ja',
	speakerNo: 'Nein',
	speakerHeard: 'Ihr Lautsprecher funktioniert.',
	speakerNotHeard:
		'Stellen Sie lauter oder wählen Sie oben ein anderes Gerät. Dann noch einmal.',
	headsetTip:
		'Mit Kopfhörern hört niemand in Ihrer Nähe mit, was Ihr Gegenüber sagt.',
	avatarHint: {
		video: 'So sieht man Sie, wenn Ihre Kamera aus ist. Sie können Figur und User-ID jederzeit ändern.',
		audio: 'So sieht man Sie im Gespräch. Sie können Figur und User-ID jederzeit ändern.'
	},
	passwordHelper: 'Damit kommen Sie später wieder in Ihr Postfach.',
	showPassword: 'Passwort anzeigen',
	hidePassword: 'Passwort verbergen',
	join: {
		video: 'Videogespräch beitreten',
		audio: 'Telefongespräch beitreten'
	},
	consent: {
		heading: 'Gleich sind Sie verbunden.',
		subtitle:
			'Bitte stimmen Sie noch zu, dann treten Sie dem Gespräch bei.',
		decline: 'Nicht zustimmen',
		missing:
			'Bitte stimmen Sie erst zu — ohne Ihre Zustimmung kann das Gespräch nicht beginnen.'
	},
	missing: 'Noch offen: ',
	missingName: 'User-ID',
	missingPassword: 'Passwort',
	missingMicrophone: 'Mikrofon',
	allSet: 'Alles bereit',
	joining: 'Sie werden verbunden …',
	blocker: {
		permissionDenied: {
			title: 'Ihr Browser hat das Mikrofon gesperrt',
			body: 'Ohne Mikrofon kann Ihr Gegenüber Sie nicht hören.',
			steps: [
				'Klicken Sie links neben der Adresse auf das Schloss.',
				'Erlauben Sie das Mikrofon (beim Videogespräch auch die Kamera).',
				'Klicken Sie dann auf „Erneut prüfen“.'
			],
			action: 'Erneut prüfen'
		},
		noDevice: {
			title: 'Wir finden kein Mikrofon',
			body: 'Schließen Sie ein Headset an oder nutzen Sie Ihr Handy. Der Link funktioniert auch dort.',
			steps: [],
			action: 'Erneut prüfen'
		},
		notOpenYet: {
			title: 'Der Raum öffnet um 14:00 Uhr',
			body: 'Sie können die Seite offen lassen. Wir lassen Sie herein, sobald es so weit ist.',
			steps: [],
			action: 'Warten'
		},
		callEnded: {
			title: 'Dieses Gespräch ist beendet',
			body: 'Wenn Sie noch etwas sagen möchten, schreiben Sie Ihrer Beratung eine Nachricht.',
			steps: [],
			action: 'Zu meinen Nachrichten'
		},
		linkInvalid: {
			title: 'Dieser Link gilt nicht mehr',
			body: 'Bitten Sie Ihre Beratung um einen neuen Link.',
			steps: [],
			action: 'Zu meinen Nachrichten'
		}
	} satisfies Record<
		CallEntryBlocker,
		{ title: string; body: string; steps: string[]; action: string }
	>
} as const;
