# Storybook accessibility baseline — issue 1338

Local Chrome, Node 22.12.0, Storybook 10.5.7; based on `dev` commit `31dac29b`, with the axe annotation fix applied. This is not CI or deployment evidence.

| Shard   | Tests | Passed | Failed | Pending |
| ------- | ----: | -----: | -----: | ------: |
| shard-1 |   309 |    216 |     93 |       0 |
| shard-2 |   285 |    249 |     36 |       0 |
| shard-3 |   285 |    193 |     92 |       0 |
| shard-4 |   244 |    186 |     58 |       0 |

All 1,123 tests in 198 files ran: 844 passed and 279 failed. All 279 failures contain axe violation output; 60 files are affected. No stories were skipped.

Failures below are newly observed with enforcement enabled, not fixes delivered by this change. A test may violate multiple rules.

| Rule                          | Failing tests containing the rule |
| ----------------------------- | --------------------------------: |
| `color-contrast`              |                               131 |
| `aria-input-field-name`       |                                76 |
| `duplicate-id`                |                                69 |
| `aria-required-parent`        |                                42 |
| `aria-required-children`      |                                29 |
| `nested-interactive`          |                                27 |
| `scrollable-region-focusable` |                                20 |
| `target-size`                 |                                19 |
| `aria-allowed-attr`           |                                13 |
| `button-name`                 |                                 6 |
| `link-in-text-block`          |                                 3 |
| `duplicate-id-active`         |                                 1 |
| `duplicate-id-aria`           |                                 1 |
| `link-name`                   |                                 1 |
| `aria-valid-attr-value`       |                                 1 |

The browser Accessibility panel was also checked locally for `Atoms/Box → Info`: `color-contrast`, measured 1.96:1 against 4.5:1 required, matching the headless failure.

| File                                                                                      | Failed stories | Rules                                                                                                                 |
| ----------------------------------------------------------------------------------------- | -------------: | --------------------------------------------------------------------------------------------------------------------- |
| `src/components/anonymousChat/liveChatEntryRoom.stories.tsx`                              |              7 | scrollable-region-focusable, target-size                                                                              |
| `src/components/app/AppOrisoConsultantChatSurface.stories.tsx`                            |              2 | aria-input-field-name, aria-required-children, aria-required-parent, color-contrast, nested-interactive               |
| `src/components/app/NavigationSidebar.stories.tsx`                                        |              5 | aria-required-children, nested-interactive                                                                            |
| `src/components/appointmentBooking/appointmentBooking.stories.tsx`                        |              2 | aria-required-children                                                                                                |
| `src/components/box/Box.stories.tsx`                                                      |              3 | color-contrast                                                                                                        |
| `src/components/buttonGroup/ButtonGroup.stories.tsx`                                      |              1 | duplicate-id-active                                                                                                   |
| `src/components/call/GroupCallWidget.stories.tsx`                                         |              1 | color-contrast                                                                                                        |
| `src/components/chatMenuDropdown/ChatMenuDropdown.stories.tsx`                            |              4 | duplicate-id                                                                                                          |
| `src/components/chatStage/ChannelMenu.stories.tsx`                                        |              4 | duplicate-id                                                                                                          |
| `src/components/chatStage/ChannelSwitcherFab.stories.tsx`                                 |              2 | duplicate-id                                                                                                          |
| `src/components/chatStage/ChatStage.stories.tsx`                                          |             27 | aria-input-field-name, aria-required-children, aria-required-parent, color-contrast, duplicate-id, nested-interactive |
| `src/components/chatStage/SidePanel.stories.tsx`                                          |             11 | aria-input-field-name, color-contrast, duplicate-id, scrollable-region-focusable                                      |
| `src/components/chatStage/TeamChannel.stories.tsx`                                        |              9 | aria-input-field-name, aria-required-children, aria-required-parent, color-contrast, duplicate-id, nested-interactive |
| `src/components/conversationCreate/ConversationCreate.stories.tsx`                        |              3 | aria-input-field-name, duplicate-id                                                                                   |
| `src/components/conversationCreate/ConversationCreateScreens.stories.tsx`                 |              3 | duplicate-id, duplicate-id-aria                                                                                       |
| `src/components/dpaSign/DpaSign.stories.tsx`                                              |              2 | color-contrast                                                                                                        |
| `src/components/editableData/EditableData.stories.ts`                                     |              3 | duplicate-id                                                                                                          |
| `src/components/erstantwort/ErstantwortSequence.stories.tsx`                              |              2 | aria-allowed-attr                                                                                                     |
| `src/components/form/OrisoDateTimeControls.stories.tsx`                                   |              3 | aria-required-children, color-contrast                                                                                |
| `src/components/form/OrisoFormControls.stories.tsx`                                       |              2 | color-contrast, nested-interactive                                                                                    |
| `src/components/form/OrisoTextField.stories.tsx`                                          |              1 | color-contrast                                                                                                        |
| `src/components/groupChat/groupInfoGallery.stories.tsx`                                   |              3 | scrollable-region-focusable, target-size                                                                              |
| `src/components/groupChat/waitingClock/WaitingAreaCountdown.stories.tsx`                  |              1 | color-contrast                                                                                                        |
| `src/components/legalContent/LegalTextReader.stories.tsx`                                 |              3 | color-contrast                                                                                                        |
| `src/components/login/LoginSecurityExplainer.stories.tsx`                                 |              2 | color-contrast, link-in-text-block                                                                                    |
| `src/components/login/loginRedesign.stories.tsx`                                          |              2 | color-contrast, duplicate-id, link-in-text-block                                                                      |
| `src/components/message/FailedSendTimelineEntry.stories.tsx`                              |              5 | color-contrast                                                                                                        |
| `src/components/message/MessageDateDivider.stories.tsx`                                   |              3 | color-contrast                                                                                                        |
| `src/components/message/MessageItemComponent.stories.tsx`                                 |             36 | color-contrast                                                                                                        |
| `src/components/message/callTimelineEvent.stories.tsx`                                    |              4 | color-contrast, duplicate-id                                                                                          |
| `src/components/messageSubmitInterface/MessageSubmitInterface.stories.tsx`                |             18 | aria-input-field-name                                                                                                 |
| `src/components/messageSubmitInterface/inputField/EmojiPickerPopup.stories.tsx`           |              1 | aria-valid-attr-value                                                                                                 |
| `src/components/messageSubmitInterface/inputField/extensions/InsertionMarker.stories.tsx` |              3 | aria-input-field-name                                                                                                 |
| `src/components/messageSubmitInterface/inputField/extensions/MentionList.stories.tsx`     |              5 | aria-input-field-name, aria-required-children, color-contrast                                                         |
| `src/components/notificationsCenter/NotificationsCenter.stories.tsx`                      |              3 | color-contrast, duplicate-id                                                                                          |
| `src/components/passwordResetRequest/SetNewPassword.stories.tsx`                          |              1 | duplicate-id                                                                                                          |
| `src/components/profile/EncryptionSettings/EncryptionSettings.stories.tsx`                |              4 | color-contrast                                                                                                        |
| `src/components/progressbar/ProgressBar.stories.ts`                                       |              1 | color-contrast                                                                                                        |
| `src/components/pseudonym/BotMessageAnimation.stories.tsx`                                |              4 | aria-allowed-attr                                                                                                     |
| `src/components/pseudonym/CarimatCards.stories.tsx`                                       |              2 | aria-allowed-attr                                                                                                     |
| `src/components/registration/RegistrationFlowSurface.stories.tsx`                         |              1 |                                                                                                                       |
| `src/components/registration/accountData/accountData.stories.ts`                          |              1 |                                                                                                                       |
| `src/components/registration/registrationTurn8.stories.tsx`                               |              4 | scrollable-region-focusable, target-size                                                                              |
| `src/components/registration/topicSelection/topicSelection.stories.ts`                    |              1 | nested-interactive                                                                                                    |
| `src/components/select/LanguageSelectDropdown.stories.ts`                                 |              4 |                                                                                                                       |
| `src/components/session/CaseHandoverCurtain.stories.tsx`                                  |              1 | color-contrast                                                                                                        |
| `src/components/session/MessageTimeline.stories.tsx`                                      |              6 | color-contrast, duplicate-id                                                                                          |
| `src/components/sessionHeader/MemberAvatarStack.stories.tsx`                              |              4 | button-name                                                                                                           |
| `src/components/sessionHeader/SessionHeader.stories.tsx`                                  |             10 | button-name, color-contrast, duplicate-id, link-name                                                                  |
| `src/components/sessionMenu/SessionMenu.stories.tsx`                                      |              2 | color-contrast, duplicate-id                                                                                          |
| `src/components/sessionsList/ResizableHandle.stories.tsx`                                 |              6 | scrollable-region-focusable                                                                                           |
| `src/components/sessionsList/SessionListColumn.stories.tsx`                               |              2 | color-contrast, duplicate-id                                                                                          |
| `src/components/sessionsList/SessionRailPill.stories.tsx`                                 |              4 | duplicate-id                                                                                                          |
| `src/components/sessionsList/SessionSearchPanel.stories.tsx`                              |             10 | aria-required-children                                                                                                |
| `src/components/sessionsList/SessionsListToolbar.stories.tsx`                             |              1 | aria-required-children                                                                                                |
| `src/components/sessionsListItem/CaseHandoverActionButton.stories.tsx`                    |              5 | aria-allowed-attr                                                                                                     |
| `src/components/sessionsListItem/SessionListItem.stories.tsx`                             |             10 | aria-required-parent, color-contrast, duplicate-id, nested-interactive                                                |
| `src/components/tag/Tag.stories.ts`                                                       |              1 | color-contrast                                                                                                        |
| `src/components/teamDiscussion/TeamDiscussionPanel.stories.tsx`                           |              3 | color-contrast                                                                                                        |
| `src/components/voicePlayer/VoicePlayer.stories.tsx`                                      |              5 | target-size                                                                                                           |
