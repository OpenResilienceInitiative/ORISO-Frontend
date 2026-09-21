import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import {
	Autocomplete,
	Avatar,
	Box,
	ClickAwayListener,
	IconButton,
	InputAdornment,
	ListItemAvatar,
	ListItemText,
	TextField
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from 'react-i18next';
import {
	TopicSearchIndex,
	TopicSearchResult,
	normalizeSearchText,
	searchTopics
} from './topicSearchEngine';

export interface RegistrationTopicSearchEntry {
	topicId: number;
	title: string;
	category?: string;
	icon?: string;
}

export interface RegistrationTopicSearchProps {
	entries: RegistrationTopicSearchEntry[];
	index: TopicSearchIndex;
	onSelect: (topicId: number) => void;
	/** `surface`: desktop header row. `onPrimary`: red mobile bar. */
	tone?: 'surface' | 'onPrimary';
	/** Stories only: start opened. */
	defaultOpen?: boolean;
	defaultQuery?: string;
}

type Suggestion = TopicSearchResult & RegistrationTopicSearchEntry;

const MIN_QUERY_LENGTH = 2;

// Show the matched term unless the visible title already explains the hit.
const showsMatchedTerm = (option: Suggestion) =>
	option.matchedKind !== 'title' ||
	normalizeSearchText(option.matchedTerm) !==
		normalizeSearchText(option.title);

/** Header topic search; a pick selects the topic as a row click would. */
export const RegistrationTopicSearch = ({
	entries,
	index,
	onSelect,
	tone = 'surface',
	defaultOpen = false,
	defaultQuery = ''
}: RegistrationTopicSearchProps) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(defaultOpen);
	const [query, setQuery] = useState(defaultQuery);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const onPrimary = tone === 'onPrimary';

	const entryById = useMemo(
		() => new Map(entries.map((entry) => [entry.topicId, entry])),
		[entries]
	);
	const suggestions = useMemo<Suggestion[]>(
		() =>
			searchTopics(index, query)
				.filter(({ topicId }) => entryById.has(topicId))
				.map((result) => ({
					...entryById.get(result.topicId)!,
					...result
				})),
		[entryById, index, query]
	);

	const close = (restoreFocus = true) => {
		setOpen(false);
		setQuery('');
		if (restoreFocus) {
			window.setTimeout(() => buttonRef.current?.focus(), 0);
		}
	};

	if (!open) {
		return (
			<IconButton
				ref={buttonRef}
				className="registrationTopicSearch__open"
				data-cy="registration-topic-search-open"
				aria-label={t('registration.topic.search.open')}
				onClick={() => setOpen(true)}
				sx={
					onPrimary
						? {
								'width': 34,
								'height': 34,
								'color': 'var(--m3-on-primary, #fff)',
								'backgroundColor': 'rgba(255, 255, 255, 0.14)',
								'&:hover': {
									backgroundColor: 'rgba(255, 255, 255, 0.24)'
								}
							}
						: {
								'width': 48,
								'height': 48,
								'color': 'var(--m3-on-surface, #1b1b1c)',
								'border':
									'1px solid var(--m3-outline-variant, #c4c7c8)',
								'backgroundColor': 'rgba(255, 255, 255, 0.92)',
								'&:hover': {
									color: 'var(--m3-on-secondary, #fff)',
									borderColor: 'var(--m3-secondary, #4c555f)',
									backgroundColor:
										'var(--m3-secondary, #4c555f)'
								}
							}
				}
			>
				<SearchRoundedIcon fontSize={onPrimary ? 'small' : 'medium'} />
			</IconButton>
		);
	}

	return (
		<ClickAwayListener
			// On the phone the open field covers language + login. Focus stays
			// on whatever was clicked.
			onClickAway={() => close(false)}
		>
			<Box
				className="registrationTopicSearch"
				data-cy="registration-topic-search"
				sx={{
					'@keyframes registrationTopicSearchGrow': {
						from: { width: onPrimary ? 34 : 48, opacity: 0.4 },
						to: { opacity: 1 }
					},
					'animation': 'registrationTopicSearchGrow 220ms ease-out',
					'@media (prefers-reduced-motion: reduce)': {
						animation: 'none'
					},
					...(onPrimary
						? {
								position: 'absolute',
								top: 8,
								left: 12,
								right: 12,
								zIndex: 5
							}
						: {
								width: 'clamp(260px, 26vw, 400px)'
							})
				}}
			>
				<Autocomplete<Suggestion, false, true, false>
					open={query.trim().length >= MIN_QUERY_LENGTH}
					options={suggestions}
					filterOptions={(options) => options}
					getOptionLabel={(option) => option.title}
					isOptionEqualToValue={(a, b) => a.topicId === b.topicId}
					value={null}
					inputValue={query}
					onInputChange={(_, value, reason) => {
						if (reason !== 'reset') setQuery(value);
					}}
					onChange={(_, option) => {
						if (!option) return;
						onSelect(option.topicId);
						close();
					}}
					autoHighlight
					forcePopupIcon={false}
					disableClearable
					noOptionsText={t('registration.topic.search.noResults')}
					slotProps={{
						popper: onPrimary
							? {
									// Match the open field's width across the bar.
									placement: 'bottom-start',
									sx: {
										width: 'calc(100vw - 24px) !important',
										zIndex: 1400
									}
								}
							: {
									placement: 'bottom-end',
									sx: { minWidth: 320, zIndex: 1400 }
								},
						paper: {
							sx: {
								mt: 1,
								borderRadius: '16px',
								boxShadow: '0 8px 28px rgba(0, 0, 0, 0.16)'
							}
						}
					}}
					renderOption={({ key, ...props }, option) => (
						<Box
							component="li"
							key={key}
							{...props}
							sx={{ gap: 0.5, py: '8px !important' }}
						>
							<ListItemAvatar sx={{ minWidth: 48 }}>
								<Avatar
									src={option.icon}
									variant="rounded"
									alt=""
									sx={{
										width: 36,
										height: 36,
										borderRadius: '10px',
										bgcolor:
											'var(--m3-surface-container, #f1eded)'
									}}
								/>
							</ListItemAvatar>
							<ListItemText
								primary={option.title}
								secondary={[
									option.category,
									showsMatchedTerm(option)
										? t(
												'registration.topic.search.matchedBy',
												{
													term: option.matchedTerm
												}
											)
										: undefined
								]
									.filter(Boolean)
									.join(' · ')}
								primaryTypographyProps={{ fontWeight: 600 }}
								secondaryTypographyProps={{ fontSize: 13 }}
							/>
						</Box>
					)}
					renderInput={(params) => (
						<TextField
							{...params}
							autoFocus
							placeholder={t(
								'registration.topic.search.placeholder'
							)}
							inputProps={{
								...params.inputProps,
								'aria-label': t(
									'registration.topic.search.open'
								),
								'data-cy': 'registration-topic-search-input'
							}}
							onKeyDown={(event) => {
								if (event.key === 'Escape') close();
							}}
							InputProps={{
								...params.InputProps,
								startAdornment: (
									<InputAdornment
										position="start"
										sx={{ ml: 0.5 }}
									>
										<SearchRoundedIcon
											sx={{
												'color':
													'var(--m3-on-surface, #1b1b1c)',
												// Theme hover paints IconButtons white.
												'&:hover': {
													color: 'var(--m3-on-surface, #1b1b1c)',
													backgroundColor:
														'rgba(0, 0, 0, 0.06)'
												}
											}}
										/>
									</InputAdornment>
								),
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											size="small"
											sx={{
												'color':
													'var(--m3-on-surface, #1b1b1c)',
												// Theme hover paints IconButtons white.
												'&:hover': {
													color: 'var(--m3-on-surface, #1b1b1c)',
													backgroundColor:
														'rgba(0, 0, 0, 0.06)'
												}
											}}
											aria-label={t(
												'registration.topic.search.close'
											)}
											onClick={() => close()}
										>
											<CloseRoundedIcon fontSize="small" />
										</IconButton>
									</InputAdornment>
								)
							}}
							sx={{
								'& .MuiOutlinedInput-root': {
									height: onPrimary ? 44 : 48,
									borderRadius: '999px',
									backgroundColor:
										'var(--m3-surface-container-lowest, #fff)',
									pr: '6px !important'
								},
								'& .MuiOutlinedInput-notchedOutline': {
									borderColor:
										'var(--m3-outline-variant, #c4c7c8)'
								}
							}}
						/>
					)}
				/>
			</Box>
		</ClickAwayListener>
	);
};
