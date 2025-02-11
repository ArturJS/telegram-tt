import { ChangeEvent } from 'react';
import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiChat, ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { pick } from '../../../util/iteratees';
import { selectChat, selectUser } from '../../../modules/selectors';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import ConfirmDialog from '../../ui/ConfirmDialog';

import './Management.scss';

type OwnProps = {
  userId: number;
};

type StateProps = {
  user?: ApiUser;
  chat: ApiChat;
  progress?: ManagementProgress;
};

type DispatchProps = Pick<GlobalActions, (
  'updateContact' | 'deleteUser' | 'deleteHistory' | 'closeManagement' | 'openChat'
)>;

const ERROR_FIRST_NAME_MISSING = 'Please provide first name';

const ManageUser: FC<OwnProps & StateProps & DispatchProps> = ({
  userId,
  user,
  chat,
  progress,
  updateContact,
  deleteUser,
  deleteHistory,
  closeManagement,
  openChat,
}) => {
  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const lang = useLang();

  const currentFirstName = user ? (user.firstName || '') : '';
  const currentLastName = user ? (user.lastName || '') : '';
  const currentIsMuted = chat ? chat.isMuted : undefined;

  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(!currentIsMuted);

  useEffect(() => {
    setIsNotificationsEnabled(!currentIsMuted);
  }, [currentIsMuted]);

  useEffect(() => {
    setIsProfileFieldsTouched(false);
    closeDeleteDialog();
  }, [closeDeleteDialog, userId]);

  useEffect(() => {
    setFirstName(currentFirstName);
    setLastName(currentLastName);
  }, [currentFirstName, currentLastName, user]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setError(undefined);
      closeDeleteDialog();
    }
  }, [closeDeleteDialog, progress]);

  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleLastNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleNotificationChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsNotificationsEnabled(e.target.checked);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleProfileSave = useCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName.length) {
      setError(ERROR_FIRST_NAME_MISSING);
    }

    updateContact({
      userId,
      isMuted: !isNotificationsEnabled,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
    });
  }, [firstName, lastName, updateContact, userId, isNotificationsEnabled]);

  const handleDeleteContact = useCallback(() => {
    if (chat.lastMessage) {
      deleteHistory({
        chatId: chat.id,
        maxId: chat.lastMessage!.id,
        shouldDeleteForAll: false,
      });
    }
    deleteUser({ userId });
    closeDeleteDialog();
    closeManagement();
    openChat({ id: undefined });
  }, [chat.id, chat.lastMessage, closeDeleteDialog, closeManagement, deleteHistory, deleteUser, openChat, userId]);

  if (!user) {
    return undefined;
  }

  const isLoading = progress === ManagementProgress.InProgress;

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <PrivateChatInfo
            userId={user.id}
            avatarSize="jumbo"
            status="original name"
            withMediaViewer
            withFullInfo
          />
          <InputText
            id="user-first-name"
            label={lang('UserInfo.FirstNamePlaceholder')}
            onChange={handleFirstNameChange}
            value={firstName}
            error={error === ERROR_FIRST_NAME_MISSING ? error : undefined}
          />
          <InputText
            id="user-last-name"
            label={lang('UserInfo.LastNamePlaceholder')}
            onChange={handleLastNameChange}
            value={lastName}
          />
          <div className="ListItem no-selection narrow">
            <Checkbox
              checked={isNotificationsEnabled}
              label={lang('Notifications')}
              subLabel={lang(isNotificationsEnabled
                ? 'UserInfo.NotificationsEnabled'
                : 'UserInfo.NotificationsDisabled')}
              onChange={handleNotificationChange}
            />
          </div>
        </div>
        <div className="section">
          <ListItem icon="delete" ripple destructive onClick={openDeleteDialog}>
            {lang('DeleteContact')}
          </ListItem>
        </div>
      </div>
      <FloatingActionButton
        isShown={isProfileFieldsTouched}
        onClick={handleProfileSave}
        disabled={isLoading}
        ariaLabel={lang('Save')}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-check" />
        )}
      </FloatingActionButton>
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        text={lang('AreYouSureDeleteContact')}
        confirmLabel={lang('DeleteContact')}
        confirmHandler={handleDeleteContact}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const user = selectUser(global, userId);
    const chat = selectChat(global, userId)!;
    const { progress } = global.management;

    return { user, chat, progress };
  },
  (global, actions): DispatchProps => pick(actions, [
    'updateContact', 'deleteUser', 'closeManagement', 'openChat', 'deleteHistory',
  ]),
)(ManageUser));
