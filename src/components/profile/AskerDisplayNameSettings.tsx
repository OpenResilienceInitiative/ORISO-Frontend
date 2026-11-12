import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR,
	UserDataContext,
	useTenant
} from '../../globalState';
import { ListItemInterface } from '../../globalState/interfaces';
import { apiGetAskerSessionList } from '../../api/apiGetAskerSessionList';
import { apiPutSessionData } from '../../api/apiPutSessionData';
import { getModalityIfKnown } from '../session/getModality';
import { isAskerDisplayNameTypingAllowed } from '../../utils/askerAccountPolicy';
import { PenIcon } from '../../resources/img/icons';
import { Button, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';

interface ConversationName {
	id: number;
	label?: string;
	agencyName?: string;
	displayName?: string;
	editable: boolean;
}

/**
 * An asker's display name lives per conversation (session data
 * `displayName`), not on the account (#2175). Show the username and the name
 * each counsellor sees, and let the asker change it where the tenant allows.
 */
export const AskerDisplayNameSettings = () => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const tenant = useTenant();
	const [conversations, setConversations] = useState<ConversationName[]>([]);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [draft, setDraft] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		let active = true;
		apiGetAskerSessionList({ fresh: true })
			.then((response) => {
				if (!active) return;
				const items: ListItemInterface[] = response?.sessions ?? [];
				setConversations(
					items
						.filter((item) => item.session?.id && !item.chat)
						.map((item) => ({
							id: item.session.id,
							label:
								item.session.topic?.name || item.agency?.name,
							agencyName: item.session.topic?.name
								? item.agency?.name
								: undefined,
							displayName: item.user?.displayName || undefined,
							editable: isAskerDisplayNameTypingAllowed(
								tenant?.settings,
								getModalityIfKnown(item)
							)
						}))
				);
			})
			.catch(() => {
				/* The list endpoint already resolves failures to an empty list. */
			});
		return () => {
			active = false;
		};
	}, [tenant?.settings]);

	const startEdit = (conversation: ConversationName) => {
		setEditingId(conversation.id);
		setDraft(conversation.displayName ?? '');
	};

	const save = (id: number) => {
		const name = draft.trim();
		if (!name || isSaving) return;
		setIsSaving(true);
		apiPutSessionData(id, { displayName: name })
			.then(() => {
				setConversations((previous) =>
					previous.map((conversation) =>
						conversation.id === id
							? { ...conversation, displayName: name }
							: conversation
					)
				);
				setEditingId(null);
			})
			.catch(() => {
				addNotification({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: translate('profile.notifications.error.title'),
					text: translate('profile.notifications.error.description'),
					closeable: true,
					timeout: 60000
				});
			})
			.finally(() => setIsSaving(false));
	};

	return (
		<div className="displayNameSettings askerDisplayNameSettings">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.data.displayName')}
					semanticLevel="3"
					styleLevel="5"
				/>
				<Text
					text={translate('profile.askerDisplayName.description')}
					type="standard"
					className="tertiary"
				/>
			</div>
			<dl className="askerDisplayNameSettings__username">
				<dt>{translate('profile.data.userName')}</dt>
				<dd>{userData?.userName}</dd>
			</dl>
			<ul className="askerDisplayNameSettings__list">
				{conversations.map((conversation) => {
					const label =
						conversation.label ||
						translate('profile.askerDisplayName.conversation');
					return (
						<li key={conversation.id}>
							<span className="askerDisplayNameSettings__topic">
								{label}
								{conversation.agencyName && (
									<span className="askerDisplayNameSettings__agency tertiary">
										{conversation.agencyName}
									</span>
								)}
							</span>
							{editingId === conversation.id ? (
								<span className="askerDisplayNameSettings__edit">
									<input
										type="text"
										className="input"
										value={draft}
										maxLength={255}
										autoComplete="off"
										data-1p-ignore="true"
										data-lpignore="true"
										aria-label={translate(
											'profile.askerDisplayName.inputLabel',
											{ name: label }
										)}
										disabled={isSaving}
										onChange={(event) =>
											setDraft(event.target.value)
										}
									/>
									<Button
										item={{
											label: translate(
												'profile.data.edit.button.cancel'
											),
											type: BUTTON_TYPES.LINK
										}}
										disabled={isSaving}
										buttonHandle={() => setEditingId(null)}
									/>
									<Button
										item={{
											label: translate(
												'profile.data.edit.button.save'
											),
											type: BUTTON_TYPES.LINK
										}}
										disabled={isSaving || !draft.trim()}
										buttonHandle={() =>
											save(conversation.id)
										}
									/>
								</span>
							) : (
								<span className="askerDisplayNameSettings__name">
									{conversation.displayName ? (
										<strong>
											{conversation.displayName}
										</strong>
									) : (
										<span className="tertiary">
											{translate(
												'profile.askerDisplayName.usernameShown'
											)}
										</span>
									)}
									{conversation.editable && (
										<button
											type="button"
											className="button-as-link tertiary"
											onClick={() =>
												startEdit(conversation)
											}
											aria-label={translate(
												'profile.askerDisplayName.edit',
												{ name: label }
											)}
										>
											<PenIcon />
										</button>
									)}
								</span>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
};
