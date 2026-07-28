import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as GroupChatAvatarIcon } from '../../../resources/img/icons/group-chat-avatar.svg';
import { ReactComponent as TeamIllustration } from '../../../resources/img/illustrations/Team.svg';
import { OrisoTextField } from '../../form/OrisoTextField';
import { OrisoSelect } from '../../form/OrisoSelect';
import {
	isGroupChatTopicLengthValid,
	TOPIC_LENGTHS
} from '../../groupChat/createChatHelpers';
import { FormatCard } from '../FormatCard';
import { M3SplitButton } from '../M3SplitButton';
import { PersonChipGrid } from './PersonChipGrid';
import { PersonOption, PersonSelectMenu } from './PersonSelectMenu';

/**
 * "Interna besprechen" create card (Figma node 8480-27986). The whole
 * internal group chat is created inside this card — no follow-up screen:
 *
 * 1. default: full-colour media, outlined split button, disabled create
 * 2. ≥1 person: media dims, split button turns primary and counts
 * 3. menu open: person list with selected / selectable / vacated rows
 * 4. several people: chips split the media rows evenly, labels truncate
 * 5. name + people: focused MUI name field, create button enabled
 */

export interface InternalChatPerson {
	id: string;
	label: string;
	/** No longer part of the agency — stays listed until deselected. */
	vacated?: boolean;
}

export interface InternalChatDraft {
	name: string;
	selectedIds: string[];
}

interface InternalChatCreateCardProps {
	people: InternalChatPerson[];
	draft: InternalChatDraft;
	onDraftChange: (draft: InternalChatDraft) => void;
	onCreate: () => void;
	isSubmitting?: boolean;
	agencyOptions?: { value: string; label: string }[];
	selectedAgency?: string;
	onAgencyChange?: (value: string) => void;
}

const PersonAddIcon = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M15 12C17.21 12 19 10.21 19 8C19 5.79 17.21 4 15 4C12.79 4 11 5.79 11 8C11 10.21 12.79 12 15 12ZM15 6C16.1 6 17 6.9 17 8C17 9.1 16.1 10 15 10C13.9 10 13 9.1 13 8C13 6.9 13.9 6 15 6ZM15 14C12.33 14 7 15.34 7 18V20H23V18C23 15.34 17.67 14 15 14ZM9 18C9.22 17.28 12.31 16 15 16C17.7 16 20.8 17.29 21 18H9ZM6 15V12H9V10H6V7H4V10H1V12H4V15H6Z"
			fill="currentColor"
		/>
	</svg>
);

const PlusIcon = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M11 13H5V11H11V5H13V11H19V13H13V19H11V13Z"
			fill="currentColor"
		/>
	</svg>
);

export const InternalChatCreateCard = ({
	people,
	draft,
	onDraftChange,
	onCreate,
	isSubmitting = false,
	agencyOptions,
	selectedAgency,
	onAgencyChange
}: InternalChatCreateCardProps) => {
	const { t: translate } = useTranslation();
	const [menuOpen, setMenuOpen] = useState(false);
	const splitButtonRef = useRef<HTMLDivElement | null>(null);

	const { name, selectedIds } = draft;
	const selectedCount = selectedIds.length;
	const isNameValid = isGroupChatTopicLengthValid(name);
	const isReady = isNameValid && selectedCount > 0 && !isSubmitting;

	const peopleById = useMemo(
		() => new Map(people.map((person) => [person.id, person])),
		[people]
	);

	// Selected people that are no longer in the agency list stay visible as
	// vacated rows until the counsellor removes them (Figma annotation).
	const menuOptions = useMemo<PersonOption[]>(() => {
		const vacatedSelected = selectedIds
			.filter((id) => !peopleById.has(id))
			.map((id) => ({
				id,
				label: id,
				selected: true,
				vacated: true
			}));
		const regular = people.map((person) => ({
			id: person.id,
			label: person.label,
			selected: selectedIds.includes(person.id),
			vacated: person.vacated
		}));
		return [...vacatedSelected, ...regular];
	}, [people, peopleById, selectedIds]);

	const chipEntries = useMemo(
		() =>
			selectedIds.map((id) => ({
				id,
				label: peopleById.get(id)?.label ?? id
			})),
		[peopleById, selectedIds]
	);

	const toggle = (id: string) =>
		onDraftChange({
			...draft,
			selectedIds: selectedIds.includes(id)
				? selectedIds.filter((selectedId) => selectedId !== id)
				: [...selectedIds, id]
		});

	const splitButtonLabel =
		selectedCount > 0
			? translate('groupChat.internal.personCount', {
					count: selectedCount
				})
			: translate('groupChat.internal.addPerson');

	return (
		<FormatCard
			className="internalChatCreateCard"
			title={translate('groupChat.internal.title')}
			subtitle={translate('groupChat.internal.subtitle')}
			avatar={<GroupChatAvatarIcon />}
			media={<TeamIllustration />}
			mediaDimmed={selectedCount > 0}
			mediaOverlay={
				<PersonChipGrid
					entries={chipEntries}
					onRemove={toggle}
					removeLabel={(label) =>
						translate('groupChat.internal.removePerson', {
							name: label
						})
					}
				/>
			}
		>
			{agencyOptions && agencyOptions.length > 1 && onAgencyChange && (
				<OrisoSelect
					id="internalChatAgency"
					label={translate('groupChat.create.agencySelect.label')}
					options={agencyOptions}
					value={selectedAgency || ''}
					onChange={(event) => onAgencyChange(event.target.value)}
				/>
			)}
			<OrisoTextField
				id="internalChatName"
				label={translate('groupChat.internal.nameLabel')}
				value={name}
				fullWidth
				inputProps={{ maxLength: TOPIC_LENGTHS.MAX }}
				error={name.length > 0 && !isNameValid}
				helperText={
					name.length > 0 && !isNameValid
						? name.trim().length < TOPIC_LENGTHS.MIN
							? translate(
									'groupChat.create.topicInput.warning.short'
								)
							: translate(
									'groupChat.create.topicInput.warning.long'
								)
						: undefined
				}
				onChange={(event) =>
					onDraftChange({ ...draft, name: event.target.value })
				}
			/>
			<p className="internalChatCreateCard__supportText">
				{translate('groupChat.internal.supportText')}
			</p>
			<div className="internalChatCreateCard__actions">
				<div className="internalChatCreateCard__splitButtonWrap">
					<M3SplitButton
						ref={splitButtonRef}
						id="internalChatPersonButton"
						label={splitButtonLabel}
						leadingIcon={<PersonAddIcon />}
						selected={selectedCount > 0}
						open={menuOpen}
						onLeadingClick={() => setMenuOpen((prev) => !prev)}
						onTrailingClick={() => setMenuOpen((prev) => !prev)}
						trailingAriaLabel={translate(
							'groupChat.internal.togglePersonList'
						)}
					/>
					{menuOpen && (
						<PersonSelectMenu
							options={menuOptions}
							onToggle={toggle}
							anchorRef={splitButtonRef}
							onClose={() => setMenuOpen(false)}
							labelledBy="internalChatPersonButton"
							toggleLabel={(label, selected) =>
								translate(
									selected
										? 'groupChat.internal.deselectPerson'
										: 'groupChat.internal.selectPerson',
									{ name: label }
								)
							}
						/>
					)}
				</div>
				<button
					type="button"
					className="internalChatCreateCard__createButton"
					disabled={!isReady}
					onClick={onCreate}
					aria-label={translate('groupChat.internal.createLabel')}
				>
					<PlusIcon />
				</button>
			</div>
		</FormatCard>
	);
};
