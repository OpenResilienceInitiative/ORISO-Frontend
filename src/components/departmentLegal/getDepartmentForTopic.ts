import {
	AgencyDataInterface,
	AgencyDepartmentDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';

/**
 * The Fachbereich (Department = Beratungsstelle x Thema) a selected
 * agency/topic pair resolves to — the level every legal text and the consent
 * sentence actually live on (ADR-003, ADR-021).
 *
 * Its own module rather than a named export of `DepartmentLegalSection`: this
 * is a pure lookup that callers outside the legal section need (the agency
 * details panel, the registration consent label), and importing a whole MUI
 * component tree to find an id in an array is the kind of coupling that makes
 * a unit test drag half the app into jsdom.
 */
export const getDepartmentForTopic = (
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): AgencyDepartmentDataInterface | undefined =>
	topic?.id !== undefined
		? agency?.departments?.find(
				(department) => department.topicId === topic.id
			)
		: undefined;
