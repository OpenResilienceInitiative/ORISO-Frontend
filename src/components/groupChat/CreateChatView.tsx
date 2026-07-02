import * as React from 'react';
import {
	useEffect,
	useContext,
	useState,
	useCallback,
	useMemo,
	useRef
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
	desktopView,
	mobileDetailView,
	mobileListView
} from '../app/navigationHandler';
import {
	SessionsDataContext,
	UPDATE_SESSIONS,
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
import {
	apiGetAgencyConsultantList,
	Consultant
} from '../../api/apiGetAgencyConsultantList';
import { apiCreateGroupChat } from '../../api/apiGroupChatSettings';

const IconPlusCircle = ({ open }: { open: boolean }) => (
	<svg
		width="32"
		height="32"
		viewBox="0 0 32 32"
		fill="none"
		aria-hidden
		className={
			open
				? 'createChat__participantsPlusIcon createChat__participantsPlusIcon--open'
				: 'createChat__participantsPlusIcon'
		}
	>
		<rect
			className="createChat__participantsPlusBg"
			x="0.5"
			y="0.5"
			width="31"
			height="31"
			rx={open ? '8' : '16'}
		/>
		<path
			className="createChat__participantsPlusPath"
			d="M15.1665 16.8334H10.1665V15.1667H15.1665V10.1667H16.8332V15.1667H21.8332V16.8334H16.8332V21.8334H15.1665V16.8334Z"
		/>
	</svg>
);

const IconChevronDown = ({ open }: { open: boolean }) => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		aria-hidden
		className={
			open
				? 'createChat__participantsChevron createChat__participantsChevron--open'
				: 'createChat__participantsChevron'
		}
	>
		<path
			d="M4 6L8 10L12 6"
			stroke="#5E6A73"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
	</svg>
);

const IconSearchSmall = () => (
	<svg
		width="15"
		height="15"
		viewBox="0 0 15 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M13.8333 15L8.58333 9.75C8.16667 10.0833 7.6875 10.3472 7.14583 10.5417C6.60417 10.7361 6.02778 10.8333 5.41667 10.8333C3.90278 10.8333 2.62153 10.309 1.57292 9.26042C0.524306 8.21181 0 6.93056 0 5.41667C0 3.90278 0.524306 2.62153 1.57292 1.57292C2.62153 0.524306 3.90278 0 5.41667 0C6.93056 0 8.21181 0.524306 9.26042 1.57292C10.309 2.62153 10.8333 3.90278 10.8333 5.41667C10.8333 6.02778 10.7361 6.60417 10.5417 7.14583C10.3472 7.6875 10.0833 8.16667 9.75 8.58333L15 13.8333L13.8333 15ZM5.41667 9.16667C6.45833 9.16667 7.34375 8.80208 8.07292 8.07292C8.80208 7.34375 9.16667 6.45833 9.16667 5.41667C9.16667 4.375 8.80208 3.48958 8.07292 2.76042C7.34375 2.03125 6.45833 1.66667 5.41667 1.66667C4.375 1.66667 3.48958 2.03125 2.76042 2.76042C2.03125 3.48958 1.66667 4.375 1.66667 5.41667C1.66667 6.45833 2.03125 7.34375 2.76042 8.07292C3.48958 8.80208 4.375 9.16667 5.41667 9.16667Z"
			fill="#49454F"
		/>
	</svg>
);

const IconSelected = () => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
		<circle cx="11" cy="11" r="10.5" fill="#F5E6E7" stroke="#D79A9D" />
		<path
			d="M7.5 11.5L9.8 13.8L14.8 8.8"
			stroke="#A5000A"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconUnselected = () => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
		<circle cx="11" cy="11" r="10.5" fill="#F8F8F8" stroke="#E2E2E2" />
		<path
			d="M7.5 11.5L9.8 13.8L14.8 8.8"
			stroke="#CBCBCB"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

export const CreateGroupChatView = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const {
		userData,
		userData: { agencies = [] }
	} = useContext(UserDataContext);

	const { dispatch } = useContext(SessionsDataContext);
	const [selectedChatTopic, setSelectedChatTopic] = useState('');
	const [selectedAgency, setSelectedAgency] = useState<number | null>(null);
	const [selectedConsultants, setSelectedConsultants] = useState<string[]>(
		[]
	);
	const [availableConsultants, setAvailableConsultants] = useState<
		Consultant[]
	>([]);
	const [isCreateButtonDisabled, setIsCreateButtonDisabled] = useState(true);
	const [participantsMenuOpen, setParticipantsMenuOpen] = useState(false);
	const [participantSearch, setParticipantSearch] = useState('');
	const [participantSearchFocused, setParticipantSearchFocused] =
		useState(false);
	const [chatTopicLabel, setChatTopicLabel] = useState(
		'groupChat.create.topicInput.label'
	);
	const [overlayItem, setOverlayItem] = useState<OverlayItem>(null);
	const [overlayActive, setOverlayActive] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const participantsPickerRef = useRef<HTMLDivElement | null>(null);

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
					const uniqueConsultants = consultants.reduce(
						(acc, consultant) => {
							// Skip if this is the current user
							if (consultant.consultantId === currentUserId) {
								return acc;
							}
							// Skip if we already have this consultant (remove duplicates)
							if (
								acc.some(
									(c) =>
										c.consultantId ===
										consultant.consultantId
								)
							) {
								return acc;
							}
							return [...acc, consultant];
						},
						[] as Consultant[]
					);

					setAvailableConsultants(uniqueConsultants);
				})
				.catch((error) => {
					// console.error('Failed to fetch consultants:', error);
					setAvailableConsultants([]);
				});
		} else {
			setAvailableConsultants([]);
			setSelectedConsultants([]);
		}
	}, [selectedAgency, userData]);

	useEffect(() => {
		const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
			if (!participantsPickerRef.current) {
				return;
			}
			const target = event.target as Node | null;
			if (target && !participantsPickerRef.current.contains(target)) {
				setParticipantsMenuOpen(false);
				setParticipantSearchFocused(false);
			}
		};

		document.addEventListener('mousedown', handleOutsidePointer);
		document.addEventListener('touchstart', handleOutsidePointer);

		return () => {
			document.removeEventListener('mousedown', handleOutsidePointer);
			document.removeEventListener('touchstart', handleOutsidePointer);
		};
	}, []);

	// Validate form
	useEffect(() => {
		const isChatTopicValid =
			selectedChatTopic &&
			selectedChatTopic.length >= TOPIC_LENGTHS.MIN &&
			selectedChatTopic.length < TOPIC_LENGTHS.MAX;

		if (
			isChatTopicValid &&
			selectedAgency &&
			selectedConsultants.length > 0
		) {
			setIsCreateButtonDisabled(false);
		} else {
			setIsCreateButtonDisabled(true);
		}
	}, [selectedChatTopic, selectedAgency, selectedConsultants]);

	const handleBackButton = () => {
		navigate('/sessions/consultant/sessionView');
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
		setParticipantsMenuOpen(false);
		setParticipantSearch('');
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

	const tr = useCallback(
		(key: string, fallback: string) => {
			const value = translate(key);
			return !value || value === key ? fallback : value;
		},
		[translate]
	);

	const consultantOptions = useMemo(
		() =>
			availableConsultants.map((consultant) => ({
				id: consultant.consultantId,
				label: `${consultant.firstName} ${consultant.lastName}`.trim()
			})),
		[availableConsultants]
	);

	const filteredConsultants = useMemo(() => {
		const query = participantSearch.trim().toLowerCase();
		const base = consultantOptions.filter((option) =>
			query ? option.label.toLowerCase().includes(query) : true
		);
		const selectedRank = new Map(
			selectedConsultants.map((id, index) => [id, index])
		);
		return base.sort((a, b) => {
			const aRank = selectedRank.has(a.id)
				? (selectedRank.get(a.id) as number)
				: Number.POSITIVE_INFINITY;
			const bRank = selectedRank.has(b.id)
				? (selectedRank.get(b.id) as number)
				: Number.POSITIVE_INFINITY;
			if (aRank !== bRank) {
				return aRank - bRank;
			}
			return a.label.localeCompare(b.label);
		});
	}, [consultantOptions, participantSearch, selectedConsultants]);

	const selectedSummary = useMemo(() => {
		if (selectedConsultants.length === 0) {
			return tr(
				'groupChat.create.participants.placeholder',
				'Use list or search directly'
			);
		}
		const labels = selectedConsultants
			.map(
				(id) =>
					consultantOptions.find((option) => option.id === id)?.label
			)
			.filter((label): label is string => !!label);
		if (labels.length <= 1) {
			return (
				labels[0] ||
				tr(
					'groupChat.create.participants.placeholder',
					'Use list or search directly'
				)
			);
		}
		return `${labels[0]} +${labels.length - 1}`;
	}, [consultantOptions, selectedConsultants, tr]);

	const selectedConsultantEntries = useMemo(
		() =>
			selectedConsultants
				.map((id) =>
					consultantOptions.find((option) => option.id === id)
				)
				.filter(
					(entry): entry is { id: string; label: string } => !!entry
				),
		[consultantOptions, selectedConsultants]
	);

	const toggleConsultant = useCallback((consultantId: string) => {
		setSelectedConsultants((prev) =>
			prev.includes(consultantId)
				? prev.filter((id) => id !== consultantId)
				: [consultantId, ...prev]
		);
	}, []);

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
					navigate('/sessions/consultant/sessionView');
				} else {
					setOverlayActive(false);
					setOverlayItem({});
				}
			}
		},
		[createChatSuccessOverlayItem, navigate, overlayItem]
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
						{translate('groupChat.create.title') ||
							'Create Group Chat'}
					</h3>
				</div>
				<p className="createChat__header__subtitle">
					{translate('groupChat.create.subtitle') ||
						'Create a new group chat with selected consultants'}
				</p>
			</div>

			<form id="createChatForm" className="createChat__content">
				<InputField
					item={chatTopicInputItem}
					inputHandle={handleChatTopicInput}
				/>

				<SelectDropdown {...agencySelectDropdown} />
				<div
					className="createChat__participantsPicker"
					ref={participantsPickerRef}
				>
					<div className="createChat__participantsRow">
						<button
							type="button"
							className="createChat__participantsPlusButton"
							onClick={() =>
								setParticipantsMenuOpen((prev) => !prev)
							}
							aria-label={tr(
								'groupChat.create.participants.toggle',
								'Toggle participant list'
							)}
						>
							<IconPlusCircle open={participantsMenuOpen} />
						</button>
						<button
							type="button"
							className={
								participantSearchFocused
									? 'createChat__participantsTrigger createChat__participantsTrigger--active'
									: 'createChat__participantsTrigger'
							}
							onClick={() =>
								setParticipantsMenuOpen((prev) => !prev)
							}
							aria-expanded={participantsMenuOpen}
						>
							<span className="createChat__participantsTriggerText">
								{selectedSummary}
							</span>
							<IconChevronDown open={participantsMenuOpen} />
						</button>
					</div>
					{participantsMenuOpen && (
						<div className="createChat__participantsMenu">
							<div className="createChat__participantsCard createChat__participantsCard--search">
								<div
									className={
										participantSearchFocused
											? 'createChat__participantsSearchWrap createChat__participantsSearchWrap--active'
											: 'createChat__participantsSearchWrap'
									}
								>
									<IconSearchSmall />
									<input
										type="search"
										className="createChat__participantsSearch"
										placeholder={tr(
											'groupChat.create.participants.searchPlaceholder',
											'Search Name'
										)}
										value={participantSearch}
										onFocus={() =>
											setParticipantSearchFocused(true)
										}
										onBlur={() =>
											setParticipantSearchFocused(false)
										}
										onChange={(event) =>
											setParticipantSearch(
												event.target.value
											)
										}
									/>
								</div>
							</div>

							{!!selectedConsultantEntries.length && (
								<div className="createChat__participantsCard createChat__participantsCard--selected">
									<div className="createChat__selectedPillsLabel">
										{tr(
											'groupChat.create.participants.currentLabel',
											'Current Participant'
										)}
									</div>
									<div className="createChat__selectedPills">
										{selectedConsultantEntries.map(
											(entry) => (
												<button
													type="button"
													key={`pill-${entry.id}`}
													className="createChat__selectedPill"
													onClick={() =>
														toggleConsultant(
															entry.id
														)
													}
												>
													<span className="createChat__selectedPillText">
														{entry.label}
													</span>
													<span className="createChat__selectedPillClose">
														&times;
													</span>
												</button>
											)
										)}
									</div>
								</div>
							)}

							<div className="createChat__participantsCard createChat__participantsCard--list">
								<div className="createChat__participantsLabel">
									{tr(
										'groupChat.create.participants.listLabel',
										'Participant List'
									)}
								</div>
								<div className="createChat__participantsList">
									{filteredConsultants.map((consultant) => {
										const isSelected =
											selectedConsultants.includes(
												consultant.id
											);
										return (
											<button
												type="button"
												key={consultant.id}
												className="createChat__participantItem"
												onClick={() =>
													toggleConsultant(
														consultant.id
													)
												}
											>
												<span
													className={
														isSelected
															? 'createChat__participantName createChat__participantName--selected'
															: 'createChat__participantName'
													}
												>
													{consultant.label}
												</span>
												<span className="createChat__participantIcon">
													{isSelected ? (
														<IconSelected />
													) : (
														<IconUnselected />
													)}
												</span>
											</button>
										);
									})}
								</div>
							</div>
						</div>
					)}
				</div>

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
