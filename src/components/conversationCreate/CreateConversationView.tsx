import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState
} from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
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
	buildOneOffDuplicateFields,
	getValidDateFormatForSelectedDate,
	getValidTimeFormatForSelectedTime
} from '../groupChat/createChatHelpers';
import { GroupChatSeriesFieldsValue } from '../groupChat/GroupChatSeriesFields';
import { normalizeGroupChatLanguages } from '../groupChat/groupChatAuthorContent';
import {
	getAvailableFormats,
	getConversationFormatAvailability,
	isGroupChatTranslationAvailable
} from './formatAvailability';
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

type CreateStep = 'picker' | 'internal' | 'circle';

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

	const [step, setStep] = useState<CreateStep>(() => {
		if (duplicateOccurrence) {
			return 'circle';
		}
		if (availableFormats.length === 1) {
			return availableFormats[0] === 'internal' ? 'internal' : 'circle';
		}
		return 'picker';
	});
	const [circlePrefill, setCirclePrefill] = useState<
		CircleSettingsPrefill | undefined
	>(() =>
		duplicateOccurrence
			? {
					topic: duplicateOccurrence.topic,
					...buildOneOffDuplicateFields(duplicateOccurrence)
				}
			: undefined
	);
	const [pickerTopic, setPickerTopic] = useState('');
	const [pickerTopicMenuOpen, setPickerTopicMenuOpen] = useState(false);
	const [topics, setTopics] = useState<TenantAgenciesTopicsInterface[]>([]);
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
	// (Figma annotation "set this more vertical menu to disabled").
	useEffect(() => {
		document.body.classList.add('conversationCreate--active');
		return () => {
			document.body.classList.remove('conversationCreate--active');
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
	useEffect(() => {
		if (!selectedAgency || !availability.internal) {
			setAvailableConsultants([]);
			return;
		}
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
			});
	}, [availability.internal, selectedAgency, userData]);

	useEffect(() => {
		if (!availability.circle) {
			return;
		}
		apiGetTenantAgenciesTopics()
			.then((result) => setTopics(result || []))
			.catch(() => setTopics([]));
	}, [availability.circle]);

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

	const openCircleSettings = () => {
		setCirclePrefill(pickerTopic ? { topic: pickerTopic } : undefined);
		setStep('circle');
	};

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
							<M3SplitButton
								label={
									pickerTopic ||
									translate('groupChat.circle.topicLabel')
								}
								selected={!!pickerTopic}
								open={pickerTopicMenuOpen}
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
									setPickerTopicMenuOpen((prev) => !prev)
								}
								trailingAriaLabel={translate(
									'groupChat.circle.toggleTopicList'
								)}
							/>
							{pickerTopicMenuOpen && (
								<ul
									className="conversationCreate__topicMenu"
									role="listbox"
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
										<li key={topic.value || 'none'}>
											<button
												type="button"
												role="option"
												aria-selected={
													pickerTopic === topic.value
												}
												disabled={!topic.value}
												onClick={() => {
													setPickerTopic(
														topic.value
													);
													setPickerTopicMenuOpen(
														false
													);
												}}
											>
												{topic.label}
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					</FormatCard>
				)}
				{availability.internal && (
					<InternalChatCreateCard
						people={people}
						draft={internalDraft}
						onDraftChange={setInternalDraft}
						onCreate={handleInternalCreate}
						isSubmitting={isSubmitting}
						agencyOptions={agencyOptions}
						selectedAgency={selectedAgency?.toString()}
						onAgencyChange={(value) =>
							setSelectedAgency(parseInt(value))
						}
					/>
				)}
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
				<CircleSettingsView
					agencyOptions={agencyOptions}
					selectedAgency={selectedAgency}
					onAgencyChange={setSelectedAgency}
					activeLanguages={activeLanguages}
					translationAvailable={isGroupChatTranslationAvailable(
						tenantData
					)}
					prefill={circlePrefill}
					topicOptions={
						topicOptions.length ? topicOptions : undefined
					}
				/>
			) : step === 'internal' ? (
				<div className="conversationCreate__single">
					<InternalChatCreateCard
						people={people}
						draft={internalDraft}
						onDraftChange={setInternalDraft}
						onCreate={handleInternalCreate}
						isSubmitting={isSubmitting}
						agencyOptions={agencyOptions}
						selectedAgency={selectedAgency?.toString()}
						onAgencyChange={(value) =>
							setSelectedAgency(parseInt(value))
						}
					/>
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
