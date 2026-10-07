import { isPracticeId } from './practiceIds';

/**
 * Path segments of a sessions route that name a case: numeric session ids
 * and Matrix room ids. Practice ids are negative or carry the practice prefix,
 * so they never look like a real case.
 */
const caseSegments = (pathname: string): string[] =>
	pathname.startsWith('/sessions/')
		? pathname
				.split('/')
				.map((segment) => {
					try {
						return decodeURIComponent(segment);
					} catch {
						return segment;
					}
				})
				.filter(
					(segment) =>
						/^-?\d+$/.test(segment) || segment.startsWith('!')
				)
		: [];

/** A real case route: must not open inside the practice world. */
export const addressesRealCase = (pathname: string): boolean =>
	caseSegments(pathname).some((segment) => !isPracticeId(segment));

/** A practice case route: must not open outside practice (e.g. Back after End). */
export const addressesPracticeCase = (pathname: string): boolean =>
	caseSegments(pathname).some((segment) => isPracticeId(segment));
