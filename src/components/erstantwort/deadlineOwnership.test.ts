import { describe, expect, it } from 'vitest';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import tr from '../../resources/i18n/tr/common.json';

/**
 * ADR-018 §10: **the Antwortfrist has exactly one owner.**
 *
 * It is held as a number per Träger and rendered by the `responseDeadline`
 * Baustein, so that the promise is one value which can be compared against what
 * actually happened. The send confirmation used to state it as prose as well,
 * which meant two places could disagree the moment a Träger changed the number —
 * and the one that would be wrong is the one nobody would think to update.
 *
 * This test is the guard. It fails if the deadline creeps back into the send
 * confirmation, in any locale.
 */

const LOCALES: Record<string, any> = {
	de,
	'de@informal': deInformal,
	en,
	fr,
	ru,
	tr
};

/** Any duration phrasing: a digit, or a working-day noun in the six locales. */
const DEADLINE_CLAIM =
	/\d|arbeitstag|werktag|working day|jour ouvrable|рабочих дн|рабочий дн|iş günü/i;

describe('the send confirmation does not restate the response deadline', () => {
	Object.entries(LOCALES).forEach(([locale, resources]) => {
		const overlay = resources?.enquiry?.write?.overlay;
		if (!overlay?.copy) return;

		it(`${locale}: enquiry.write.overlay.copy names no deadline`, () => {
			expect(overlay.copy).not.toMatch(DEADLINE_CLAIM);
		});
	});

	it('the deadline still has an owner — the responseDeadline Baustein states it', () => {
		/* Every loaded locale, not just German: a locale whose translation lost
		   the placeholder would render "Sie erhalten innerhalb von  Werktagen"
		   and the promise would silently have no number in it. */
		Object.entries(LOCALES).forEach(([locale, resources]) => {
			expect(
				resources?.erstantwort?.responseDeadline?.body,
				`${locale} lost the {{deadlineDays}} placeholder`
			).toMatch(/\{\{deadlineDays\}\}/);
		});
	});
});
