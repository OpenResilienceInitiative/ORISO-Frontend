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
import { ReactComponent as CircleIcon } from '../../resources/img/icons/self-help-group.svg';
import { ReactComponent as InternalIcon } from '../../resources/img/icons/internal-conversation.svg';
import { TopicIcon } from './TopicIcon';
import {
	getTopicCardArtwork,
	INTERNAL_CHAT_ARTWORK
} from '../../resources/img/topics';
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
	GroupChatEditSource
} from '../groupChat/createChatHelpers';
import { GroupChatSeriesFieldsValue } from '../groupChat/GroupChatSeriesFields';
import { normalizeGroupChatLanguages } from '../groupChat/groupChatAuthorContent';
import { useSession } from '../../hooks/useSession';
import { useCounsellorAgencyFormats } from '../../hooks/useCounsellorAgencyFormats';
import {
	AgencyFormatSource,
	ConversationFormat,
	CreateStep,
	getAgenciesOfferingFormat,
	getAvailableFormats,
	getConversationFormatAvailability,
	isGroupChatTranslationAvailable,
	resolveInitialStep
} from './formatAvailability';
import { filterTopicsForAgencies, getAgencyTopicIds } from './agencyTopics';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { FORMAT_ARTWORK } from '../../resources/img/formats';
import { DirectLinkCreateCard } from './directLink/DirectLinkCreateCard';
import { getDirectLinkMedia } from './directLink/directLinkAvailability';
import { RowMenu } from './RowMenu';
import { FormatCard } from './FormatCard';
import { PanelHeader } from './PanelHeader';
import { ScreenIntro } from './ScreenIntro';
import { BackPill } from './BackPill';
import { TopicMedia } from './TopicMedia';
import { CompactFormatRow } from './CompactFormatRow';
import { SplitButton } from '../splitButton/SplitButton';
import {
	InternalChatCreateCard,
	InternalChatDraft
} from './internal/InternalChatCreateCard';
import {
	CircleSettingsView,
	CircleSettingsPrefill
} from './circle/CircleSettingsView';
import { useInternalSubsetChatSubmit } from './useInternalSubsetChatSubmit';
import { resolveRecipientScope } from './internal/recipientScope';
import { loadInternalChatColleagues } from './internal/loadInternalChatColleagues';
import { internalSubsetErrorKey } from './internal/internalSubsetMessages';
import './conversationCreate.styles.scss';

/**
 * Create-conversation flow (Figma "Flow Self Help Group", node 8482-30552).
 *
 * Step 1 "Gesprächsformat wählen" offers the formats the Träger allows and
 * at least one of the counsellor's Beratungsstellen allows (#1440); with a
 * single available format the picker is skipped. Inside a format, the agency
 * choice lists only the Beratungsstellen that offer that format. Edit
 * mode also keeps the persisted agency so the existing assignment stays
 * selectable. "Interna besprechen" is completed entirely inside its card;
 * "Gesprächskreis" continues to the settings screen after a topic was
 * chosen on its card.
 */

interface CreateConversationFlowProps {
	/** The counsellor's agencies with their effective group-chat settings. */
	agencyFormats: AgencyFormatSource[];
}

const CreateConversationFlow = ({
	agencyFormats
}: CreateConversationFlowProps) => {
	const { t: translate, i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const tenantData = useTenant();
	const {
		userData,
		userData: { agencies = [] }
	} = useContext(UserDataContext);
	const { fromL } = useResponsive();
	const { submit, isSubmitting, errorReason, clearError } =
		useInternalSubsetChatSubmit();
	const recipientScope = resolveRecipientScope(tenantData);

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

	const availability = getConversationFormatAvailability(
		tenantData,
		agencyFormats
	);
	const availableFormats = getAvailableFormats(availability);
	/* #1795: the direct link is a format of its own, offered where
	   "Direkteinladung erlauben" allows at least one medium. Never in edit
	   mode, which only edits a circle. */
	const directLinkMedia = useMemo(
		() => getDirectLinkMedia(tenantData, agencyFormats),
		[tenantData, agencyFormats]
	);
	const directLinkOffered = !isEditMode && directLinkMedia.length > 0;
	const formatCount = availableFormats.length + (directLinkOffered ? 1 : 0);
	/* The group formats decide as before; a direct link next to a single
	   one keeps the picker, and alone it opens straight on its card. */
	const withDirectLink = (
		base: CreateStep,
		formats: ConversationFormat[],
		forcedByDuplicate: boolean
	): CreateStep => {
		if (!directLinkOffered || forcedByDuplicate) return base;
		return formats.length === 0 ? 'directLink' : 'picker';
	};
	const agencyIdsOffering = useMemo(
		() => ({
			internal: getAgenciesOfferingFormat(
				tenantData,
				agencyFormats,
				'internal'
			),
			circle: getAgenciesOfferingFormat(
				tenantData,
				agencyFormats,
				'circle'
			)
		}),
		[tenantData, agencyFormats]
	);

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
				timezone: draft.timezone,
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
			: withDirectLink(
					resolveInitialStep(
						availability,
						availableFormats,
						Boolean(duplicateOccurrence)
					),
					availableFormats,
					Boolean(duplicateOccurrence) && availability.circle
				)
	);

	useEffect(() => {
		if (isEditMode) {
			return;
		}
		const nextAvailability = {
			internal: availability.internal,
			circle: availability.circle
		};
		setStep((current) => {
			const nextFormats = getAvailableFormats(nextAvailability);
			const stillValid =
				(current === 'internal' && nextAvailability.internal) ||
				(current === 'circle' && nextAvailability.circle) ||
				(current === 'directLink' && directLinkOffered) ||
				(current === 'picker' &&
					nextFormats.length + (directLinkOffered ? 1 : 0) > 1);
			if (stillValid) {
				return current;
			}
			return withDirectLink(
				resolveInitialStep(
					nextAvailability,
					nextFormats,
					Boolean(duplicateOccurrence)
				),
				nextFormats,
				Boolean(duplicateOccurrence) && nextAvailability.circle
			);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps -- withDirectLink only reads directLinkOffered
	}, [
		availability.circle,
		availability.internal,
		directLinkOffered,
		duplicateOccurrence,
		isEditMode
	]);
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
	// Co-moderator candidates of the Gesprächskreis: the Träger's directory.
	const [availableConsultants, setAvailableConsultants] = useState<
		Consultant[]
	>([]);
	// The colleagues the Interna picker may offer, narrowed to the recipient
	// scope (#1772).
	const [internalColleagues, setInternalColleagues] = useState<Consultant[]>(
		[]
	);
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

	// The format whose agency choice is on screen: the circle settings on the
	// circle step, otherwise the internal card (the picker's only agency
	// choice). Edit mode keeps the persisted agency.
	const agencyChoiceFormat: ConversationFormat =
		step === 'circle' ? 'circle' : 'internal';
	const offeringAgencyIds = agencyIdsOffering[agencyChoiceFormat];
	useEffect(() => {
		if (isEditMode) {
			return;
		}
		setSelectedAgency((current) => {
			const next =
				current !== null && offeringAgencyIds.includes(current)
					? current
					: offeringAgencyIds.length === 1
						? offeringAgencyIds[0]
						: null;
			if (next !== current) {
				setInternalDraft((draft) =>
					draft.selectedIds.length === 0
						? draft
						: { ...draft, selectedIds: [] }
				);
			}
			return next;
		});
	}, [isEditMode, offeringAgencyIds]);

	// Co-moderator candidates for the Gesprächskreis: the Träger's other active
	// consultants without the current user, deduplicated by consultantId.
	useEffect(() => {
		if (
			step !== 'circle' ||
			selectedAgency === null ||
			!availability.circle
		) {
			setAvailableConsultants([]);
			return;
		}
		apiGetTenantConsultantList()
			.then((consultants) => {
				const currentUserId = userData?.userId;
				const unique = consultants.reduce((acc, consultant) => {
					if (
						consultant.consultantId === currentUserId ||
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
			.catch(() => setAvailableConsultants([]));
	}, [availability.circle, selectedAgency, step, userData?.userId]);

	// People for the internal card: only colleagues inside the recipient scope
	// of the Träger (#1772), without the current user. Every load gets a
	// number; an answer that is not for the latest load (another centre was
	// chosen meanwhile, the view went away) is dropped, and the previous list
	// is cleared when a load starts so it can never be picked from.
	const colleaguesLoadRef = useRef(0);
	const invalidateColleaguesLoad = useCallback(() => {
		colleaguesLoadRef.current += 1;
	}, []);
	const loadInternalColleagues = useCallback(() => {
		const load = ++colleaguesLoadRef.current;
		setInternalColleagues([]);
		setConsultantsLoadFailed(false);
		if (selectedAgency === null || !availability.internal) {
			return;
		}
		const isCurrent = () => colleaguesLoadRef.current === load;
		loadInternalChatColleagues({
			scope: recipientScope,
			agencyId: selectedAgency,
			currentUserId: userData?.userId
		})
			.then((colleagues) => {
				if (isCurrent()) {
					setInternalColleagues(colleagues);
				}
			})
			.catch(() => {
				if (isCurrent()) {
					setConsultantsLoadFailed(true);
				}
			});
	}, [
		availability.internal,
		recipientScope,
		selectedAgency,
		userData?.userId
	]);

	useEffect(() => {
		loadInternalColleagues();
		return invalidateColleaguesLoad;
	}, [invalidateColleaguesLoad, loadInternalColleagues]);

	const loadTopics = useCallback(() => {
		if (!availability.circle && !directLinkOffered) {
			return;
		}
		setTopicsLoadFailed(false);
		apiGetTenantAgenciesTopics()
			.then((result) => setTopics(result || []))
			.catch(() => {
				setTopics([]);
				setTopicsLoadFailed(true);
			});
	}, [availability.circle, directLinkOffered]);

	useEffect(() => {
		loadTopics();
	}, [loadTopics]);

	const agencyOptionsFor = useCallback(
		(format: ConversationFormat) =>
			agencies
				.filter(
					({ id }) =>
						agencyIdsOffering[format].includes(id) ||
						(isEditMode && id === editPrefill?.agencyId)
				)
				.map(({ id, name }) => ({
					value: id.toString(),
					label: name
				})),
		[agencies, agencyIdsOffering, editPrefill?.agencyId, isEditMode]
	);

	const toPeople = (consultants: Consultant[]) =>
		consultants.map((consultant) => ({
			id: consultant.consultantId,
			label: `${consultant.firstName} ${consultant.lastName}`.trim()
		}));
	const people = useMemo(
		() => toPeople(availableConsultants),
		[availableConsultants]
	);
	const internalPeople = useMemo(
		() => toPeople(internalColleagues),
		[internalColleagues]
	);

	// Only the topics this counselling centre offers (see agencyTopics).
	const topicOptions = useMemo(
		() =>
			filterTopicsForAgencies(topics, agencies, selectedAgency).map(
				(topic) => ({
					value: topic.name,
					label: topic.name
				})
			),
		[agencies, selectedAgency, topics]
	);

	const handleBackButton = useCallback(() => {
		if (step !== 'picker' && formatCount > 1) {
			setStep('picker');
			clearError();
			return;
		}
		navigate('/sessions/consultant/sessionView');
	}, [formatCount, clearError, navigate, step]);

	/* The direct link offers every topic of the counsellor's
	   Beratungsstellen; the id goes to the backend, the name is shown. */
	const directLinkTopics = useMemo(
		() =>
			filterTopicsForAgencies(topics, agencies, null)
				.filter((topic) => topic.id !== undefined)
				.map((topic) => ({
					value: String(topic.id),
					label: topic.name
				})),
		[agencies, topics]
	);
	const directLinkAgencies = useMemo(
		() =>
			agencies.map((agency) => ({
				id: agency.id,
				topicIds: getAgencyTopicIds([agency], agency.id) ?? []
			})),
		[agencies]
	);
	const renderDirectLinkCard = () => (
		<DirectLinkCreateCard
			topics={directLinkTopics}
			agencies={directLinkAgencies}
			media={directLinkMedia}
			compact={!fromL}
			/* "Fertig": the link now lives in "Gespräche". */
			onDone={() => navigate('/sessions/consultant/sessionView')}
		/>
	);

	const handleInternalCreate = () => {
		if (selectedAgency === null) {
			return;
		}
		// The selection is the recipient list: no moderators, groups or
		// "everyone" are added, and a refusal never falls back to a broader
		// room. The UserService creates (or reuses) a members-only room.
		submit({
			selectedIds: internalDraft.selectedIds,
			agencyId: selectedAgency,
			name: internalDraft.name
		});
	};

	// Switching agency must drop the previously picked colleagues: they belong
	// to the old agency and would otherwise leak across agencies into the new
	// internal chat (the consultant list reloads for the new agency). A refusal
	// belongs to the previous centre's request and goes with it.
	const handleInternalAgencyChange = (value: string) => {
		setSelectedAgency(parseInt(value));
		setInternalDraft((draft) => ({ ...draft, selectedIds: [] }));
		clearError();
	};

	const openCircleSettings = () => {
		setCirclePrefill(pickerTopic ? { topic: pickerTopic } : undefined);
		setStep('circle');
	};

	// Topic listbox keyboard contract (WCAG combobox/listbox): focus moves into
	// the popup on open, Arrow/Home/End roam the options and Escape returns
	// focus to the trigger.
	const pickerSplitButtonRef = useRef<HTMLDivElement | null>(null);

	const closeTopicMenu = (returnFocus: boolean) => {
		setPickerTopicMenuOpen(false);
		if (returnFocus) {
			pickerSplitButtonRef.current
				?.querySelector<HTMLButtonElement>('button')
				?.focus();
		}
	};

	const renderInternalCard = () => (
		<>
			{consultantsLoadFailed && (
				<p role="alert" className="conversationCreate__error">
					{translate('groupChat.loadError.consultants')}
					<button type="button" onClick={loadInternalColleagues}>
						{translate('groupChat.loadError.retry')}
					</button>
				</p>
			)}
			<InternalChatCreateCard
				people={internalPeople}
				draft={internalDraft}
				onDraftChange={(draft) => {
					// A refusal stays while the name is typed (a screen reader
					// may still be reading it); it goes with a new selection.
					if (draft.selectedIds !== internalDraft.selectedIds) {
						clearError();
					}
					setInternalDraft(draft);
				}}
				onCreate={handleInternalCreate}
				scope={recipientScope}
				errorMessage={
					errorReason
						? translate(internalSubsetErrorKey(errorReason))
						: undefined
				}
				isSubmitting={isSubmitting}
				agencyOptions={agencyOptionsFor('internal')}
				selectedAgency={selectedAgency?.toString()}
				onAgencyChange={handleInternalAgencyChange}
			/>
		</>
	);

	const circleCard = (
		<FormatCard
			className="conversationCreate__formatCard"
			title={translate('groupChat.circle.title')}
			subtitle={translate('groupChat.circle.subtitle')}
			avatar={<CircleIcon />}
			media={
				<TopicMedia
					topic={pickerTopic}
					alt={translate('groupChat.circle.title')}
				/>
			}
		>
			<p className="conversationCreate__cardText">
				<strong>{translate('groupChat.circle.cardHeadline')}</strong>
				<br />
				{translate('groupChat.circle.cardText')}
			</p>
			<div className="conversationCreate__cardActions">
				{topicsLoadFailed ? (
					<p role="alert" className="conversationCreate__error">
						{translate('groupChat.loadError.topics')}
						<button type="button" onClick={loadTopics}>
							{translate('groupChat.loadError.retry')}
						</button>
					</p>
				) : (
					<>
						<SplitButton
							ref={pickerSplitButtonRef}
							fullWidth
							icon={<TopicIcon filled={Boolean(pickerTopic)} />}
							label={
								pickerTopic ||
								translate('groupChat.circle.topicLabel')
							}
							id="pickerTopicButton"
							variant={
								pickerTopicMenuOpen
									? 'elevated'
									: pickerTopic
										? 'primary'
										: 'outlined'
							}
							open={pickerTopicMenuOpen}
							mainOpensMenu={!pickerTopic}
							onClick={() => {
								if (pickerTopic) {
									openCircleSettings();
								} else {
									setPickerTopicMenuOpen((prev) => !prev);
								}
							}}
							onToggleMenu={() =>
								setPickerTopicMenuOpen((prev) => !prev)
							}
							menuLabel={translate(
								'groupChat.circle.toggleTopicList'
							)}
						/>
						{pickerTopicMenuOpen && (
							<RowMenu
								options={
									topicOptions.length
										? topicOptions
										: [
												{
													value: '',
													label: translate(
														'groupChat.circle.noTopics'
													)
												}
											]
								}
								value={pickerTopic}
								onSelect={(next) => {
									if (!next) {
										return;
									}
									setPickerTopic(next);
									closeTopicMenu(true);
								}}
								anchorRef={pickerSplitButtonRef}
								onClose={() => closeTopicMenu(false)}
								labelledBy="pickerTopicButton"
							/>
						)}
					</>
				)}
			</div>
		</FormatCard>
	);

	const renderPicker = () => (
		<div
			className={`conversationCreate__picker${
				fromL ? '' : ' conversationCreate__picker--compact'
			}`}
		>
			<ScreenIntro
				title={translate('groupChat.format.title')}
				subtitle={translate('groupChat.format.subtitle')}
			/>
			<div
				className={`conversationCreate__selection${
					fromL ? '' : ' conversationCreate__selection--rows'
				}`}
			>
				{fromL ? (
					<div className="conversationCreate__cards">
						{availability.circle && circleCard}
						{availability.internal && renderInternalCard()}
						{directLinkOffered && renderDirectLinkCard()}
					</div>
				) : (
					<div className="conversationCreate__rows">
						{availability.internal && (
							<CompactFormatRow
								icon={<InternalIcon />}
								title={translate('groupChat.internal.title')}
								subtitle={translate(
									'groupChat.internal.subtitle'
								)}
								image={INTERNAL_CHAT_ARTWORK}
								onSelect={() => setStep('internal')}
							/>
						)}
						{availability.circle && (
							<CompactFormatRow
								icon={<CircleIcon />}
								title={translate('groupChat.circle.title')}
								subtitle={translate(
									'groupChat.circle.subtitle'
								)}
								image={getTopicCardArtwork(null)}
								onSelect={() => setStep('circle')}
							/>
						)}
						{directLinkOffered && (
							<CompactFormatRow
								icon={<LinkOutlinedIcon />}
								title={translate('directLink.card.title')}
								subtitle={translate('directLink.card.subtitle')}
								image={FORMAT_ARTWORK.VIDEO}
								onSelect={() => setStep('directLink')}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);

	return (
		<div className="conversationCreate">
			<PanelHeader
				title={translate('groupChat.format.panelTitle')}
				menuLabel={translate('groupChat.format.panelMenu')}
				menuDisabled
			/>
			{step === 'circle' ? (
				isEditMode && !editPrefill ? (
					// Never render the settings form before the series has
					// hydrated: an un-hydrated submit would wipe the chat.
					<Loading />
				) : (
					<CircleSettingsView
						agencyOptions={agencyOptionsFor('circle')}
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
						compact={!fromL}
					/>
				)
			) : step === 'directLink' ? (
				<div
					className={`conversationCreate__single${
						fromL ? '' : ' conversationCreate__single--compact'
					}`}
				>
					{renderDirectLinkCard()}
				</div>
			) : step === 'internal' ? (
				<div
					className={`conversationCreate__single${
						fromL ? '' : ' conversationCreate__single--compact'
					}`}
				>
					{renderInternalCard()}
				</div>
			) : (
				renderPicker()
			)}
			{/* Figma: the back control is a mobile-only affordance. */}
			{!fromL && (
				<BackPill
					label={translate('groupChat.format.back')}
					onClick={handleBackButton}
				/>
			)}
		</div>
	);
};

export const CreateConversationView = () => {
	const { tenant: tenantData, isLoading } = useTenantState();
	const { agencies: agencyFormats, isLoading: agencyFormatsLoading } =
		useCounsellorAgencyFormats();
	// Wait for the current agency-id set. A later refresh of the same set
	// (e.g. the session list mounting) must not unmount a flow with a draft.
	const agencyFormatsKey = agencyFormats.map(({ id }) => id).join(',');
	const agencyFormatsReadyFor = useRef<string | null>(null);
	if (!agencyFormatsLoading) {
		agencyFormatsReadyFor.current = agencyFormatsKey;
	}

	if (isLoading || agencyFormatsReadyFor.current !== agencyFormatsKey) {
		return <Loading />;
	}

	const availability = getConversationFormatAvailability(
		tenantData,
		agencyFormats
	);
	if (
		!availability.internal &&
		!availability.circle &&
		getDirectLinkMedia(tenantData, agencyFormats).length === 0
	) {
		return <Navigate to="/sessions/consultant/sessionView" replace />;
	}

	return <CreateConversationFlow agencyFormats={agencyFormats} />;
};
