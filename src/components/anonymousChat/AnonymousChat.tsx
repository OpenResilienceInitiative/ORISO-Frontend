import * as React from 'react';
import { useState, useEffect, useContext, FC, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	Typography,
	Box,
	Button,
	FormControl,
	RadioGroup,
	FormControlLabel,
	Radio,
	IconButton,
	InputAdornment,
	TextField,
	Dialog
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { apiAgencySelection } from '../../api/apiAgencySelection';
import { apiGetConsultantAvailability } from '../../api/apiGetConsultantAvailability';
import liveChatClosedIllustration from '../../resources/img/illustrations/live-chat-closed.svg';
import { apiGetTopicsData } from '../../api/apiGetTopicsData';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { redirectToApp } from '../registration/autoLogin';
import { endpoints } from '../../resources/scripts/endpoints';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
	TenantContext,
	LocaleContext,
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR,
	NOTIFICATION_TYPE_SUCCESS
} from '../../globalState';
import { StageLayout } from '../stageLayout/StageLayout';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { Loading } from '../app/Loading';
import { AgencyLanguages } from '../registration/agencySelection/AgencyLanguages';
import { InfoTooltip } from '../infoTooltip/InfoTooltip';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { LIVE_CHAT_OPENING_HOURS } from './liveChatOpeningHours';

interface AnonymousChatProps {
	onBack: () => void;
}

export const AnonymousChat: FC<AnonymousChatProps> = ({ onBack }) => {
	const { t } = useTranslation();
	const history = useHistory();
	const settings = useAppConfig();
	const { tenant } = useContext(TenantContext);
	const { Stage } = useContext(GlobalComponentContext);
	const { locale } = useContext(LocaleContext);
	const { addNotification } = useContext(NotificationsContext);

	const [topics, setTopics] = useState<TopicsDataInterface[]>([]);
	const [topicAgencies, setTopicAgencies] = useState<
		Map<number, AgencyDataInterface[]>
	>(new Map());
	const [loadingTopics, setLoadingTopics] = useState<boolean>(true);
	const [loadingAgencies, setLoadingAgencies] = useState<
		Map<number, boolean>
	>(new Map());
	const [selectedAgency, setSelectedAgency] =
		useState<AgencyDataInterface | null>(null);
	const [selectedTopic, setSelectedTopic] =
		useState<TopicsDataInterface | null>(null);
	const [expandedTopics, setExpandedTopics] = useState<Set<number>>(
		new Set()
	);
	const [isRegistering, setIsRegistering] = useState<boolean>(false);
	const [username, setUsername] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const [noAvailabilityModalTopic, setNoAvailabilityModalTopic] =
		useState<TopicsDataInterface | null>(null);
	const [noAvailabilityModalOpen, setNoAvailabilityModalOpen] =
		useState<boolean>(false);
	const [showOpeningHoursHint, setShowOpeningHoursHint] =
		useState<boolean>(false);
	const [shownNoAvailabilityTopics, setShownNoAvailabilityTopics] = useState<
		Set<number>
	>(new Set());

	// Generate username and 8-character random password on mount
	useEffect(() => {
		const timestamp = Date.now();
		const generatedUsername = `Anonymous-${timestamp}`;
		setUsername(generatedUsername);

		// Generate 8-character random password
		const chars =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let generatedPassword = '';
		for (let i = 0; i < 8; i++) {
			generatedPassword += chars.charAt(
				Math.floor(Math.random() * chars.length)
			);
		}
		setPassword(generatedPassword);
	}, []);

	// Fetch all topics on mount
	useEffect(() => {
		setLoadingTopics(true);
		apiGetTopicsData()
			.then((topicsData) => {
				// Filter only active topics
				const activeTopics = topicsData.filter(
					(topic) => topic.status === 'ACTIVE'
				);
				setTopics(activeTopics);
				// Auto-expand first topic
				if (activeTopics.length > 0) {
					setExpandedTopics(new Set([activeTopics[0].id]));
					loadAgenciesForTopic(activeTopics[0]);
				}
			})
			.catch((err) => {
				// console.error('Error fetching topics:', err);
				setTopics([]);
			})
			.finally(() => {
				setLoadingTopics(false);
			});
	}, []);

	const openNoAvailabilityModal = useCallback(
		(topic: TopicsDataInterface) => {
			setNoAvailabilityModalTopic(topic);
			setNoAvailabilityModalOpen(true);
			setShowOpeningHoursHint(false);
		},
		[]
	);

	/**
	 * Real-time, topic-based availability check. Resolves to whether a
	 * consultant is currently available for the topic and opens the alert when
	 * not. Mirrors the backend routing logic, so the alert matches what would
	 * actually happen if the enquiry were created. A failed request resolves to
	 * `true` (unknown) so transient errors never block the user.
	 *
	 * `force` opens the modal even if it was already shown for this topic
	 * (used on "Beratung starten"); otherwise it auto-shows once per topic.
	 */
	const checkConsultantAvailability = useCallback(
		(
			topic: TopicsDataInterface,
			consultingTypeId?: number,
			{ force = false }: { force?: boolean } = {}
		): Promise<boolean> =>
			apiGetConsultantAvailability(topic.id, consultingTypeId)
				.then((res) => {
					if (res && res.available === false) {
						if (force) {
							openNoAvailabilityModal(topic);
						} else {
							setShownNoAvailabilityTopics((prev) => {
								if (prev.has(topic.id)) {
									return prev;
								}
								const next = new Set(prev);
								next.add(topic.id);
								openNoAvailabilityModal(topic);
								return next;
							});
						}
						return false;
					}
					return true;
				})
				.catch(() => true),
		[openNoAvailabilityModal]
	);

	// Load agencies for a specific topic
	const loadAgenciesForTopic = useCallback(
		(topic: TopicsDataInterface) => {
			// If already loaded, don't reload
			if (topicAgencies.has(topic.id)) {
				return;
			}

			setLoadingAgencies((prev) => new Map(prev).set(topic.id, true));
			const abortController = new AbortController();

			// Fetch agencies for this topic without postcode filter
			apiAgencySelection(
				{
					topicId: topic.id,
					consultingType: 1, // Default consulting type
					fetchConsultingTypeDetails: true
					// Don't pass postcode to get all agencies
				},
				abortController.signal
			)
				.then((data) => {
					if (data && data.length > 0) {
						// Filter out external agencies
						const internalAgencies = data.filter(
							(agency) => !agency.external
						);
						// Remove duplicates by agency ID
						const uniqueAgencies = Array.from(
							new Map(
								internalAgencies.map((agency) => [
									agency.id,
									agency
								])
							).values()
						);
						setTopicAgencies((prev) => {
							const newMap = new Map(prev);
							newMap.set(topic.id, uniqueAgencies);
							return newMap;
						});
						// Auto-select first agency if none selected
						if (!selectedAgency && uniqueAgencies.length > 0) {
							setSelectedAgency(uniqueAgencies[0]);
							setSelectedTopic(topic);
						}
						// Agencies exist, but a counsellor may still be offline:
						// real-time topic-based availability check.
						checkConsultantAvailability(
							topic,
							uniqueAgencies[0]?.consultingType
						);
					} else {
						setTopicAgencies((prev) => {
							const newMap = new Map(prev);
							newMap.set(topic.id, []);
							return newMap;
						});
						setSelectedTopic(topic);
						setSelectedAgency(null);
						setShownNoAvailabilityTopics((prev) => {
							if (prev.has(topic.id)) {
								return prev;
							}

							const next = new Set(prev);
							next.add(topic.id);
							setNoAvailabilityModalTopic(topic);
							setNoAvailabilityModalOpen(true);
							setShowOpeningHoursHint(false);
							return next;
						});
					}
				})
				.catch((err) => {
					// console.error(
					// `Error fetching agencies for topic ${topic.id}:`,
					// err
					// );
					setTopicAgencies((prev) => {
						const newMap = new Map(prev);
						newMap.set(topic.id, []);
						return newMap;
					});
					setSelectedTopic(topic);
					setSelectedAgency(null);
				})
				.finally(() => {
					setLoadingAgencies((prev) => {
						const newMap = new Map(prev);
						newMap.set(topic.id, false);
						return newMap;
					});
				});

			return () => {
				abortController.abort();
			};
		},
		[topicAgencies, selectedAgency, checkConsultantAvailability]
	);

	// Handle topic expansion
	const handleTopicToggle = (topic: TopicsDataInterface) => {
		setExpandedTopics((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(topic.id)) {
				newSet.delete(topic.id);
			} else {
				newSet.add(topic.id);
				loadAgenciesForTopic(topic);
			}
			return newSet;
		});
	};

	const handleRegister = useCallback(() => {
		if (!selectedAgency || isRegistering) {
			return;
		}

		setIsRegistering(true);

		const proceedRegistration = () => {
			// Always use "00000" for anonymous chat postcode
			const validPostcode = '00000';

			// Build registration data exactly like normal registration
			const registrationData = {
				username: username,
				password: password,
				agencyId: selectedAgency.id.toString(),
				postcode: validPostcode,
				termsAccepted: 'true',
				preferredLanguage: locale || 'de',
				consultingType: selectedAgency.consultingType, // Keep as number, same as normal registration
				// Use the selected topic - match normal registration structure
				...(selectedTopic
					? {
							mainTopicId: selectedTopic.id.toString(),
							// topicId is optional in normal registration, set it to mainTopicId if available
							topicId: selectedTopic.id.toString()
						}
					: selectedAgency.topicIds &&
						  selectedAgency.topicIds.length > 0
						? {
								mainTopicId:
									selectedAgency.topicIds[0].toString(),
								topicId: selectedAgency.topicIds[0].toString()
							}
						: {})
			};

			apiPostRegistration(
				endpoints.registerAsker,
				registrationData,
				settings.multitenancyWithSingleDomainEnabled,
				tenant
			)
				.then(() => {
					// Registration successful, auto-login completed by apiPostRegistration
					// Redirect to app (same as normal registration)
					redirectToApp();
				})
				.catch((error) => {
					// console.error('Anonymous chat registration failed:', error);
					setIsRegistering(false);
					addNotification({
						notificationType: NOTIFICATION_TYPE_ERROR,
						title: t('registration.errors.ups.title'),
						text: t('registration.errors.ups.text'),
						closeable: true,
						timeout: 3000
					});
				});
		};

		// Re-verify availability at the moment of starting — presence can change
		// between selecting the topic and clicking start. Block and show the
		// alert when no counsellor is available.
		if (selectedTopic) {
			checkConsultantAvailability(
				selectedTopic,
				selectedAgency.consultingType,
				{ force: true }
			).then((available) => {
				if (!available) {
					setIsRegistering(false);
					return;
				}
				proceedRegistration();
			});
		} else {
			proceedRegistration();
		}
	}, [
		username,
		password,
		selectedAgency,
		selectedTopic,
		checkConsultantAvailability,
		locale,
		settings,
		tenant,
		isRegistering,
		t,
		addNotification
	]);

	const canRegister = selectedAgency && selectedTopic && !isRegistering;

	return (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady={true} />}
			showLegalLinks
			showRegistrationLink={false}
		>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					height: 'calc(100vh - 120px)', // Account for header/footer
					maxWidth: '600px',
					margin: '0 auto',
					padding: '20px',
					boxSizing: 'border-box',
					position: 'relative'
				}}
			>
				{/* Scrollable Content Area */}
				<Box
					sx={{
						'flex': 1,
						'overflowY': 'auto',
						'overflowX': 'hidden',
						'minHeight': 0, // Important for flex scrolling
						// Custom scrollbar styling
						'&::-webkit-scrollbar': {
							width: '2px',
							paddingLeft: '10px'
						},
						'&::-webkit-scrollbar-track': {
							background: 'transparent'
						},
						'&::-webkit-scrollbar-thumb': {
							'background': '#ffffff',
							'borderRadius': '3px',
							'&:hover': {
								background: '#b71c1c'
							}
						},
						// Firefox scrollbar
						'scrollbarWidth': 'thin',
						'scrollbarColor': '#ffffff transparent'
					}}
				>
					<Typography variant="h3" sx={{ mb: '24px' }}>
						{t('anonymousChat.headline', 'Anonyme Beratung')}
					</Typography>

					<Typography
						variant="body1"
						sx={{ mb: '32px', color: 'text.secondary' }}
					>
						{t(
							'anonymousChat.subline',
							'Wählen Sie eine Beratungsstelle und starten Sie sofort eine anonyme Beratung.'
						)}
					</Typography>

					{/* Username and Password Display (Read-only) */}
					<Box sx={{ mb: '32px' }}>
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								gap: '16px',
								p: '16px',
								border: '2px solid',
								borderColor: '#c62828', // Dark red border
								borderRadius: '4px',
								backgroundColor: '#ffebee' // Light red background
							}}
						>
							{/* Username Section */}
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: '12px'
								}}
							>
								<PersonIcon sx={{ color: '#c62828' }} />
								<Box sx={{ flex: 1 }}>
									<Typography
										variant="body2"
										sx={{
											color: 'text.secondary',
											mb: '4px'
										}}
									>
										{t(
											'registration.account.username.label',
											'Benutzername'
										)}
									</Typography>
									<Typography
										variant="body1"
										sx={{ fontWeight: '500' }}
									>
										{username}
									</Typography>
									<Typography
										variant="caption"
										sx={{
											color: 'text.secondary',
											mt: '4px'
										}}
									>
										{t(
											'anonymousChat.username.info',
											'Dieser Benutzername wurde automatisch generiert'
										)}
									</Typography>
								</Box>
							</Box>

							{/* Divider */}
							<Box
								sx={{
									width: '100%',
									height: '1px',
									backgroundColor: '#c62828',
									opacity: 0.3
								}}
							/>

							{/* Password Section */}
							<Box>
								<Typography
									variant="body2"
									sx={{ color: 'text.secondary', mb: '8px' }}
								>
									{t(
										'registration.account.password.label',
										'Passwort'
									)}
								</Typography>
								<TextField
									fullWidth
									value={password}
									InputProps={{
										readOnly: true,
										endAdornment: (
											<InputAdornment position="end">
												<IconButton
													onClick={() => {
														navigator.clipboard.writeText(
															password
														);
														addNotification({
															notificationType:
																NOTIFICATION_TYPE_SUCCESS,
															title: t(
																'anonymousChat.password.copied.title',
																'Passwort kopiert'
															),
															text: t(
																'anonymousChat.password.copied.text',
																'Das Passwort wurde in die Zwischenablage kopiert.'
															),
															closeable: true,
															timeout: 3000
														});
													}}
													edge="end"
													sx={{ color: '#c62828' }}
												>
													<ContentCopyIcon />
												</IconButton>
											</InputAdornment>
										)
									}}
									sx={{
										'& .MuiOutlinedInput-root': {
											'backgroundColor': 'white',
											'& fieldset': {
												borderColor: '#c62828'
											},
											'&:hover fieldset': {
												borderColor: '#c62828'
											},
											'&.Mui-focused fieldset': {
												borderColor: '#c62828'
											}
										}
									}}
								/>
								<Typography
									variant="caption"
									sx={{
										color: '#c62828',
										fontWeight: '500',
										mt: '8px',
										display: 'block'
									}}
								>
									{t(
										'anonymousChat.password.warning',
										'Bitte kopieren Sie das Passwort und speichern Sie es sicher, um später auf Ihr Konto zugreifen zu können.'
									)}
								</Typography>
							</Box>
						</Box>
					</Box>

					{/* Topics and Agencies Selection */}
					<Box sx={{ mb: '32px' }}>
						<Typography
							variant="h5"
							sx={{ mb: '16px', fontWeight: '600' }}
						>
							{t(
								'anonymousChat.topics.headline',
								'Beratungsthemen und Beratungsstellen wählen'
							)}
						</Typography>

						{loadingTopics ? (
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'center',
									py: '40px'
								}}
							>
								<Loading />
							</Box>
						) : topics.length === 0 ? (
							<Typography
								variant="body2"
								sx={{ color: 'text.secondary' }}
							>
								{t(
									'anonymousChat.topics.noresults',
									'Keine Beratungsthemen verfügbar.'
								)}
							</Typography>
						) : (
							<Box>
								{topics.map((topic) => {
									const agencies =
										topicAgencies.get(topic.id) || [];
									const isLoadingAgencies =
										loadingAgencies.get(topic.id) || false;
									const isExpanded = expandedTopics.has(
										topic.id
									);

									return (
										<Accordion
											key={`topic-${topic.id}`}
											expanded={isExpanded}
											onChange={() =>
												handleTopicToggle(topic)
											}
											sx={{ mb: '8px' }}
										>
											<AccordionSummary
												expandIcon={
													isExpanded ? (
														<ExpandLessIcon />
													) : (
														<ExpandMoreIcon />
													)
												}
											>
												<Typography
													variant="h6"
													sx={{ fontWeight: '600' }}
												>
													{t(
														`anonymousChat.topics.names.${topic.slug}`,
														topic.name
													)}
												</Typography>
											</AccordionSummary>
											<AccordionDetails>
												{isLoadingAgencies ? (
													<Box
														sx={{
															display: 'flex',
															justifyContent:
																'center',
															py: '20px'
														}}
													>
														<Loading />
													</Box>
												) : agencies.length === 0 ? (
													<Typography
														variant="body2"
														sx={{
															color: 'text.secondary'
														}}
													>
														{t(
															'anonymousChat.agencies.noresults',
															'Für dieses Thema sind keine Beratungsstellen verfügbar.'
														)}
													</Typography>
												) : (
													<FormControl
														sx={{ width: '100%' }}
													>
														<RadioGroup
															value={
																selectedTopic?.id ===
																topic.id
																	? selectedAgency?.id ||
																		''
																	: ''
															}
															onChange={(e) => {
																const agency =
																	agencies.find(
																		(a) =>
																			a.id.toString() ===
																			e
																				.target
																				.value
																	);
																if (agency) {
																	setSelectedAgency(
																		agency
																	);
																	setSelectedTopic(
																		topic
																	);
																}
															}}
														>
															{agencies.map(
																(
																	agency,
																	index
																) => {
																	const isSelected =
																		selectedAgency?.id ===
																			agency.id &&
																		selectedTopic?.id ===
																			topic.id;
																	return (
																		<Box
																			key={`agency-${agency.id}`}
																			sx={{
																				display:
																					'flex',
																				justifyContent:
																					'space-between',
																				width: '100%',
																				mt:
																					index ===
																					0
																						? '0'
																						: '16px',
																				p: '16px',
																				border: isSelected
																					? '2px solid'
																					: '1px solid',
																				borderColor:
																					isSelected
																						? '#c62828' // Dark red border for selected
																						: 'divider',
																				borderRadius:
																					'4px',
																				backgroundColor:
																					isSelected
																						? '#ffebee' // Light red background for selected
																						: 'background.paper'
																			}}
																		>
																			<FormControlLabel
																				value={
																					agency.id
																				}
																				control={
																					<Radio
																						checked={
																							selectedAgency?.id ===
																								agency.id &&
																							selectedTopic?.id ===
																								topic.id
																						}
																						checkedIcon={
																							<TaskAltIcon
																								sx={{
																									color: '#c62828'
																								}}
																							/>
																						}
																					/>
																				}
																				label={
																					<Box
																						sx={{
																							ml: '10px',
																							width: '100%'
																						}}
																					>
																						<Box
																							sx={{
																								display:
																									'flex',
																								alignItems:
																									'center',
																								gap: '8px'
																							}}
																						>
																							<Typography variant="body1">
																								{
																									agency.name
																								}
																							</Typography>
																							<InfoTooltip
																								translation={{
																									ns: 'agencies',
																									prefix: 'agency'
																								}}
																								info={
																									agency
																								}
																								isProfileView={
																									false
																								}
																							/>
																						</Box>
																						<Typography
																							variant="body2"
																							sx={{
																								color: 'info.light',
																								mt: '8px'
																							}}
																						>
																							{t(
																								'registration.agency.result.languages',
																								'Diese Beratungsstelle berät Sie auf:'
																							)}
																						</Typography>
																						<AgencyLanguages
																							agencyId={
																								agency.id
																							}
																						/>
																					</Box>
																				}
																				sx={{
																					alignItems:
																						'flex-start'
																				}}
																			/>
																		</Box>
																	);
																}
															)}
														</RadioGroup>
													</FormControl>
												)}
											</AccordionDetails>
										</Accordion>
									);
								})}
							</Box>
						)}
					</Box>
				</Box>

				{/* Fixed Action Buttons at Bottom */}
				<Box
					sx={{
						flexShrink: 0,
						display: 'flex',
						justifyContent: 'space-between',
						gap: '16px',
						pt: '20px',
						pb: '10px',
						backgroundColor: 'background.default',
						borderTop: '1px solid',
						borderColor: 'divider',
						position: 'sticky',
						bottom: 0,
						zIndex: 10
					}}
				>
					<Button
						variant="outlined"
						onClick={onBack}
						disabled={isRegistering}
						sx={{ flex: 1 }}
					>
						{t('registration.back', 'Zurück')}
					</Button>
					<Button
						variant="contained"
						onClick={handleRegister}
						disabled={!canRegister}
						sx={{ flex: 1 }}
					>
						{isRegistering
							? t(
									'registration.registering',
									'Registrierung läuft...'
								)
							: t('anonymousChat.start', 'Beratung starten')}
					</Button>
				</Box>
			</Box>

			<Dialog
				open={noAvailabilityModalOpen}
				onClose={() => setNoAvailabilityModalOpen(false)}
				fullWidth
				maxWidth={false}
				PaperProps={{
					sx: {
						width: '100%',
						maxWidth: '600px',
						m: { xs: '16px', sm: '32px' },
						borderRadius: '24px'
					}
				}}
			>
				<Box
					sx={{
						p: { xs: '20px', md: '24px' },
						borderRadius: '24px'
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							mb: '16px'
						}}
					>
						<Box
							component="img"
							src={liveChatClosedIllustration}
							alt=""
							sx={{
								width: 72,
								height: 72,
								flexShrink: 0,
								display: 'block'
							}}
						/>
						<Typography
							variant="h4"
							sx={{ fontWeight: 700, lineHeight: 1.2 }}
						>
							{t(
								'anonymousChat.noAvailability.title',
								'Live-Chat ist zurzeit leider geschlossen'
							)}
						</Typography>
					</Box>

					<Typography variant="body1" sx={{ mb: '16px' }}>
						{t(
							'anonymousChat.noAvailability.subtitle',
							'Wenn Sie ohne Registrierung beraten werden möchten, kommen Sie bitte zu den Öffnungszeiten wieder.'
						)}
					</Typography>

					<Box
						sx={{
							border: '1px solid #DAE3F0',
							borderRadius: '12px',
							p: '8px',
							mb: '16px'
						}}
					>
						<Box
							onClick={() =>
								setShowOpeningHoursHint((prev) => !prev)
							}
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								p: '6px',
								cursor: 'pointer'
							}}
						>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: '4px'
								}}
							>
								<AccessTimeOutlinedIcon
									sx={{ fontSize: 16, color: '#4C555F' }}
								/>
								<Typography
									sx={{
										color: '#4C555F',
										fontSize: '12px',
										lineHeight: '14px'
									}}
								>
									{t(
										'anonymousChat.noAvailability.openingHours',
										'Reguläre Öffnungszeiten anzeigen'
									)}
								</Typography>
							</Box>
							<KeyboardArrowDownIcon
								sx={{
									color: '#4C555F',
									fontSize: 16,
									transform: showOpeningHoursHint
										? 'rotate(180deg)'
										: 'none',
									transition: 'transform 0.2s'
								}}
							/>
						</Box>

						{showOpeningHoursHint &&
							LIVE_CHAT_OPENING_HOURS.map((entry, index) => (
								<Box
									key={`opening-hours-${index}`}
									sx={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										px: '16px',
										py: '8px'
									}}
								>
									<Typography
										sx={{
											color: '#4C555F',
											fontSize: '12px',
											lineHeight: '14px'
										}}
									>
										{t(
											`anonymousChat.noAvailability.weekdays.${entry.dayKey}`,
											entry.day
										)}
									</Typography>
									<Typography
										sx={{
											color: '#4C555F',
											fontSize: '12px',
											lineHeight: '14px'
										}}
									>
										{entry.time}
									</Typography>
								</Box>
							))}
					</Box>

					<Typography variant="body1" sx={{ mb: '8px' }}>
						{t(
							'anonymousChat.noAvailability.mailHint',
							'Oder starten Sie jederzeit die anonyme Mail-Beratung: Mit Ihrer Postleitzahl finden Sie eine Beratungsstelle in Ihrer Nähe und schreiben Ihre Anfrage. Für die Antwort brauchen Sie nur eine E-Mail-Adresse - keinen echten Namen.'
						)}
					</Typography>

					<Typography
						variant="body2"
						sx={{ fontWeight: 700, mb: '16px' }}
					>
						{t(
							'anonymousChat.noAvailability.tip',
							'Tipp: Nutzen Sie eine E-Mail-Adresse, auf die nur Sie Zugriff haben.'
						)}
					</Typography>

					<Button
						fullWidth
						variant="contained"
						onClick={() => history.push('/registration')}
						sx={{
							mb: '8px',
							borderRadius: '999px',
							py: '14px',
							backgroundColor: '#A5000A'
						}}
						startIcon={<NorthEastIcon />}
					>
						{t(
							'anonymousChat.noAvailability.startMailCounseling',
							'anonyme Mail-Beratung starten'
						)}
					</Button>

					<Typography
						variant="body2"
						sx={{
							textAlign: 'center',
							color: '#4C555F',
							fontWeight: 600,
							mb: '16px'
						}}
					>
						{t(
							'anonymousChat.noAvailability.responseTime',
							'Antwort innerhalb von 2 Werktagen'
						)}
					</Typography>

					<Box sx={{ display: 'flex', gap: '10px' }}>
						<Button
							fullWidth
							variant="outlined"
							onClick={() => {
								setNoAvailabilityModalOpen(false);
								onBack();
							}}
							startIcon={<ArrowBackIcon />}
							sx={{
								borderRadius: '24px',
								borderColor: 'transparent',
								backgroundColor: '#F0EDEE',
								color: '#4C555F'
							}}
						>
							{t(
								'anonymousChat.noAvailability.back',
								'Zurück zur vorherigen Seite'
							)}
						</Button>
						<Button
							fullWidth
							variant="outlined"
							onClick={() => setNoAvailabilityModalOpen(false)}
							startIcon={<CloseIcon />}
							sx={{
								borderRadius: '8px',
								borderColor: '#FFE2DE',
								backgroundColor: '#FFE2DE',
								color: '#A5000A'
							}}
						>
							{t(
								'anonymousChat.noAvailability.later',
								'Später wiederkommen'
							)}
						</Button>
					</Box>

					{noAvailabilityModalTopic?.name && (
						<Typography
							variant="caption"
							sx={{ mt: '12px', display: 'block', opacity: 0.7 }}
						>
							{t(
								'anonymousChat.noAvailability.topicLabel',
								'Angefragtes Thema: {{topic}}',
								{ topic: noAvailabilityModalTopic.name }
							)}
						</Typography>
					)}
				</Box>
			</Dialog>
		</StageLayout>
	);
};
