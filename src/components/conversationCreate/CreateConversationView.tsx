import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import {
	Navigate,
	useLocation,
	useNavigate,
	useParams
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	desktopView,
	mobileDetailView,
	mobileListView
} from '../app/navigationHandler';
import { UserDataContext, useTenant, useTenantState } from '../../globalState';
import { useResponsive } from '../../hooks/useResponsive';
import { Loading } from '../app/Loading';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as PersonsIcon } from '../../resources/img/icons/persons.svg';
import { ReactComponent as GroupIllustration } from '../../resources/img/illustrations/active-createGroup.svg';
import {
	apiGetTenantConsultantList,
	Consultant
} from '../../api/apiGetAgencyConsultantList';
import {
	apiGetTenantAgenciesTopics,
	TenantAgenciesTopicsInterface
} from '../../api/apiGetTenantAgenciesTopics';
import {
	buildGroupChatEditDraft,
	buildOneOffDuplicateFields,
	getValidDateFormatForSelectedDate,
	getValidTimeFormatForSelectedTime,
	GroupChatEditSource
} from '../groupChat/createChatHelpers';
import { GroupChatSeriesFieldsValue } from '../groupChat/GroupChatSeriesFields';
import { normalizeGroupChatLanguages } from '../groupChat/groupChatAuthorContent';
import { useSession } from '../../hooks/useSession';
import {
	CreateStep,
	getAvailableFormats,
	getConversationFormatAvailability,
	isGroupChatTranslationAvailable,
	resolveInitialStep
} from './formatAvailability';
import { resolveListboxKey } from './listboxKeyboard';
import { MenuPortal, useAnchoredMenuLayout } from './anchoredMenu';
import { FormatCard } from './FormatCard';
import { M3SplitButton } from './M3SplitButton';
import {
	InternalChatCreateCard,
	InternalChatDraft
} from './internal/InternalChatCreateCard';
import {
	CircleSettingsView,
	CircleSettingsPrefill
} from './circle/CircleSettingsView';
import { useCreateChatSubmit } from './useCreateChatSubmit';
import './conversationCreate.styles.scss';

/**
 * Create-conversation flow (Figma "Flow Self Help Group", node 8482-30552).
 *
 * Step 1 "Gesprächsformat wählen" offers the formats the Träger admins
 * enabled for this agency; with a single available format the picker is
 * skipped. "Interna besprechen" is completed entirely inside its card;
 * "Gesprächskreis" continues to the settings screen after a topic was
 * chosen on its card.
 */

/** Natural height of the topic listbox, mirrored by its `max-height`. */
const TOPIC_MENU_HEIGHT = 320;

const CreateConversationFlow = () => {
	const { t: translate, i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const tenantData = useTenant();
	const {
		userData,
		userData: { agencies = [] }
	} = useContext(UserDataContext);
	const { fromL } = useResponsive();
	const { submit, isSubmitting, hasError, clearError } =
		useCreateChatSubmit();

	// Edit mode is driven by the route params: the create route has none, the
	// edit route (RouterConfig) carries /:groupId/:sessionId/editGroupChat.
	const { groupId: editRoomId, sessionId: editSessionIdParam } = useParams<{
		groupId: string;
		sessionId: string;
	}>();
	const isEditMode = Boolean(editSessionIdParam);
	const editChatId = editSessionIdParam ? Number(editSessionIdParam) : null;
	const { session: editSession } = useSession(
		isEditMode ? (editRoomId ?? null) : null,
		editChatId ?? undefined
	);

	const duplicateOccurrence = (
		location.state as {
			duplicateOccurrence?: {
				topic: string;
				start: string;
				duration: number;
				modality: GroupChatSeriesFieldsValue['modality'];
			};
		} | null
	)?.duplicateOccurrence;

	const availability = getConversationFormatAvailability(tenantData);
	const availableFormats = getAvailableFormats(availability);

	// Turn the loaded series into a fully-populated prefill. Prefilling every
	// field (schedule AND author content) is the overwrite guard: the backend
	// updateChat rewrites all of them from the payload, so a schedule-only edit
	// must resubmit the existing content verbatim.
	const editPrefill = useMemo<CircleSettingsPrefill | undefined>(() => {
		if (!isEditMode) {
			return undefined;
		}
		const item = editSession?.item;
		if (!item) {
			return undefined;
		}
		try {
			const draft = buildGroupChatEditDraft(
				item as unknown as GroupChatEditSource
			);
			return {
				topic: draft.topic,
				startDate: draft.seriesFields.startDate,
				startTime: draft.seriesFields.startTime,
				duration: draft.seriesFields.duration,
				repeatCount: draft.seriesFields.repeatCount,
				interval: draft.seriesFields.interval,
				modality: draft.seriesFields.modality,
				authorContent: draft.authorContent,
				// The API returns the OWNER in the participant list as well. The
				// co-moderator picker must never render or submit the current owner.
				consultantIds: draft.consultantIds.filter(
					(consultantId) => consultantId !== userData?.userId
				),
				agencyId: draft.agencyId
			};
		} catch {
			// Invalid persisted start etc. — keep the form gated (no prefill).
			return undefined;
		}
	}, [isEditMode, editSession, userData?.userId]);

	const [step, setStep] = useState<CreateStep>(() =>
		isEditMode
			? 'circle'
			: resolveInitialStep(
					availability,
					availableFormats,
					Boolean(duplicateOccurrence)
				)
	);
	const [circlePrefill, setCirclePrefill] = useState<
		CircleSettingsPrefill | undefined
	>(() =>
		duplicateOccurrence && availability.circle
			? {
					topic: duplicateOccurrence.topic,
					...buildOneOffDuplicateFields(duplicateOccurrence)
				}
			: undefined
	);
	const [pickerTopic, setPickerTopic] = useState('');
	const [pickerTopicMenuOpen, setPickerTopicMenuOpen] = useState(false);
	const [topics, setTopics] = useState<TenantAgenciesTopicsInterface[]>([]);
	const [topicsLoadFailed, setTopicsLoadFailed] = useState(false);
	const [selectedAgency, setSelectedAgency] = useState<number | null>(
		agencies.length === 1 ? agencies[0].id : null
	);
	const [internalDraft, setInternalDraft] = useState<InternalChatDraft>({
		name: '',
		selectedIds: []
	});
	const [availableConsultants, setAvailableConsultants] = useState<
		Consultant[]
	>([]);
	const [consultantsLoadFailed, setConsultantsLoadFailed] = useState(false);

	// Once the edited series has loaded, preselect its agency so the settings
	// form and the per-agency defaults line up with the persisted chat.
	const editAgencyAppliedRef = useRef(false);
	useEffect(() => {
		if (
			isEditMode &&
			!editAgencyAppliedRef.current &&
			editPrefill?.agencyId != null
		) {
			editAgencyAppliedRef.current = true;
			setSelectedAgency(editPrefill.agencyId);
		}
	}, [isEditMode, editPrefill]);

	const activeLanguages = useMemo(
		() =>
			normalizeGroupChatLanguages(
				tenantData?.settings?.activeLanguages?.length
					? tenantData.settings.activeLanguages
					: [i18n.resolvedLanguage || i18n.language || 'de']
			),
		[
			i18n.language,
			i18n.resolvedLanguage,
			tenantData?.settings?.activeLanguages
		]
	);

	// Mobile: this flow lives in the detail view; the back button stays
	// visible until the counsellor can write again (Figma annotation).
	useEffect(() => {
		if (!fromL) {
			mobileDetailView();
			return () => {
				mobileListView();
			};
		}
		desktopView();
	}, [fromL]);

	// The vertical navigation is disabled while the creation flow is open
	// (Figma annotation "set this more vertical menu to disabled"). `inert`
	// takes it out of the tab order and the accessibility tree entirely, so it
	// is not keyboard-operable while dimmed; the CSS keeps the visual state.
	useEffect(() => {
		document.body.classList.add('conversationCreate--active');
		const navigation = document.querySelector<HTMLElement>(
			'.navigation__wrapper'
		);
		navigation?.setAttribute('inert', '');
		return () => {
			document.body.classList.remove('conversationCreate--active');
			navigation?.removeAttribute('inert');
		};
	}, []);

	useEffect(() => {
		const onlyOneAgencyAvailable = agencies?.length === 1;
		if (onlyOneAgencyAvailable) {
			setSelectedAgency(agencies[0].id);
		}
	}, [agencies]);

	// People for the internal card: agency colleagues without the current
	// user, deduplicated by consultantId.
	const loadConsultants = useCallback(() => {
		if (
			!selectedAgency ||
			(!availability.internal && !availability.circle)
		) {
			setAvailableConsultants([]);
			setConsultantsLoadFailed(false);
			return;
		}
		setConsultantsLoadFailed(false);
		apiGetTenantConsultantList()
			.then((consultants) => {
				const currentUserId = userData?.userId;
				const unique = consultants.reduce((acc, consultant) => {
					if (consultant.consultantId === currentUserId) {
						return acc;
					}
					if (
						acc.some(
							(existing) =>
								existing.consultantId ===
								consultant.consultantId
						)
					) {
						return acc;
					}
					return [...acc, consultant];
				}, [] as Consultant[]);
				setAvailableConsultants(unique);
			})
			.catch(() => {
				setAvailableConsultants([]);
				setConsultantsLoadFailed(true);
			});
	}, [availability.circle, availability.internal, selectedAgency, userData]);

	useEffect(() => {
		loadConsultants();
	}, [loadConsultants]);

	const loadTopics = useCallback(() => {
		if (!availability.circle) {
			return;
		}
		setTopicsLoadFailed(false);
		apiGetTenantAgenciesTopics()
			.then((result) => setTopics(result || []))
			.catch(() => {
				setTopics([]);
				setTopicsLoadFailed(true);
			});
	}, [availability.circle]);

	useEffect(() => {
		loadTopics();
	}, [loadTopics]);

	const agencyOptions = useMemo(
		() =>
			agencies.map(({ id, name }) => ({
				value: id.toString(),
				label: name
			})),
		[agencies]
	);

	const people = useMemo(
		() =>
			availableConsultants.map((consultant) => ({
				id: consultant.consultantId,
				label: `${consultant.firstName} ${consultant.lastName}`.trim()
			})),
		[availableConsultants]
	);

	const topicOptions = useMemo(
		() =>
			topics.map((topic) => ({
				value: topic.name,
				label: topic.name
			})),
		[topics]
	);

	const handleBackButton = useCallback(() => {
		if (step !== 'picker' && availableFormats.length > 1) {
			setStep('picker');
			clearError();
			return;
		}
		navigate('/sessions/consultant/sessionView');
	}, [availableFormats.length, clearError, navigate, step]);

	const handleInternalCreate = () => {
		if (selectedAgency === null) {
			return;
		}
		// No repeatCount here: sending one would make getModality classify
		// the chat as SELF_HELP (ADR-006 fallback heuristic).
		submit({
			topic: internalDraft.name.trim(),
			startDate: getValidDateFormatForSelectedDate(new Date()),
			startTime: getValidTimeFormatForSelectedTime(new Date()),
			duration: 60,
			agencyId: selectedAgency,
			hintMessage: '',
			repetitive: false,
			consultantIds: internalDraft.selectedIds,
			featureGroupChatV2Enabled: true
		});
	};

	// Switching agency must drop the previously picked colleagues: they belong
	// to the old agency and would otherwise leak across agencies into the new
	// internal chat (the consultant list reloads for the new agency).
	const handleInternalAgencyChange = (value: string) => {
		setSelectedAgency(parseInt(value));
		setInternalDraft((draft) => ({ ...draft, selectedIds: [] }));
	};

	const openCircleSettings = () => {
		setCirclePrefill(pickerTopic ? { topic: pickerTopic } : undefined);
		setStep('circle');
	};

	// Topic listbox keyboard contract (WCAG combobox/listbox): focus moves into
	// the popup on open, Arrow/Home/End roam the options and Escape returns
	// focus to the trigger.
	const topicMenuRef = useRef<HTMLUListElement | null>(null);
	const pickerSplitButtonRef = useRef<HTMLDivElement | null>(null);
	const topicMenuLayout = useAnchoredMenuLayout(
		pickerSplitButtonRef,
		TOPIC_MENU_HEIGHT,
		`${pickerTopicMenuOpen}:${topicOptions.length}`
	);

	const topicOptionButtons = () =>
		Array.from(
			topicMenuRef.current?.querySelectorAll<HTMLButtonElement>(
				'button[role="option"]:not([disabled])'
			) ?? []
		);

	useEffect(() => {
		if (pickerTopicMenuOpen) {
			topicOptionButtons()[0]?.focus();
		}
	}, [pickerTopicMenuOpen]);

	const closeTopicMenu = (returnFocus: boolean) => {
		setPickerTopicMenuOpen(false);
		if (returnFocus) {
			pickerSplitButtonRef.current
				?.querySelector<HTMLButtonElement>('button')
				?.focus();
		}
	};

	// The menu floats above the card in a portal, so a click on the card no
	// longer counts as a click "inside" it — close it like any other popup.
	useEffect(() => {
		if (!pickerTopicMenuOpen) {
			return;
		}
		const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
			const target = event.target as Node | null;
			if (
				target &&
				!topicMenuRef.current?.contains(target) &&
				!pickerSplitButtonRef.current?.contains(target)
			) {
				setPickerTopicMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handleOutsidePointer);
		document.addEventListener('touchstart', handleOutsidePointer);
		return () => {
			document.removeEventListener('mousedown', handleOutsidePointer);
			document.removeEventListener('touchstart', handleOutsidePointer);
		};
	}, [pickerTopicMenuOpen]);

	const handleTopicMenuKeyDown = (
		event: React.KeyboardEvent<HTMLUListElement>
	) => {
		const buttons = topicOptionButtons();
		const currentIndex = buttons.findIndex(
			(button) => button === document.activeElement
		);
		const result = resolveListboxKey(
			event.key,
			currentIndex,
			buttons.length
		);
		if (result === null) {
			return;
		}
		event.preventDefault();
		if (result === 'close') {
			closeTopicMenu(true);
			return;
		}
		buttons[result]?.focus();
	};

	const renderInternalCard = () => (
		<>
			{consultantsLoadFailed && (
				<p role="alert" className="conversationCreate__error">
					{translate('groupChat.loadError.consultants')}
					<button type="button" onClick={loadConsultants}>
						{translate('groupChat.loadError.retry')}
					</button>
				</p>
			)}
			<InternalChatCreateCard
				people={people}
				draft={internalDraft}
				onDraftChange={setInternalDraft}
				onCreate={handleInternalCreate}
				isSubmitting={isSubmitting}
				agencyOptions={agencyOptions}
				selectedAgency={selectedAgency?.toString()}
				onAgencyChange={handleInternalAgencyChange}
			/>
		</>
	);

	const renderPicker = () => (
		<div className="conversationCreate__picker">
			<div className="conversationCreate__intro">
				<h2 className="conversationCreate__title">
					{translate('groupChat.format.title')}
				</h2>
				<p className="conversationCreate__subtitle">
					{translate('groupChat.format.subtitle')}
				</p>
			</div>
			<div className="conversationCreate__cards">
				{availability.circle && (
					<FormatCard
						className="conversationCreate__formatCard"
						title={translate('groupChat.circle.title')}
						subtitle={translate('groupChat.circle.subtitle')}
						avatar={<PersonsIcon />}
						media={<GroupIllustration />}
					>
						<p className="conversationCreate__cardText">
							<strong>
								{translate('groupChat.circle.cardHeadline')}
							</strong>
							<br />
							{translate('groupChat.circle.cardText')}
						</p>
						<div className="conversationCreate__cardActions">
							{topicsLoadFailed ? (
								<p
									role="alert"
									className="conversationCreate__error"
								>
									{translate('groupChat.loadError.topics')}
									<button type="button" onClick={loadTopics}>
										{translate('groupChat.loadError.retry')}
									</button>
								</p>
							) : (
								<>
									<M3SplitButton
										ref={pickerSplitButtonRef}
										label={
											pickerTopic ||
											translate(
												'groupChat.circle.topicLabel'
											)
										}
										selected={!!pickerTopic}
										open={pickerTopicMenuOpen}
										leadingOpensMenu={!pickerTopic}
										onLeadingClick={() => {
											if (pickerTopic) {
												openCircleSettings();
											} else {
												setPickerTopicMenuOpen(
													(prev) => !prev
												);
											}
										}}
										onTrailingClick={() =>
											setPickerTopicMenuOpen(
												(prev) => !prev
											)
										}
										trailingAriaLabel={translate(
											'groupChat.circle.toggleTopicList'
										)}
									/>
									{pickerTopicMenuOpen && (
										<MenuPortal>
											<ul
												ref={topicMenuRef}
												className={`conversationCreate__topicMenu conversationCreate__topicMenu--${topicMenuLayout.direction}`}
												style={topicMenuLayout.style}
												role="listbox"
												onKeyDown={
													handleTopicMenuKeyDown
												}
											>
												{(topicOptions.length
													? topicOptions
													: [
															{
																value: '',
																label: translate(
																	'groupChat.circle.noTopics'
																)
															}
														]
												).map((topic) => (
													<li
														key={
															topic.value ||
															'none'
														}
													>
														<button
															type="button"
															role="option"
															aria-selected={
																pickerTopic ===
																topic.value
															}
															disabled={
																!topic.value
															}
															onClick={() => {
																setPickerTopic(
																	topic.value
																);
																closeTopicMenu(
																	true
																);
															}}
														>
															{topic.label}
														</button>
													</li>
												))}
											</ul>
										</MenuPortal>
									)}
								</>
							)}
						</div>
					</FormatCard>
				)}
				{availability.internal && renderInternalCard()}
			</div>
		</div>
	);

	return (
		<div className="conversationCreate">
			<div className="conversationCreate__header">
				<button
					type="button"
					onClick={handleBackButton}
					className="conversationCreate__backButton"
					aria-label={translate('groupChat.format.back')}
				>
					<BackIcon />
				</button>
				<h3 className="conversationCreate__headerTitle">
					{translate('groupChat.format.headerTitle')}
				</h3>
			</div>
			{hasError && step !== 'circle' && (
				<p role="alert" className="conversationCreate__error">
					{translate('groupChat.createError.overlay.headline')}
					<button type="button" onClick={clearError}>
						{translate('groupChat.createError.overlay.buttonLabel')}
					</button>
				</p>
			)}
			{step === 'circle' ? (
				isEditMode && !editPrefill ? (
					// Never render the settings form before the series has
					// hydrated: an un-hydrated submit would wipe the chat.
					<Loading />
				) : (
					<CircleSettingsView
						agencyOptions={agencyOptions}
						selectedAgency={selectedAgency}
						onAgencyChange={setSelectedAgency}
						activeLanguages={activeLanguages}
						translationAvailable={isGroupChatTranslationAvailable(
							tenantData
						)}
						prefill={isEditMode ? editPrefill : circlePrefill}
						topicOptions={
							topicOptions.length ? topicOptions : undefined
						}
						editChatId={editChatId}
						people={people}
					/>
				)
			) : step === 'internal' ? (
				<div className="conversationCreate__single">
					{renderInternalCard()}
				</div>
			) : (
				renderPicker()
			)}
		</div>
	);
};

export const CreateConversationView = () => {
	const { tenant: tenantData, isLoading } = useTenantState();

	if (isLoading) {
		return <Loading />;
	}

	const availability = getConversationFormatAvailability(tenantData);
	if (!availability.internal && !availability.circle) {
		return <Navigate to="/sessions/consultant/sessionView" replace />;
	}

	return <CreateConversationFlow />;
};
