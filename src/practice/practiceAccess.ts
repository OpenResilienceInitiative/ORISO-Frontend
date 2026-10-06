import { AUTHORITIES, hasUserAuthority } from '../globalState';
import type { AppConfigInterface } from '../globalState/interfaces';
import type { UserDataInterface } from '../globalState/interfaces/UserDataInterface';
import { isPracticeAreaEnabled } from './releaseFlag';

/**
 * Who may see and start the practice flows (spec 3.1): counsellors only, while
 * the platform master switch `enableWalkthrough` is on and the release flag is
 * on. The personal tutorial switch is deliberately not part of it: a manual
 * start works with that switch off. One rule for the cards and the tour host.
 */
export const canUsePractice = (
	settings: Pick<AppConfigInterface, 'releaseToggles'> & {
		enableWalkthrough?: boolean;
	},
	userData: UserDataInterface | null | undefined
): boolean =>
	!!settings?.enableWalkthrough &&
	isPracticeAreaEnabled(settings) &&
	!!hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData as never);
