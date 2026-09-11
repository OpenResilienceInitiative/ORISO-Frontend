/**
 * English. Used for tenants that offer counselling in English and as the
 * fallback when a recipient's language is unknown.
 */

import { EmailContent } from '../kit/emailTemplate';
import { EmailId } from './emailCatalogue';

const footer = {
	offeredBy: '{{platformName}} is a service provided by {{orgName}}.',
	links: [
		{ label: 'Settings', href: '{{settingsUrl}}' },
		{ label: 'Privacy', href: '{{privacyUrl}}' },
		{ label: 'Imprint', href: '{{imprintUrl}}' },
		{ label: 'Unsubscribe from notifications', href: '{{unsubscribeUrl}}' }
	],
	automatedNote:
		'This email was sent automatically. Please do not reply to it.'
};

const assurance =
	'Your messages are encrypted end-to-end. Nobody but you and your counselling service can read them – not even us.';

/** See `de-sie` — no unsubscribe link, because nothing switches these off. */
const securityFooter = {
	offeredBy: '{{platformName}} is a service provided by {{orgName}}.',
	links: [
		{ label: 'Privacy', href: '{{privacyUrl}}' },
		{ label: 'Imprint', href: '{{imprintUrl}}' }
	],
	automatedNote:
		'This email is part of signing in and cannot be unsubscribed from. Please do not reply to it.'
};

const legalFooter = {
	...securityFooter,
	automatedNote:
		'This email is part of the contractual relationship and cannot be unsubscribed from. Please do not reply to it.'
};

const staffAssurance =
	'Counselling content never appears in an email. You only ever see it encrypted, after signing in.';

const securityAssurance =
	'We will never ask for your password by email. Do not pass this link on to anyone.';

const codeAssurance =
	'We will never ask for your password by email. Do not pass this code on to anyone.';

const accountAssurance =
	'We will never ask for your password by email. We always tell you when your account changes.';

const legalAssurance =
	'This email is part of the contractual relationship between {{orgName}} and {{tenantName}}.';

export const en: Record<EmailId, EmailContent> = {
	'neue-nachricht': {
		subject: 'You have a new message',
		preheader: 'A new message is waiting for you in your counselling.',
		headline: 'You have a new message',
		paragraphs: [
			'A new message is waiting for you in your counselling at {{platformName}}.',
			'For privacy reasons we show neither content nor names here. You can read the message, encrypted, once you sign in.'
		],
		cta: { label: 'Go to the message', href: '{{messageUrl}}' },
		footnote:
			'You do not have to reply straight away. The message stays in your inbox as long as you need it.',
		assurance,
		footer
	},

	'willkommen': {
		subject: 'Welcome to {{platformName}}',
		preheader:
			'Your anonymous account is ready – here is what happens next.',
		headline: 'Your account is ready',
		paragraphs: [
			'You have registered anonymously with {{platformName}}. We are glad you are here.',
			'Please keep your username safe. For privacy reasons we cannot recover it.'
		],
		panel: [{ label: 'Username', value: '{{username}}' }],
		cta: { label: 'Sign in to your counselling', href: '{{loginUrl}}' },
		footnote: 'Your advisor will respond within 2 working days.',
		assurance,
		footer
	},

	'passwort-zuruecksetzen': {
		subject: 'Set a new password',
		preheader: 'The link is valid for {{expiryHours}} hours.',
		headline: 'Set a new password',
		paragraphs: [
			'You asked for a new password for your account at {{platformName}}.',
			'The link is valid for {{expiryHours}} hours and can only be used once.'
		],
		cta: { label: 'Set a new password', href: '{{resetUrl}}' },
		footnote:
			'If you did not ask for this, simply ignore this email. Your password stays unchanged.',
		assurance,
		footer
	},

	'termin': {
		subject: 'Your appointment on {{appointmentDate}}',
		preheader:
			'{{appointmentDate}}, {{appointmentTime}} – {{appointmentType}}.',
		headline: 'Your appointment is confirmed',
		paragraphs: [
			'We have noted your appointment. There is nothing you need to prepare – just come as you are.'
		],
		panel: [
			{ label: 'Date', value: '{{appointmentDate}}' },
			{ label: 'Time', value: '{{appointmentTime}}' },
			{ label: 'Type', value: '{{appointmentType}}' },
			{ label: 'Place', value: '{{locationName}}<br>{{locationAddress}}' }
		],
		cta: { label: 'View appointment', href: '{{appointmentUrl}}' },
		secondaryAction: {
			label: 'Open the address on a map',
			href: '{{mapUrl}}'
		},
		footnote:
			'You will get a reminder 24 hours beforehand. You can cancel at any time.',
		assurance,
		footer
	},

	'beraterin-kontakt': {
		subject: 'How to reach your counselling service',
		preheader: 'Direct line, phone hours and booking at a glance.',
		headline: 'How to reach your counselling service',
		paragraphs: [
			'Besides the protected chat you can also reach your counselling service by phone or book an appointment directly.',
			'Your account stays anonymous – you decide what you share.'
		],
		panel: [
			{ label: 'Service', value: '{{consultantName}}' },
			{ label: 'Direct line', value: '{{consultantPhone}}' },
			{ label: 'Phone hours', value: '{{consultantHours}}' },
			{ label: 'Email', value: '{{consultantEmail}}' }
		],
		cta: { label: 'Book an appointment', href: '{{bookingUrl}}' },
		secondaryAction: {
			label: 'Go to the protected chat',
			href: '{{messageUrl}}'
		},
		footnote:
			'Outside phone hours, writing in the chat works best. We reply within 2 working days.',
		assurance,
		footer
	},

	'anfrage-zugewiesen': {
		subject: 'New counselling request',
		preheader: 'A new request is waiting for you.',
		headline: 'A new request is waiting for you',
		paragraphs: [
			'A new counselling request has been assigned to you. You will see the details after signing in.'
		],
		panel: [
			{ label: 'Topic', value: '{{requestTopic}}' },
			{ label: 'Postcode', value: '{{requestPostcode}}' },
			{ label: 'Received', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Open request', href: '{{requestUrl}}' },
		footnote: 'Please accept the request within 2 working days.',
		assurance,
		footer
	},

	'systemhinweis': {
		subject: 'Scheduled maintenance on {{maintenanceDate}}',
		preheader:
			'Unavailable from {{maintenanceStart}} to {{maintenanceEnd}}.',
		headline: 'A short maintenance break',
		paragraphs: [
			'On {{maintenanceDate}}, {{platformName}} will be unavailable between {{maintenanceStart}} and {{maintenanceEnd}}.',
			'After that you can carry on writing as usual.'
		],
		cta: { label: 'View status page', href: '{{statusUrl}}' },
		footnote: 'Messages you have already written will not be lost.',
		assurance,
		footer
	},

	'neue-anfrage': {
		subject: 'New enquiry at your counselling service',
		preheader: 'An enquiry is waiting to be accepted.',
		headline: 'A new enquiry has arrived',
		paragraphs: [
			'A new counselling enquiry has arrived at your counselling service. It has not been assigned to anyone yet.',
			'Whoever accepts it takes on the counselling.'
		],
		panel: [
			{ label: 'Topic', value: '{{requestTopic}}' },
			{ label: 'Postcode', value: '{{requestPostcode}}' },
			{ label: 'Received', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'View enquiry', href: '{{requestUrl}}' },
		footnote: 'Please accept the enquiry within 2 working days.',
		assurance: staffAssurance,
		footer
	},

	'direkte-anfrage': {
		subject: 'An enquiry is addressed to you directly',
		preheader: 'This enquiry was written for you.',
		headline: 'An enquiry is addressed to you directly',
		paragraphs: [
			'While writing their enquiry, someone seeking advice chose you specifically.',
			'If you cannot take it on, please return it to the counselling service so it does not sit unanswered.'
		],
		panel: [
			{ label: 'Topic', value: '{{requestTopic}}' },
			{ label: 'Received', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Open enquiry', href: '{{requestUrl}}' },
		footnote: 'Please reply within 2 working days.',
		assurance: staffAssurance,
		footer
	},

	'tagesuebersicht': {
		subject: 'Your daily summary',
		preheader: 'Open enquiries at your counselling service.',
		headline: 'Your daily summary',
		paragraphs: [
			'There are open enquiries waiting to be accepted at your counselling service.'
		],
		panel: [
			{ label: 'Open enquiries', value: '{{openRequestCount}}' },
			{ label: 'Longest wait', value: '{{oldestRequestAge}}' },
			{ label: 'As of', value: '{{digestGeneratedAt}}' }
		],
		cta: { label: 'View enquiries', href: '{{requestUrl}}' },
		footnote:
			'This summary arrives once a day. You can unsubscribe from it in your settings.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-angefragt': {
		subject: 'Handover requested',
		preheader: 'A counselling case is to be handed over to you.',
		headline: 'A counselling case is to be handed over to you',
		paragraphs: [
			'{{fromConsultantName}} has asked to hand an ongoing counselling case over to you.',
			'Please check in the counselling area whether you can take it on.'
		],
		panel: [
			{ label: 'Case', value: '{{caseReference}}' },
			{ label: 'Requested by', value: '{{fromConsultantName}}' },
			{ label: 'Requested on', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Review handover', href: '{{requestUrl}}' },
		footnote:
			'Until you agree, the case stays with the counsellor who has it now.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-bestaetigt': {
		subject: 'Handover confirmed',
		preheader: 'Responsibility has changed.',
		headline: 'The handover is confirmed',
		paragraphs: [
			'The counselling case has been taken on. {{toConsultantName}} is now responsible.',
			'The person seeking advice has been informed in the application.'
		],
		panel: [
			{ label: 'Case', value: '{{caseReference}}' },
			{ label: 'Now with', value: '{{toConsultantName}}' },
			{ label: 'Handed over on', value: '{{handoverAt}}' }
		],
		cta: { label: 'Open counselling', href: '{{requestUrl}}' },
		footnote:
			'Your access to the previous conversation ends with the handover.',
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'New reply in the professional exchange',
		preheader: 'A reply is waiting for you in the professional exchange.',
		headline: 'New reply in the professional exchange',
		paragraphs: [
			'There is a new reply in the protected professional exchange about one of your counselling cases.',
			'You will see the content encrypted, after signing in.'
		],
		panel: [
			{ label: 'Case', value: '{{caseReference}}' },
			{ label: 'Received', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Read reply', href: '{{messageUrl}}' },
		footnote:
			'The professional exchange is not visible to the person seeking advice.',
		assurance: staffAssurance,
		footer
	},

	'mitteilung': {
		subject: '{{messageSubject}}',
		preheader: '{{messagePreview}}',
		headline: '{{messageHeadline}}',
		paragraphs: ['{{messageBody}}'],
		cta: { label: 'Go to {{platformName}}', href: '{{loginUrl}}' },
		assurance,
		footer
	},

	'anmeldelink': {
		subject: 'Your sign-in link for {{platformName}}',
		preheader: 'The link is valid for {{expiryMinutes}} minutes.',
		headline: 'Your sign-in link',
		paragraphs: [
			'This link signs you in without a password.',
			'It is valid for {{expiryMinutes}} minutes and works exactly once.'
		],
		cta: { label: 'Sign in now', href: '{{loginUrl}}' },
		footnote:
			'If you did not want to sign in, ignore this email. Nothing happens without the link.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einmalcode': {
		subject: 'Your one-time code for signing in',
		preheader: 'The code is valid for {{expiryMinutes}} minutes.',
		headline: 'Your one-time code',
		paragraphs: ['Enter this code in the sign-in window.'],
		code: { label: 'Code', value: '{{otpCode}}' },
		cta: { label: 'Go to sign-in', href: '{{loginUrl}}' },
		footnote:
			'If you did not want to sign in, please change your password.',
		assurance: codeAssurance,
		footer: securityFooter
	},

	'einladung-traeger': {
		subject: 'Invitation: {{tenantName}} on {{platformName}}',
		preheader: 'Set up your administration access.',
		headline: 'Welcome to {{platformName}}',
		paragraphs: [
			'An administration account for {{tenantName}} has been created on {{platformName}}.',
			'Use the link to set your password and finish setting up.'
		],
		panel: [
			{ label: 'Organisation', value: '{{tenantName}}' },
			{ label: 'Link valid until', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Set up access', href: '{{inviteUrl}}' },
		footnote:
			'If you were not expecting this invitation, please contact the person who invited you.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einladung-fachkraft': {
		subject: 'Invitation to counsel on {{platformName}}',
		preheader: 'Set up your counsellor access.',
		headline: 'You have been invited to counsel',
		paragraphs: [
			'{{agencyName}} has invited you to {{platformName}} as a counsellor.',
			'Use the link to set your password and set up two-factor sign-in.'
		],
		panel: [
			{ label: 'Counselling service', value: '{{agencyName}}' },
			{ label: 'Link valid until', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Set up access', href: '{{inviteUrl}}' },
		footnote:
			'Without two-factor sign-in there is no access to counselling.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'avv-unterschrift': {
		subject: 'Data processing agreement ready for signature',
		preheader: 'The agreement for {{tenantName}} is ready.',
		headline: 'The agreement is ready for signature',
		paragraphs: [
			'A data processing agreement has been prepared for {{tenantName}}.',
			'Please review the agreement and sign it digitally.'
		],
		panel: [
			{ label: 'Organisation', value: '{{tenantName}}' },
			{ label: 'Provided on', value: '{{dpaProvidedAt}}' },
			{ label: 'To be signed by', value: '{{dpaExpiresAt}}' }
		],
		cta: { label: 'Open agreement', href: '{{dpaUrl}}' },
		footnote:
			'Counselling stays blocked for this organisation until the agreement is signed.',
		assurance: legalAssurance,
		footer: legalFooter
	},

	'team-aenderung': {
		subject: 'A change in your team',
		preheader: 'Your responsibilities have changed.',
		headline: 'Something has changed in your team',
		paragraphs: [
			'{{teamChangeStatement}}',
			'You can see what this means for your responsibilities in the counselling area.'
		],
		panel: [
			{ label: 'Case', value: '{{caseReference}}' },
			{ label: 'Changed on', value: '{{teamChangedAt}}' }
		],
		cta: { label: 'Go to counselling', href: '{{appUrl}}' },
		footnote:
			'Whether this notification is sent at all is decided by your organisation.',
		assurance: staffAssurance,
		footer
	},

	'smtp-test': {
		subject: 'SMTP test successful',
		preheader: 'Sending via {{smtpHost}} works.',
		headline: 'The SMTP test arrived',
		paragraphs: [
			'If you are reading this email, sending via the configured SMTP settings works.'
		],
		panel: [
			{ label: 'Server', value: '{{smtpHost}}' },
			{ label: 'Sender', value: '{{smtpFrom}}' },
			{ label: 'Sent', value: '{{sentAt}}' }
		],
		cta: { label: 'Go to administration', href: '{{appUrl}}' },
		footnote:
			'This email is only ever sent on request from administration.',
		assurance: staffAssurance,
		footer
	},

	'email-geaendert': {
		subject: 'Your email address has been changed',
		preheader: 'The change is active from now on.',
		headline: 'Your email address has been changed',
		paragraphs: [
			'The email address for the account {{username}} has been changed. Notifications now go to this address.',
			'If this was not you, please change your password immediately.'
		],
		cta: { label: 'Go to profile', href: '{{appUrl}}' },
		assurance: accountAssurance,
		footer: securityFooter
	}
};
