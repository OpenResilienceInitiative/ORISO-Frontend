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
	}
};
