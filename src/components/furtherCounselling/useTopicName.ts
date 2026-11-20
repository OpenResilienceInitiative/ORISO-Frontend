import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { TopicsContext } from '../../globalState/provider/TopicsProvider';
import { getRegistrationTopicDisplay } from '../registration/registrationDesign/registrationDesign';

/**
 * The topic a notice names, as the registration names it in the reader's
 * language. An unknown or not yet loaded topic reads "ein weiteres Thema"
 * instead of an id or an error.
 */
export const useTopicName = (topicId?: number | null): string => {
	const { t: translate, i18n } = useTranslation();
	const topics = useContext(TopicsContext)?.topics;
	const topic =
		topicId != null ? topics?.find((entry) => entry.id === topicId) : null;
	if (!topic) return translate('furtherCounselling.card.topicUnknown');
	return (
		getRegistrationTopicDisplay(topic, i18n?.language)?.title ||
		topic.name ||
		translate('furtherCounselling.card.topicUnknown')
	);
};
