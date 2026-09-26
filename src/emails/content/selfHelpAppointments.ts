import { EmailFooterContent } from '../kit/emailMolecules';
import { EmailContent } from '../kit/emailTemplate';
import { EmailId, EmailLocale } from './emailCatalogue';

type Occasion = 'bestaetigt' | 'verschoben' | 'abgesagt' | 'erinnerung';
type Role = 'teilnahme' | 'beratung';
type SelfHelpId = Extract<EmailId, `selbsthilfe-termin-${Occasion}-${Role}`>;

interface OccasionCopy {
	subject: string;
	preheader: string;
	headline: string;
	paragraph: string;
}

interface LocaleCopy {
	occasions: Record<Occasion, OccasionCopy>;
	role: Record<Role, string>;
	date: string;
	time: string;
	open: string;
}

// German formal is the authored source. Other languages follow the catalogue's
// provenance/review status; these copies do not assert human review.
const copy: Record<EmailLocale, LocaleCopy> = {
	'de-sie': {
		occasions: {
			bestaetigt: {
				subject: 'Ihr Termin wurde bestätigt',
				preheader:
					'Der Termin ist für {{appointmentDate}} um {{appointmentTime}} Uhr vorgesehen.',
				headline: 'Ihr Termin steht fest',
				paragraph: 'Ein Termin wurde für Sie eingetragen.'
			},
			verschoben: {
				subject: 'Ihr Termin wurde verschoben',
				preheader:
					'Der neue Termin ist {{appointmentDate}} um {{appointmentTime}} Uhr.',
				headline: 'Ihr Termin hat sich geändert',
				paragraph:
					'Bitte beachten Sie das neue Datum und die neue Uhrzeit.'
			},
			abgesagt: {
				subject: 'Ihr Termin wurde abgesagt',
				preheader:
					'Der Termin am {{appointmentDate}} um {{appointmentTime}} Uhr findet nicht statt.',
				headline: 'Ihr Termin entfällt',
				paragraph: 'Der geplante Termin findet nicht statt.'
			},
			erinnerung: {
				subject: 'Erinnerung an Ihren Termin',
				preheader:
					'Ihr Termin ist {{appointmentDate}} um {{appointmentTime}} Uhr.',
				headline: 'Ihr Termin steht bevor',
				paragraph:
					'Dies ist eine Erinnerung an Ihren bevorstehenden Termin.'
			}
		},
		role: {
			teilnahme:
				'Sie nehmen an diesem Termin teil. Weitere Informationen sehen Sie nach der Anmeldung.',
			beratung:
				'Sie begleiten diesen Termin als Fachkraft. Weitere Informationen sehen Sie nach der Anmeldung.'
		},
		date: 'Datum',
		time: 'Uhrzeit',
		open: 'Termin ansehen'
	},
	'de-du': {
		occasions: {
			bestaetigt: {
				subject: 'Dein Termin wurde bestätigt',
				preheader:
					'Dein Termin ist {{appointmentDate}} um {{appointmentTime}} Uhr.',
				headline: 'Dein Termin steht fest',
				paragraph: 'Ein Termin wurde für dich eingetragen.'
			},
			verschoben: {
				subject: 'Dein Termin wurde verschoben',
				preheader:
					'Dein neuer Termin ist {{appointmentDate}} um {{appointmentTime}} Uhr.',
				headline: 'Dein Termin hat sich geändert',
				paragraph: 'Bitte beachte das neue Datum und die neue Uhrzeit.'
			},
			abgesagt: {
				subject: 'Dein Termin wurde abgesagt',
				preheader:
					'Der Termin am {{appointmentDate}} um {{appointmentTime}} Uhr findet nicht statt.',
				headline: 'Dein Termin entfällt',
				paragraph: 'Der geplante Termin findet nicht statt.'
			},
			erinnerung: {
				subject: 'Erinnerung an deinen Termin',
				preheader:
					'Dein Termin ist {{appointmentDate}} um {{appointmentTime}} Uhr.',
				headline: 'Dein Termin steht bevor',
				paragraph:
					'Dies ist eine Erinnerung an deinen bevorstehenden Termin.'
			}
		},
		role: {
			teilnahme:
				'Du nimmst an diesem Termin teil. Mehr siehst du nach der Anmeldung.',
			beratung:
				'Du begleitest diesen Termin als Fachkraft. Mehr siehst du nach der Anmeldung.'
		},
		date: 'Datum',
		time: 'Uhrzeit',
		open: 'Termin ansehen'
	},
	'en': {
		occasions: {
			bestaetigt: {
				subject: 'Your appointment is confirmed',
				preheader:
					'Your appointment is on {{appointmentDate}} at {{appointmentTime}}.',
				headline: 'Your appointment is confirmed',
				paragraph: 'An appointment has been scheduled for you.'
			},
			verschoben: {
				subject: 'Your appointment has changed',
				preheader:
					'The new time is {{appointmentDate}} at {{appointmentTime}}.',
				headline: 'Your appointment has changed',
				paragraph: 'Please note the new date and time.'
			},
			abgesagt: {
				subject: 'Your appointment was cancelled',
				preheader:
					'The appointment on {{appointmentDate}} at {{appointmentTime}} will not take place.',
				headline: 'Your appointment was cancelled',
				paragraph: 'The planned appointment will not take place.'
			},
			erinnerung: {
				subject: 'Appointment reminder',
				preheader:
					'Your appointment is on {{appointmentDate}} at {{appointmentTime}}.',
				headline: 'Your appointment is coming up',
				paragraph: 'This is a reminder about your upcoming appointment.'
			}
		},
		role: {
			teilnahme:
				'You are attending this appointment. Sign in to see more information.',
			beratung:
				'You are supporting this appointment as a counselor. Sign in to see more information.'
		},
		date: 'Date',
		time: 'Time',
		open: 'View appointment'
	},
	'fr': {
		occasions: {
			bestaetigt: {
				subject: 'Votre rendez-vous est confirmé',
				preheader:
					'Votre rendez-vous est prévu le {{appointmentDate}} à {{appointmentTime}}.',
				headline: 'Votre rendez-vous est confirmé',
				paragraph: 'Un rendez-vous a été fixé pour vous.'
			},
			verschoben: {
				subject: 'Votre rendez-vous a été déplacé',
				preheader:
					'Le nouvel horaire est le {{appointmentDate}} à {{appointmentTime}}.',
				headline: 'Votre rendez-vous a changé',
				paragraph:
					'Veuillez noter la nouvelle date et la nouvelle heure.'
			},
			abgesagt: {
				subject: 'Votre rendez-vous a été annulé',
				preheader:
					'Le rendez-vous du {{appointmentDate}} à {{appointmentTime}} n’aura pas lieu.',
				headline: 'Votre rendez-vous est annulé',
				paragraph: 'Le rendez-vous prévu n’aura pas lieu.'
			},
			erinnerung: {
				subject: 'Rappel de votre rendez-vous',
				preheader:
					'Votre rendez-vous est le {{appointmentDate}} à {{appointmentTime}}.',
				headline: 'Votre rendez-vous approche',
				paragraph: 'Voici un rappel de votre prochain rendez-vous.'
			}
		},
		role: {
			teilnahme:
				'Vous participez à ce rendez-vous. Connectez-vous pour en savoir plus.',
			beratung:
				'Vous accompagnez ce rendez-vous en tant que professionnel. Connectez-vous pour en savoir plus.'
		},
		date: 'Date',
		time: 'Heure',
		open: 'Voir le rendez-vous'
	},
	'ru': {
		occasions: {
			bestaetigt: {
				subject: 'Ваша встреча подтверждена',
				preheader:
					'Встреча состоится {{appointmentDate}} в {{appointmentTime}}.',
				headline: 'Встреча подтверждена',
				paragraph: 'Для вас назначена встреча.'
			},
			verschoben: {
				subject: 'Время вашей встречи изменилось',
				preheader:
					'Новое время: {{appointmentDate}} в {{appointmentTime}}.',
				headline: 'Встреча перенесена',
				paragraph:
					'Пожалуйста, обратите внимание на новую дату и время.'
			},
			abgesagt: {
				subject: 'Ваша встреча отменена',
				preheader:
					'Встреча {{appointmentDate}} в {{appointmentTime}} не состоится.',
				headline: 'Встреча отменена',
				paragraph: 'Запланированная встреча не состоится.'
			},
			erinnerung: {
				subject: 'Напоминание о встрече',
				preheader:
					'Встреча состоится {{appointmentDate}} в {{appointmentTime}}.',
				headline: 'Встреча скоро состоится',
				paragraph: 'Это напоминание о предстоящей встрече.'
			}
		},
		role: {
			teilnahme:
				'Вы участвуете в этой встрече. Войдите в систему, чтобы узнать больше.',
			beratung:
				'Вы сопровождаете эту встречу как специалист. Войдите в систему, чтобы узнать больше.'
		},
		date: 'Дата',
		time: 'Время',
		open: 'Посмотреть встречу'
	},
	'ti': {
		occasions: {
			bestaetigt: {
				subject: 'ቆጸራኹም ተረጋጊጹ',
				preheader:
					'ቆጸራኹም {{appointmentDate}} ሰዓት {{appointmentTime}} እዩ።',
				headline: 'ቆጸራኹም ተረጋጊጹ',
				paragraph: 'ንዓኹም ቆጸራ ተመዲቡ ኣሎ።'
			},
			verschoben: {
				subject: 'ቆጸራኹም ተቐይሩ',
				preheader:
					'ሓድሽ ግዜ፦ {{appointmentDate}} ሰዓት {{appointmentTime}}።',
				headline: 'ቆጸራኹም ተቐይሩ',
				paragraph: 'በጃኹም ነቲ ሓድሽ ዕለትን ሰዓትን ኣስተብህሉ።'
			},
			abgesagt: {
				subject: 'ቆጸራኹም ተሰሪዙ',
				preheader:
					'ናይ {{appointmentDate}} ሰዓት {{appointmentTime}} ቆጸራ ኣይካየድን እዩ።',
				headline: 'ቆጸራኹም ተሰሪዙ',
				paragraph: 'እቲ ተመዲቡ ዝነበረ ቆጸራ ኣይካየድን እዩ።'
			},
			erinnerung: {
				subject: 'መዘኻኸሪ ቆጸራ',
				preheader:
					'ቆጸራኹም {{appointmentDate}} ሰዓት {{appointmentTime}} እዩ።',
				headline: 'ቆጸራኹም ቀሪቡ ኣሎ',
				paragraph: 'እዚ ናይ ዝመጽእ ቆጸራኹም መዘኻኸሪ እዩ።'
			}
		},
		role: {
			teilnahme: 'ኣብዚ ቆጸራ ትሳተፉ ኢኹም። ተወሳኺ ሓበሬታ ንምርኣይ እተዉ።',
			beratung: 'ነዚ ቆጸራ ከም ኣማኻሪ ትድግፉ ኢኹም። ተወሳኺ ሓበሬታ ንምርኣይ እተዉ።'
		},
		date: 'ዕለት',
		time: 'ሰዓት',
		open: 'ቆጸራ ርኣዩ'
	},
	'tr': {
		occasions: {
			bestaetigt: {
				subject: 'Randevunuz onaylandı',
				preheader:
					'Randevunuz {{appointmentDate}} saat {{appointmentTime}} için planlandı.',
				headline: 'Randevunuz onaylandı',
				paragraph: 'Sizin için bir randevu planlandı.'
			},
			verschoben: {
				subject: 'Randevunuz değiştirildi',
				preheader:
					'Yeni zaman: {{appointmentDate}} saat {{appointmentTime}}.',
				headline: 'Randevunuz değişti',
				paragraph: 'Lütfen yeni tarih ve saati not edin.'
			},
			abgesagt: {
				subject: 'Randevunuz iptal edildi',
				preheader:
					'{{appointmentDate}} saat {{appointmentTime}} randevusu yapılmayacak.',
				headline: 'Randevunuz iptal edildi',
				paragraph: 'Planlanan randevu yapılmayacak.'
			},
			erinnerung: {
				subject: 'Randevu hatırlatması',
				preheader:
					'Randevunuz {{appointmentDate}} saat {{appointmentTime}}.',
				headline: 'Randevunuz yaklaşıyor',
				paragraph: 'Bu, yaklaşan randevunuz için bir hatırlatmadır.'
			}
		},
		role: {
			teilnahme:
				'Bu randevuya katılıyorsunuz. Daha fazla bilgi için giriş yapın.',
			beratung:
				'Bu randevuya danışman olarak destek veriyorsunuz. Daha fazla bilgi için giriş yapın.'
		},
		date: 'Tarih',
		time: 'Saat',
		open: 'Randevuyu görüntüle'
	}
};

export const selfHelpAppointmentContent = (
	locale: EmailLocale,
	footer: EmailFooterContent,
	participantAssurance: string,
	counselorAssurance: string
): Record<SelfHelpId, EmailContent> => {
	const wording = copy[locale];
	const result = {} as Record<SelfHelpId, EmailContent>;
	for (const occasion of [
		'bestaetigt',
		'verschoben',
		'abgesagt',
		'erinnerung'
	] as const) {
		for (const role of ['teilnahme', 'beratung'] as const) {
			const id: SelfHelpId = `selbsthilfe-termin-${occasion}-${role}`;
			const event = wording.occasions[occasion];
			result[id] = {
				subject: event.subject,
				preheader: event.preheader,
				headline: event.headline,
				paragraphs: [event.paragraph, wording.role[role]],
				panel: [
					{ label: wording.date, value: '{{appointmentDate}}' },
					{ label: wording.time, value: '{{appointmentTime}}' }
				],
				cta: { label: wording.open, href: '{{appointmentUrl}}' },
				assurance:
					role === 'teilnahme'
						? participantAssurance
						: counselorAssurance,
				footer
			};
		}
	}
	return result;
};
