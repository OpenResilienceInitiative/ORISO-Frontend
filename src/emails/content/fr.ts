/**
 * French. Machine-translated from `de-sie`, not yet read by a native speaker.
 *
 * See `translationManifest.json` for what this was translated from and
 * `translationReview.json` for which strings still need a human. Until the
 * strings marked in `emailProtectedPaths` are signed off, this locale is
 * `pending-human-review` and no service may select it.
 *
 * Terminology, decided once so the 22 occasions agree with each other:
 *   Beratung            → le service de conseil (the relationship), la consultation (the session)
 *   Beratungsstelle     → le centre de consultation
 *   Fachkraft           → le professionnel
 *   Träger              → l’organisme
 *   ratsuchende Person  → la personne qui demande conseil
 *   Fachaustausch       → l’échange entre professionnels
 *   AVV                 → le contrat de sous-traitance (RGPD, art. 28)
 *
 * The address form is `vous` throughout — French has a T–V distinction, but
 * whether a second, informal tone is needed is deliberately out of scope
 * (ORISO-Frontend#1065, scope note).
 */

import { EmailContent } from '../kit/emailTemplate';
import { EmailId } from './emailCatalogue';

const footer = {
	offeredBy: '{{platformName}} est un service proposé par {{orgName}}.',
	links: [
		{ label: 'Paramètres', href: '{{settingsUrl}}' },
		{ label: 'Protection des données', href: '{{privacyUrl}}' },
		{ label: 'Mentions légales', href: '{{imprintUrl}}' },
		{ label: 'Se désabonner des notifications', href: '{{unsubscribeUrl}}' }
	],
	automatedNote:
		'Cet e-mail a été envoyé automatiquement. Merci de ne pas y répondre.'
};

const assurance =
	'Vos messages sont chiffrés de bout en bout. Personne d’autre que vous et votre service de conseil ne peut les lire – nous non plus.';

/** See `de-sie` — no unsubscribe link, because nothing switches these off. */
const securityFooter = {
	offeredBy: '{{platformName}} est un service proposé par {{orgName}}.',
	links: [
		{ label: 'Protection des données', href: '{{privacyUrl}}' },
		{ label: 'Mentions légales', href: '{{imprintUrl}}' }
	],
	automatedNote:
		'Cet e-mail fait partie de la connexion et ne peut pas être désactivé. Merci de ne pas y répondre.'
};

const legalFooter = {
	...securityFooter,
	automatedNote:
		'Cet e-mail relève de la relation contractuelle et ne peut pas être désactivé. Merci de ne pas y répondre.'
};

const staffAssurance =
	'Le contenu des consultations n’apparaît jamais dans un e-mail. Vous ne le voyez que chiffré, après connexion.';

const securityAssurance =
	'Nous ne vous demandons jamais votre mot de passe par e-mail. Ne transmettez ce lien à personne.';

const codeAssurance =
	'Nous ne vous demandons jamais votre mot de passe par e-mail. Ne transmettez ce code à personne.';

const accountAssurance =
	'Nous ne vous demandons jamais votre mot de passe par e-mail. Nous vous signalons toujours toute modification de votre accès.';

const legalAssurance =
	'Cet e-mail relève de la relation contractuelle entre {{orgName}} et {{tenantName}}.';

export const fr: Record<EmailId, EmailContent> = {
	'neue-nachricht': {
		subject: 'Vous avez un nouveau message',
		preheader:
			'Un nouveau message vous attend dans votre service de conseil.',
		headline: 'Vous avez un nouveau message',
		paragraphs: [
			'Un nouveau message vous attend dans votre service de conseil sur {{platformName}}.',
			'Pour des raisons de protection des données, nous n’affichons ici ni contenu ni nom. Vous lirez le message, chiffré, après votre connexion.'
		],
		cta: { label: 'Lire le message', href: '{{messageUrl}}' },
		footnote:
			'Vous n’êtes pas obligé de répondre tout de suite. Le message reste dans votre boîte aussi longtemps que vous en avez besoin.',
		assurance,
		footer
	},

	'willkommen': {
		subject: 'Bienvenue sur {{platformName}}',
		preheader: 'Votre accès anonyme est prêt – voici la suite.',
		headline: 'Votre accès est prêt',
		paragraphs: [
			'Vous vous êtes inscrit anonymement sur {{platformName}}. Nous sommes heureux de vous accueillir.',
			'Conservez bien votre nom d’utilisateur. Pour des raisons de protection des données, nous ne pouvons pas le récupérer.'
		],
		panel: [{ label: 'Nom d’utilisateur', value: '{{username}}' }],
		cta: { label: 'Se connecter au service', href: '{{loginUrl}}' },
		footnote:
			'Votre conseillère ou votre conseiller vous répond sous 2 jours ouvrés.',
		assurance,
		footer
	},

	'passwort-zuruecksetzen': {
		subject: 'Définir un nouveau mot de passe',
		preheader: 'Le lien est valable {{expiryHours}} heures.',
		headline: 'Définir un nouveau mot de passe',
		paragraphs: [
			'Vous avez demandé un nouveau mot de passe pour votre accès sur {{platformName}}.',
			'Le lien est valable {{expiryHours}} heures et ne fonctionne qu’une seule fois.'
		],
		cta: { label: 'Choisir un mot de passe', href: '{{resetUrl}}' },
		footnote:
			'Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail. Votre mot de passe restera inchangé.',
		assurance,
		footer
	},

	'termin': {
		subject: 'Votre rendez-vous du {{appointmentDate}}',
		preheader:
			'{{appointmentDate}}, {{appointmentTime}} – {{appointmentType}}.',
		headline: 'Votre rendez-vous est confirmé',
		paragraphs: [
			'Nous avons noté votre rendez-vous. Vous n’avez rien à préparer – venez simplement comme vous êtes.'
		],
		panel: [
			{ label: 'Date', value: '{{appointmentDate}}' },
			{ label: 'Heure', value: '{{appointmentTime}}' },
			{ label: 'Type', value: '{{appointmentType}}' },
			{ label: 'Lieu', value: '{{locationName}}<br>{{locationAddress}}' }
		],
		cta: { label: 'Voir le rendez-vous', href: '{{appointmentUrl}}' },
		secondaryAction: {
			label: 'Ouvrir l’adresse sur une carte',
			href: '{{mapUrl}}'
		},
		footnote:
			'Vous recevrez un rappel 24 heures avant. Vous pouvez annuler à tout moment.',
		assurance,
		footer
	},

	'beraterin-kontakt': {
		subject: 'Comment joindre votre service de conseil',
		preheader:
			'Ligne directe, horaires et prise de rendez-vous en un coup d’œil.',
		headline: 'Comment joindre votre service de conseil',
		paragraphs: [
			'Outre le chat protégé, vous pouvez aussi joindre votre service de conseil par téléphone ou prendre directement un rendez-vous.',
			'Votre accès reste anonyme – c’est vous qui décidez de ce que vous racontez.'
		],
		panel: [
			{ label: 'Service de conseil', value: '{{consultantName}}' },
			{ label: 'Ligne directe', value: '{{consultantPhone}}' },
			{ label: 'Horaires', value: '{{consultantHours}}' },
			{ label: 'E-mail', value: '{{consultantEmail}}' }
		],
		cta: { label: 'Prendre rendez-vous', href: '{{bookingUrl}}' },
		secondaryAction: {
			label: 'Aller au chat protégé',
			href: '{{messageUrl}}'
		},
		footnote:
			'En dehors des horaires, écrivez de préférence dans le chat. Nous vous répondons sous 2 jours ouvrés.',
		assurance,
		footer
	},

	'anfrage-zugewiesen': {
		subject: 'Nouvelle demande de conseil',
		preheader: 'Une nouvelle demande vous attend.',
		headline: 'Une nouvelle demande vous attend',
		paragraphs: [
			'Une nouvelle demande de conseil vous a été attribuée. Vous en verrez le détail dans l’espace de consultation, après connexion.'
		],
		panel: [
			{ label: 'Sujet', value: '{{requestTopic}}' },
			{ label: 'Code postal', value: '{{requestPostcode}}' },
			{ label: 'Reçue le', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Ouvrir la demande', href: '{{requestUrl}}' },
		footnote: 'Merci d’accepter la demande sous 2 jours ouvrés.',
		assurance,
		footer
	},

	'systemhinweis': {
		subject: 'Maintenance prévue le {{maintenanceDate}}',
		preheader: 'Indisponible de {{maintenanceStart}} à {{maintenanceEnd}}.',
		headline: 'Une courte interruption pour maintenance',
		paragraphs: [
			'Le {{maintenanceDate}}, {{platformName}} sera indisponible entre {{maintenanceStart}} et {{maintenanceEnd}}.',
			'Ensuite, vous pourrez écrire comme d’habitude.'
		],
		cta: { label: 'Voir la page d’état', href: '{{statusUrl}}' },
		footnote: 'Les messages déjà écrits ne seront pas perdus.',
		assurance,
		footer
	},

	'neue-anfrage': {
		subject: 'Nouvelle demande dans votre centre de consultation',
		preheader: 'Une demande attend d’être acceptée.',
		headline: 'Une nouvelle demande est arrivée',
		paragraphs: [
			'Une nouvelle demande de conseil est arrivée dans votre centre de consultation. Elle n’est encore attribuée à personne.',
			'Celui ou celle qui l’accepte prend en charge la consultation.'
		],
		panel: [
			{ label: 'Sujet', value: '{{requestTopic}}' },
			{ label: 'Code postal', value: '{{requestPostcode}}' },
			{ label: 'Reçue le', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Voir la demande', href: '{{requestUrl}}' },
		footnote: 'Merci d’accepter la demande sous 2 jours ouvrés.',
		assurance: staffAssurance,
		footer
	},

	'direkte-anfrage': {
		subject: 'Une demande vous est adressée directement',
		preheader: 'Cette demande a été écrite pour vous.',
		headline: 'Une demande vous est adressée directement',
		paragraphs: [
			'Une personne qui demande conseil vous a expressément choisi au moment d’écrire sa demande.',
			'Si vous ne pouvez pas la prendre en charge, rendez-la au centre de consultation pour qu’elle ne reste pas en attente.'
		],
		panel: [
			{ label: 'Sujet', value: '{{requestTopic}}' },
			{ label: 'Reçue le', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Ouvrir la demande', href: '{{requestUrl}}' },
		footnote: 'Merci de répondre sous 2 jours ouvrés.',
		assurance: staffAssurance,
		footer
	},

	'tagesuebersicht': {
		subject: 'Votre récapitulatif du jour',
		preheader: 'Demandes en attente dans votre centre de consultation.',
		headline: 'Votre récapitulatif du jour',
		paragraphs: [
			'Des demandes en attente d’acceptation se trouvent dans votre centre de consultation.'
		],
		panel: [
			{ label: 'Demandes en attente', value: '{{openRequestCount}}' },
			{ label: 'Attente la plus longue', value: '{{oldestRequestAge}}' },
			{ label: 'Situation au', value: '{{digestGeneratedAt}}' }
		],
		cta: { label: 'Voir les demandes', href: '{{requestUrl}}' },
		footnote:
			'Ce récapitulatif arrive une fois par jour. Vous pouvez vous en désabonner dans les paramètres.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-angefragt': {
		subject: 'Transfert demandé',
		preheader: 'Une consultation doit vous être transférée.',
		headline: 'Une consultation doit vous être transférée',
		paragraphs: [
			'{{fromConsultantName}} demande à vous transférer une consultation en cours.',
			'Merci de vérifier dans l’espace de consultation si vous pouvez la reprendre.'
		],
		panel: [
			{ label: 'Dossier', value: '{{caseReference}}' },
			{ label: 'Demandé par', value: '{{fromConsultantName}}' },
			{ label: 'Demandé le', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Examiner le transfert', href: '{{requestUrl}}' },
		footnote:
			'Tant que vous n’avez pas accepté, la consultation reste chez le professionnel actuel.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-bestaetigt': {
		subject: 'Transfert confirmé',
		preheader: 'La responsabilité a changé.',
		headline: 'Le transfert est confirmé',
		paragraphs: [
			'La consultation a été reprise. {{toConsultantName}} en est responsable à partir de maintenant.',
			'La personne qui demande conseil en a été informée dans l’application.'
		],
		panel: [
			{ label: 'Dossier', value: '{{caseReference}}' },
			{ label: 'Nouvelle responsabilité', value: '{{toConsultantName}}' },
			{ label: 'Transféré le', value: '{{handoverAt}}' }
		],
		cta: { label: 'Ouvrir la consultation', href: '{{requestUrl}}' },
		footnote:
			'Votre accès à l’historique précédent prend fin avec le transfert.',
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'Nouveau retour dans l’échange entre professionnels',
		preheader: 'Un retour vous attend dans l’échange entre professionnels.',
		headline: 'Nouveau retour dans l’échange entre professionnels',
		paragraphs: [
			'Un nouveau retour vous attend dans l’échange protégé entre professionnels au sujet de l’une de vos consultations.',
			'Vous en verrez le contenu, chiffré, après votre connexion.'
		],
		panel: [
			{ label: 'Dossier', value: '{{caseReference}}' },
			{ label: 'Reçu le', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Lire le retour', href: '{{messageUrl}}' },
		footnote:
			'L’échange entre professionnels n’est pas visible par la personne qui demande conseil.',
		assurance: staffAssurance,
		footer
	},

	'mitteilung': {
		subject: '{{messageSubject}}',
		preheader: '{{messagePreview}}',
		headline: '{{messageHeadline}}',
		paragraphs: ['{{messageBody}}'],
		cta: { label: 'Aller sur {{platformName}}', href: '{{loginUrl}}' },
		assurance,
		footer
	},

	'anmeldelink': {
		subject: 'Votre lien de connexion pour {{platformName}}',
		preheader: 'Le lien est valable {{expiryMinutes}} minutes.',
		headline: 'Votre lien de connexion',
		paragraphs: [
			'Ce lien vous connecte sans mot de passe.',
			'Il est valable {{expiryMinutes}} minutes et ne fonctionne qu’une seule fois.'
		],
		cta: { label: 'Se connecter maintenant', href: '{{loginUrl}}' },
		footnote:
			'Si vous ne vouliez pas vous connecter, ignorez cet e-mail. Sans le lien, il ne se passe rien.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einmalcode': {
		subject: 'Votre code à usage unique pour la connexion',
		preheader: 'Le code est valable {{expiryMinutes}} minutes.',
		headline: 'Votre code à usage unique',
		paragraphs: ['Saisissez ce code dans la fenêtre de connexion.'],
		code: { label: 'Code', value: '{{otpCode}}' },
		cta: { label: 'Aller à la connexion', href: '{{loginUrl}}' },
		footnote:
			'Si vous ne vouliez pas vous connecter, changez votre mot de passe.',
		assurance: codeAssurance,
		footer: securityFooter
	},

	'einladung-traeger': {
		subject: 'Invitation : {{tenantName}} sur {{platformName}}',
		preheader: 'Configurez votre accès à l’administration.',
		headline: 'Bienvenue sur {{platformName}}',
		paragraphs: [
			'Un accès à l’administration de {{platformName}} a été créé pour {{tenantName}}.',
			'Ce lien vous permet de définir votre mot de passe et de terminer la configuration.'
		],
		panel: [
			{ label: 'Organisme', value: '{{tenantName}}' },
			{ label: 'Lien valable jusqu’au', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Configurer l’accès', href: '{{inviteUrl}}' },
		footnote:
			'Si vous n’attendiez pas cette invitation, contactez la personne qui vous a invité.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einladung-fachkraft': {
		subject: 'Invitation au service de conseil sur {{platformName}}',
		preheader: 'Configurez votre accès en tant que professionnel.',
		headline: 'Vous avez été invité au service de conseil',
		paragraphs: [
			'{{agencyName}} vous a invité sur {{platformName}} en tant que professionnel.',
			'Ce lien vous permet de définir votre mot de passe et de configurer la connexion à deux facteurs.'
		],
		panel: [
			{ label: 'Centre de consultation', value: '{{agencyName}}' },
			{ label: 'Lien valable jusqu’au', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Configurer l’accès', href: '{{inviteUrl}}' },
		footnote:
			'Sans connexion à deux facteurs, aucun accès aux consultations n’est possible.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'avv-unterschrift': {
		subject: 'Contrat de sous-traitance à signer',
		preheader: 'Le contrat pour {{tenantName}} est prêt.',
		headline: 'Le contrat est prêt à être signé',
		paragraphs: [
			'Un contrat de sous-traitance a été établi pour {{tenantName}}.',
			'Merci d’examiner le contrat et de le signer par voie électronique.'
		],
		panel: [
			{ label: 'Organisme', value: '{{tenantName}}' },
			{ label: 'Mis à disposition le', value: '{{dpaProvidedAt}}' },
			{ label: 'À signer avant le', value: '{{dpaExpiresAt}}' }
		],
		cta: { label: 'Ouvrir le contrat', href: '{{dpaUrl}}' },
		footnote:
			'Sans contrat de sous-traitance signé, le service de conseil reste bloqué pour cet organisme.',
		assurance: legalAssurance,
		footer: legalFooter
	},

	'team-aenderung': {
		subject: 'Changement dans votre équipe',
		preheader: 'Vos responsabilités ont changé.',
		headline: 'Quelque chose a changé dans votre équipe',
		paragraphs: [
			'{{teamChangeStatement}}',
			'Vous verrez ce que cela signifie pour vos responsabilités dans l’espace de consultation.'
		],
		panel: [
			{ label: 'Dossier', value: '{{caseReference}}' },
			{ label: 'Modifié le', value: '{{teamChangedAt}}' }
		],
		cta: { label: 'Aller à l’espace de consultation', href: '{{appUrl}}' },
		footnote:
			'C’est votre organisme qui décide si cette notification est envoyée.',
		assurance: staffAssurance,
		footer
	},

	'smtp-test': {
		subject: 'Test SMTP réussi',
		preheader: 'L’envoi via {{smtpHost}} fonctionne.',
		headline: 'Le test SMTP est bien arrivé',
		paragraphs: [
			'Si vous lisez cet e-mail, l’envoi via les données SMTP enregistrées fonctionne.'
		],
		panel: [
			{ label: 'Serveur', value: '{{smtpHost}}' },
			{ label: 'Expéditeur', value: '{{smtpFrom}}' },
			{ label: 'Envoyé', value: '{{sentAt}}' }
		],
		cta: { label: 'Aller à l’administration', href: '{{appUrl}}' },
		footnote:
			'Cet e-mail n’est envoyé que sur demande depuis l’administration.',
		assurance: staffAssurance,
		footer
	},

	'email-geaendert': {
		subject: 'Votre adresse e-mail a été modifiée',
		preheader: 'La modification est active dès maintenant.',
		headline: 'Votre adresse e-mail a été modifiée',
		paragraphs: [
			'L’adresse e-mail de l’accès {{username}} a été modifiée. Les notifications sont désormais envoyées à cette adresse.',
			'Si ce n’était pas vous, changez immédiatement votre mot de passe.'
		],
		cta: { label: 'Aller au profil', href: '{{appUrl}}' },
		assurance: accountAssurance,
		footer: securityFooter
	}
};
