import { describe, expect, it } from 'vite-plus/test';
import de from './de/common.json';
import deInformal from './de@informal/common.json';
import en from './en/common.json';
import fr from './fr/common.json';
import ru from './ru/common.json';
import ti from './ti/common.json';
import tr from './tr/common.json';

/**
 * FE#1050 / UserService#1655: the copy around move proposals in every
 * locale. de@informal has no own text for these keys: none addresses
 * the reader, so it takes the German one.
 */
const CATALOGUES = { de, en, fr, ru, tr, ti };

const SWITCH: Record<keyof typeof CATALOGUES, string> = {
	de: 'Ein Termin wurde angesetzt, verschoben, abgesagt oder eine Verschiebung wurde vorgeschlagen',
	en: 'An appointment was scheduled, postponed or cancelled, or a move was proposed',
	fr: 'Un rendez-vous a été fixé, reporté ou annulé, ou un déplacement a été proposé',
	ru: 'Встреча была запланирована, отложена или отменена, или был предложен перенос',
	tr: 'Bir randevu planlandı, ertelendi veya iptal edildi ya da taşıma önerildi',
	ti: 'ቆጸራ ተታሒዙ፡ ተናዊሑ፡ ተሰሪዙ ወይ ምቕያር ግዜ ተማዕዲዩ ኣሎ።'
};

describe('move proposal copy in every locale (FE#1050)', () => {
	it.each(Object.keys(CATALOGUES) as (keyof typeof CATALOGUES)[])(
		'%s: the counsellor\'s "Termine" mail switch names proposals too',
		(locale) => {
			expect(
				CATALOGUES[locale].profile.notifications
					.appointmentNotificationEnabled.description
			).toBe(SWITCH[locale]);
		}
	);

	it('lets du take the German text: neither addresses the reader', () => {
		const informal = deInformal as {
			profile?: {
				notifications?: { appointmentNotificationEnabled?: unknown };
			};
		};
		expect(
			informal.profile?.notifications?.appointmentNotificationEnabled
		).toBeUndefined();
	});
});
