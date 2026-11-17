import { useCallback, useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext,
	RegistrationContext
} from '../../../globalState';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { apiGetAgencyById } from '../../../api';
import { apiGetTopicById } from '../../../api/apiGetTopicId';
import { AddonRegistrationResult } from '../../../addons/addonTypes';

/**
 * Takes what the registration add-on chose as if the person had picked the agency here: agency,
 * topic, postcode and consulting type go into the registration, the ref goes with the request.
 */
export const useRegistrationAddonComplete = (onNextClick: () => void) => {
	const { t } = useTranslation();
	const { registrationData, updateRegistrationData } =
		useContext(RegistrationContext);
	const { addNotification } = useContext(NotificationsContext) ?? {};
	const { topic: linkTopic } = useContext(UrlParamsContext) ?? {};
	const mainTopicId = registrationData?.mainTopic?.id;
	const busy = useRef(false);
	const active = useRef(true);

	useEffect(() => {
		active.current = true;
		return () => {
			active.current = false;
		};
	}, []);

	return useCallback(
		async (result: AddonRegistrationResult) => {
			if (busy.current) {
				return;
			}
			busy.current = true;
			try {
				if (
					linkTopic &&
					result.topicId != null &&
					result.topicId !== linkTopic.id
				) {
					throw new Error(
						'The add-on chose another topic than the registration link'
					);
				}
				const [agency, mainTopic] = await Promise.all([
					apiGetAgencyById(result.agencyId),
					result.topicId != null && result.topicId !== mainTopicId
						? apiGetTopicById(result.topicId)
						: undefined
				]);
				if (!active.current) {
					return;
				}
				const topicChanged =
					result.topicId != null && result.topicId !== mainTopicId;
				if (!agency || (topicChanged && !mainTopic)) {
					throw new Error('Agency or topic of the add-on not found');
				}
				updateRegistrationData?.({
					agency:
						result.consultingType != null
							? {
									...agency,
									consultingType: result.consultingType
								}
							: agency,
					...(mainTopic ? { mainTopic } : {}),
					...(result.postcode ? { zipcode: result.postcode } : {}),
					registrationRef: result.registrationRef
				});
				onNextClick();
			} catch (error) {
				if (!active.current) {
					return;
				}
				console.error('Registration add-on result not usable', error);
				addNotification?.({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: t('registration.errors.ups.title'),
					text: t('registration.errors.ups.text'),
					closeable: true,
					timeout: 3000
				});
			} finally {
				busy.current = false;
			}
		},
		[
			addNotification,
			linkTopic,
			mainTopicId,
			onNextClick,
			t,
			updateRegistrationData
		]
	);
};
