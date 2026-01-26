import * as React from 'react';
import { useContext, useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { UserDataContext } from '../../../globalState';
import { Button, ButtonItem, BUTTON_TYPES } from '../../button/Button';
import {
	SelectDropdown,
	SelectDropdownItem,
	SelectOption
} from '../../select/SelectDropdown';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../../overlay/Overlay';
import { logout } from '../../logout/logout';
import { mobileListView } from '../../app/navigationHandler';
import '../profile.styles';
import { Headline } from '../../headline/Headline';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../resources/img/illustrations/check.svg';
import { ReactComponent as XIcon } from '../../../resources/img/illustrations/x.svg';
import { AdditionalAgencySelection } from './AdditionalAgencySelection';
import {
	apiGetTenantAgenciesTopics,
	apiPostAdditionalEnquiry,
	FETCH_ERRORS,
	TenantAgenciesTopicsInterface,
	X_REASON
} from '../../../api';

export const AdditionalEnquiry: React.FC = () => {
	const { t: translate } = useTranslation(['common', 'consultingTypes']);
	const history = useHistory();

	const { reloadUserData } = useContext(UserDataContext);
	const [isButtonDisabled, setIsButtonDisabled] = useState(true);
	const [selectedTopicId, setSelectedTopicId] = useState<number>(null);
	const [selectedAgency, setSelectedAgency] = useState<any>({});
	const [selectedPostcode, setSelectedPostcode] = useState<any>('');
	const [successOverlayActive, setSuccessOverlayActive] = useState(false);
	const [successOverlayItem, setSuccessOverlayItem] =
		useState<OverlayItem>(null);
	const [sessionId, setSessionId] = useState(null);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [tenantAgenciesTopics, setTenantAgenciesTopics] = useState<
		TenantAgenciesTopicsInterface[]
	>([]);
	const [currentSelectOption, setCurrentSelectOption] =
		useState<SelectOption[]>(null);

	const buttonSetRegistration: ButtonItem = {
		label: translate('profile.data.register.button.label'),
		type: BUTTON_TYPES.LINK
	};

	const overlayItemNewRegistrationSuccess: OverlayItem = {
		svg: CheckIcon,
		headline: translate('profile.data.registerSuccess.overlay.headline'),
		buttonSet: [
			{
				label: translate(
					'profile.data.registerSuccess.overlay.button1.label'
				),
				function: OVERLAY_FUNCTIONS.REDIRECT,
				type: BUTTON_TYPES.PRIMARY
			},
			{
				label: translate(
					'profile.data.registerSuccess.overlay.button2.label'
				),
				function: OVERLAY_FUNCTIONS.LOGOUT,
				type: BUTTON_TYPES.LINK
			}
		]
	};

	const overlayItemNewRegistrationError: OverlayItem = {
		svg: XIcon,
		illustrationBackground: 'error',
		headline: translate('profile.data.registerError.overlay.headline'),
		buttonSet: [
			{
				label: translate(
					'profile.data.registerError.overlay.button.label'
				),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.PRIMARY
			}
		]
	};

	useEffect(() => {
		apiGetTenantAgenciesTopics()
			.then((response) => {
				setTenantAgenciesTopics(response);
			})
			.catch((error) => {
				console.log(error);
			});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const isAllRequiredDataSet = () =>
		selectedTopicId != null && selectedAgency && selectedPostcode;

	useEffect(() => {
		if (isAllRequiredDataSet()) {
			setIsButtonDisabled(false);
		} else {
			setIsButtonDisabled(true);
		}
	}, [selectedAgency]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleConsultingTypeSelect = (selectedOption) => {
		setSelectedTopicId(parseInt(selectedOption.value));
		setCurrentSelectOption(
			prepareSelectableTopics().filter(
				(option) => option.value === selectedOption.value
			)
		);
	};

	const prepareSelectableTopics = (): Array<SelectOption> => {
		return tenantAgenciesTopics.map((option) => ({
			value: option.id.toString(),
			label: option.name
		}));
	};

	const topicsDropdown: SelectDropdownItem = {
		id: 'topicSelect',
		selectedOptions: prepareSelectableTopics(),
		handleDropdownSelect: handleConsultingTypeSelect,
		selectInputLabel: translate(
			'profile.data.register.consultingTypeSelect.label'
		),
		useIconOption: false,
		isSearchable: false,
		menuPlacement: 'bottom',
		defaultValue: currentSelectOption
	};

	const handleRegistration = () => {
		if (isRequestInProgress) {
			return null;
		}

		if (isAllRequiredDataSet()) {
			setIsRequestInProgress(true);

			apiPostAdditionalEnquiry(
				selectedAgency.consultingType,
				selectedAgency.id,
				selectedPostcode,
				selectedTopicId
			)
				.then((response) => {
					let overlayItem = overlayItemNewRegistrationSuccess;
					setSessionId(response.sessionId);
					setSuccessOverlayItem(overlayItem);
					setSuccessOverlayActive(true);
					setIsRequestInProgress(false);
				})
				.catch((error: Response) => {
					const reason = error.headers?.get(FETCH_ERRORS.X_REASON);
					if (
						reason ===
						X_REASON.USER_ALREADY_REGISTERED_WITH_AGENCY_AND_TOPIC
					) {
						let xReasonErrorOverlay =
							overlayItemNewRegistrationError;
						xReasonErrorOverlay.headline = translate(
							'profile.data.registerError.overlay.xReasonAlreadyRegistered'
						);
						setSuccessOverlayItem(xReasonErrorOverlay);
					} else {
						setSuccessOverlayItem(overlayItemNewRegistrationError);
					}

					setIsButtonDisabled(true);
					setSuccessOverlayActive(true);
					setIsRequestInProgress(false);
				});
		}
	};

	const handleSuccessOverlayAction = (buttonFunction: string) => {
		reloadUserData().catch(console.log);

		if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			mobileListView();
			if (!sessionId) {
				history.push({
					pathname: `/sessions/user/view`
				});
				return;
			}

			history.push({
				pathname: `/sessions/user/view/write/${sessionId}`
			});
		} else if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setSuccessOverlayItem({});
			setSuccessOverlayActive(false);
			setSelectedTopicId(null);
		} else {
			logout();
		}
	};

	return (
		<div className="profile__data__itemWrapper additionalEnquiry">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.data.register.headline')}
					semanticLevel="5"
				/>
			</div>
			{
				<div className="additionalEnquiry__consultingTypeWrapper">
					<SelectDropdown {...topicsDropdown} />
				</div>
			}
			{selectedTopicId !== null && (
				<AdditionalAgencySelection
					selectedTopicId={selectedTopicId}
					onAgencyChange={(agency) => setSelectedAgency(agency)}
					onPostcodeChange={(postcode) =>
						setSelectedPostcode(postcode)
					}
				/>
			)}
			<Button
				item={buttonSetRegistration}
				buttonHandle={handleRegistration}
				disabled={isButtonDisabled}
			/>
			{successOverlayActive && (
				<Overlay
					item={successOverlayItem}
					handleOverlay={handleSuccessOverlayAction}
				/>
			)}
		</div>
	);
};
