import _ from 'lodash';
import { flatten, unflatten } from 'flat';

/**
 * Combine a Weblate payload with a bundled catalogue so the **bundle wins
 * on conflict**. Weblate still contributes keys the bundle does not ship
 * (Weblate-only languages, newly translated strings).
 *
 * The previous order (`_.merge(bundle, weblate)`) let a stale or partial
 * Weblate file replace complete repo catalogues — leftover English /
 * German on signup after #1164 / #1170 / #1227 (ORISO-Frontend#1154).
 */
export const mergeWeblateCatalogue = (
	bundle: object,
	weblatePayload: object
): object =>
	unflatten(
		_.merge({}, flatten(weblatePayload || {}), flatten(bundle || {}))
	) as object;
