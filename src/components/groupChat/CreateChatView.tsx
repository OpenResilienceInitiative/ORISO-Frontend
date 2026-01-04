import * as React from 'react';
import { useEffect, useContext, useState, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
	desktopView,
	mobileDetailView,
	mobileListView
} from '../app/navigationHandler';
import {
	SessionsDataContext,
	UPDATE_SESSIONS,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { InputField, InputFieldItem } from '../inputField/InputField';
import { SelectDropdown, SelectDropdownItem } from '../select/SelectDropdown';
import { TOPIC_LENGTHS } from './createChatHelpers';
import { ReactComponent as CheckIcon } from '../../resources/img/illustrations/check.svg';
import { ReactComponent as XIcon } from '../../resources/img/illustrations/x.svg';
import { ButtonItem, BUTTON_TYPES, Button } from '../button/Button';
import { OVERLAY_FUNCTIONS, Overlay, OverlayItem } from '../overlay/Overlay';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import './createChat.styles';
import { useResponsive } from '../../hooks/useResponsive';
import { apiGetSessionRoomsByGroupIds } from '../../api/apiGetSessionRooms';
import { useTranslation } from 'react-i18next';
import { apiGetAgencyConsultantList, Consultant } from '../../api/apiGetAgencyConsultantList';
import { apiCreateGroupChat } from '../../api/apiGroupChatSettings';

export const CreateGroupChatView = () => {
	const { t: translate } = useTranslation();
	const history = useHistory();
	const {
		userData,
		userData: { agencies = [] }
	} = useContext(UserDataContext);

	const { dispatch } = useContext(SessionsDataContext);
	const [selectedChatTopic, setSelectedChatTopic] = useState('');
	const [selectedAgency, setSelectedAgency] = useState<number | null>(null);
	const [selectedConsultants, setSelectedConsultants] = useState<string[]>([]);
	const [availableConsultants, setAvailableConsultants] = useState<Consultant[]>([]);
	const [isCreateButtonDisabled, setIsCreateButtonDisabled] = useState(true);
	const [chatTopicLabel, setChatTopicLabel] = useState(
		'groupChat.create.topicInput.label'
	);
	const [overlayItem, setOverlayItem] = useState<OverlayItem>(null);
	const [overlayActive, setOverlayActive] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	const createChatSuccessOverlayItem = useMemo<OverlayItem>(
		() => ({
			svg: CheckIcon,
			headline: translate('groupChat.createSuccess.overlay.headline'),
			buttonSet: [
				{
					label: translate(
						'groupChat.createSuccess.overlay.buttonLabel'
					),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.SECONDARY
				}
			]
		}),
		[translate]
	);

	const createChatErrorOverlayItem = useMemo<OverlayItem>(
		() => ({
			svg: XIcon,
			illustrationBackground: 'error',
			headline: translate('groupChat.createError.overlay.headline'),
			buttonSet: [
				{
					label: translate(
						'groupChat.createError.overlay.buttonLabel'
					),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.AUTO_CLOSE
				}
			]
		}),
		[translate]
	);

	const { fromL } = useResponsive();
	useEffect(() => {
		if (!fromL) {
			mobileDetailView();
			return () => {
				mobileListView();
			};
		}
		desktopView();
	}, [fromL]);

	// Auto-select agency if only one is available
	useEffect(() => {
		const onlyOneAgencyAvailable = agencies?.length === 1;
		if (onlyOneAgencyAvailable) {
			setSelectedAgency(agencies[0].id);
		}
	}, [agencies]);

	// Fetch consultants when agency changes
	useEffect(() => {
		if (selectedAgency) {
			apiGetAgencyConsultantList(selectedAgency.toString())
				.then((consultants) => {
					// ✅ FIX 1: Filter out current user from consultant list
					// ✅ FIX 2: Remove duplicates using consultantId as unique key
					const currentUserId = userData?.userId;
					const uniqueConsultants = consultants.reduce((acc, consultant) => {
						// Skip if this is the current user
						if (consultant.consultantId === currentUserId) {
							return acc;
						}
						// Skip if we already have this consultant (remove duplicates)
						if (acc.some(c => c.consultantId === consultant.consultantId)) {
							return acc;
						}
						return [...acc, consultant];
					}, [] as Consultant[]);
					
					setAvailableConsultants(uniqueConsultants);
				})
				.catch((error) => {
					console.error('Failed to fetch consultants:', error);
					setAvailableConsultants([]);
				});
		} else {
			setAvailableConsultants([]);
			setSelectedConsultants([]);
		}
	}, [selectedAgency, userData]);

	// Validate form
	useEffect(() => {
		const isChatTopicValid =
			selectedChatTopic &&
			selectedChatTopic.length >= TOPIC_LENGTHS.MIN &&
			selectedChatTopic.length < TOPIC_LENGTHS.MAX;
		
		if (isChatTopicValid && selectedAgency && selectedConsultants.length > 0) {
			setIsCreateButtonDisabled(false);
		} else {
			setIsCreateButtonDisabled(true);
		}
	}, [selectedChatTopic, selectedAgency, selectedConsultants]);

	const handleBackButton = () => {
		history.push('/sessions/consultant/sessionView');
	};

	const chatTopicInputItem: InputFieldItem = {
		name: 'chatTopic',
		class: 'createChat__name__input',
		id: 'chatTopic',
		type: 'text',
		label: translate(chatTopicLabel),
		content: selectedChatTopic
	};

	const handleChatTopicInput = (event) => {
		const chatTopic = event.target.value;
		const chatTopicLength = chatTopic.length;
		if (chatTopicLength < TOPIC_LENGTHS.MIN) {
			setChatTopicLabel('groupChat.create.topicInput.warning.short');
		} else if (chatTopicLength >= TOPIC_LENGTHS.MAX) {
			setChatTopicLabel('groupChat.create.topicInput.warning.long');
		} else {
			setChatTopicLabel('groupChat.create.topicInput.label');
		}
		setSelectedChatTopic(chatTopic);
	};

	const handleAgencySelect = (selectedOption) => {
		setSelectedAgency(parseInt(selectedOption.value));
		setSelectedConsultants([]); // Reset consultants when agency changes
	};

	const handleConsultantsSelect = (selectedOptions) => {
		const consultantIds = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
		setSelectedConsultants(consultantIds);
	};

	const getOptionOfSelectedAgency = useCallback(() => {
		const agency = agencies.find((agency) => agency.id === selectedAgency);
		return agency
			? {
					value: agency.id.toString(),
					label: agency.name
				}
			: null;
	}, [agencies, selectedAgency]);

	const agencySelectDropdown = useMemo<SelectDropdownItem>(
		() => ({
			id: 'agency',
			selectedOptions: agencies.map(({ id, name }) => ({
				value: id.toString(),
				label: name
			})),
			defaultValue: getOptionOfSelectedAgency(),
			handleDropdownSelect: handleAgencySelect,
			selectInputLabel: translate('groupChat.create.agencySelect.label'),
			isSearchable: true,
			menuPlacement: 'bottom'
		}),
		[agencies, getOptionOfSelectedAgency, translate]
	);

	const getSelectedConsultantOptions = useCallback(() => {
		return availableConsultants
			.filter((consultant) => selectedConsultants.includes(consultant.consultantId))
			.map((consultant) => ({
				value: consultant.consultantId,
				label: `${consultant.firstName} ${consultant.lastName}`
			}));
	}, [availableConsultants, selectedConsultants]);

	const consultantsSelectDropdown = useMemo<SelectDropdownItem>(
		() => ({
			id: 'consultants',
			selectedOptions: availableConsultants.map((consultant) => ({
				value: consultant.consultantId,
				label: `${consultant.firstName} ${consultant.lastName}`
			})),
			defaultValue: getSelectedConsultantOptions(), // ✅ Show selected values inside
			handleDropdownSelect: handleConsultantsSelect,
			selectInputLabel: translate('groupChat.create.consultantsSelect.label') || 'Select Consultants',
			isSearchable: true,
			menuPlacement: 'bottom',
			isMulti: true
		}),
		[availableConsultants, getSelectedConsultantOptions, translate]
	);

	const buttonSetCreate = useMemo<ButtonItem>(
		() => ({
			label: translate('groupChat.create.button.label') || 'Create',
			function: OVERLAY_FUNCTIONS.CLOSE,
			type: BUTTON_TYPES.PRIMARY
		}),
		[translate]
	);

	const buttonSetCancel = useMemo<ButtonItem>(
		() => ({
			label: translate('groupChat.cancel.button.label') || 'Cancel',
			function: OVERLAY_FUNCTIONS.CLOSE,
			type: BUTTON_TYPES.SECONDARY
		}),
		[translate]
	);

	const handleCreateButton = useCallback(() => {
		if (isRequestInProgress) {
			return;
		}
		setIsRequestInProgress(true);

		// Use the proper API function
		apiCreateGroupChat({
			topic: selectedChatTopic,
			startDate: new Date().toISOString().split('T')[0],
			startTime: '00:00',
			duration: 60,
			agencyId: selectedAgency,
			hintMessage: '',
			repetitive: false,
			featureGroupChatV2Enabled: true,
			consultantIds: selectedConsultants
		} as any)
			.then((response) => {
				// Refresh session list
				apiGetSessionRoomsByGroupIds([response.groupId]).then(
					({ sessions }) => {
						dispatch({
							type: UPDATE_SESSIONS,
							sessions: sessions
						});
						setOverlayItem(createChatSuccessOverlayItem);
						setOverlayActive(true);
					}
				);
			})
			.catch(() => {
				setOverlayItem(createChatErrorOverlayItem);
				setOverlayActive(true);
			})
			.finally(() => {
				setIsRequestInProgress(false);
			});
	}, [
		isRequestInProgress,
		selectedChatTopic,
		selectedAgency,
		selectedConsultants,
		dispatch,
		createChatSuccessOverlayItem,
		createChatErrorOverlayItem
	]);

	const handleOverlayAction = useCallback(
		(buttonFunction: string) => {
			if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
				if (
					JSON.stringify(overlayItem) ===
						JSON.stringify(createChatSuccessOverlayItem)
				) {
					history.push('/sessions/consultant/sessionView');
				} else {
					setOverlayActive(false);
					setOverlayItem({});
				}
			}
		},
		[
			createChatSuccessOverlayItem,
			history,
			overlayItem
		]
	);

	return (
		<div className="createChat__wrapper">
			<div className="createChat__header">
				<div className="createChat__header__inner">
					<span
						onClick={handleBackButton}
						className="createChat__header__backButton"
					>
						<BackIcon />
					</span>
					<h3 className="createChat__header__title">
						{translate('groupChat.create.title') || 'Create Group Chat'}
					</h3>
				</div>
				<p className="createChat__header__subtitle">
					{translate('groupChat.create.subtitle') || 'Create a new group chat with selected consultants'}
				</p>
			</div>

			<form id="createChatForm" className="createChat__content">
				<InputField
					item={chatTopicInputItem}
					inputHandle={handleChatTopicInput}
				/>

				<SelectDropdown {...agencySelectDropdown} />

				<SelectDropdown {...consultantsSelectDropdown} />

				<div className="createChat__buttonsWrapper">
					<Button
						item={buttonSetCancel}
						buttonHandle={handleBackButton}
					/>
					<Button
						item={buttonSetCreate}
						buttonHandle={handleCreateButton}
						disabled={isCreateButtonDisabled}
					/>
				</div>
			</form>

			{overlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};
