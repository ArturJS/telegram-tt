import { ChangeEvent } from 'react';
import React, {
  FC, useState, useEffect, useCallback, useLayoutEffect, useRef, memo,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalState, GlobalActions } from '../../global/types';

import {
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
  CUSTOM_BG_CACHE_NAME,
  LANG_CACHE_NAME,
} from '../../config';
import { IS_TOUCH_ENV } from '../../util/environment';
import * as cacheApi from '../../util/cacheApi';
import { formatPhoneNumber, getCountryFromPhoneNumber, getCountryById } from '../../util/phoneNumber';
import preloadFonts from '../../util/fonts';
import { preloadImage } from '../../util/files';
import { pick } from '../../util/iteratees';

import Button from '../ui/Button';
import InputText from '../ui/InputText';
import CountryCodeInput from './CountryCodeInput';
import Checkbox from '../ui/Checkbox';
import Loading from '../ui/Loading';

// @ts-ignore
import monkeyPath from '../../assets/monkey.svg';

type StateProps = Pick<GlobalState, (
  'connectionState' | 'authState' |
  'authPhoneNumber' | 'authIsLoading' | 'authIsLoadingQrCode' | 'authError' | 'authRememberMe' | 'authNearestCountry'
)>;
type DispatchProps = Pick<GlobalActions, (
  'setAuthPhoneNumber' | 'setAuthRememberMe' | 'loadNearestCountry' | 'clearAuthError' | 'gotToAuthQrCode'
)>;

const MIN_NUMBER_LENGTH = 10;
// Cache clearing may be heavy so we delay it
const CLEAR_CACHE_DELAY = 2000;

let isPreloadInitiated = false;

const AuthPhoneNumber: FC<StateProps & DispatchProps> = ({
  connectionState,
  authState,
  authPhoneNumber,
  authIsLoading,
  authIsLoadingQrCode,
  authError,
  authRememberMe,
  authNearestCountry,
  setAuthPhoneNumber,
  setAuthRememberMe,
  loadNearestCountry,
  clearAuthError,
  gotToAuthQrCode,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const [country, setCountry] = useState<Country | undefined>();
  const [phoneNumber, setPhoneNumber] = useState<string>();
  const [isTouched, setIsTouched] = useState(false);
  const [lastSelection, setLastSelection] = useState<[number, number] | undefined>();

  const fullNumber = country ? `${country.code} ${phoneNumber || ''}` : phoneNumber;
  const canSubmit = fullNumber && fullNumber.replace(/[^\d]+/g, '').length >= MIN_NUMBER_LENGTH;

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      inputRef.current!.focus();
    }
  }, [country]);

  useEffect(() => {
    if (connectionState === 'connectionStateReady' && !authNearestCountry) {
      loadNearestCountry();
    }
  }, [connectionState, authNearestCountry, loadNearestCountry]);

  useEffect(() => {
    if (authNearestCountry && !country && !isTouched) {
      setCountry(getCountryById(authNearestCountry));
    }
  }, [country, authNearestCountry, isTouched]);

  const parseFullNumber = useCallback((newFullNumber: string) => {
    const suggestedCountry = getCountryFromPhoneNumber(newFullNumber);
    const selectedCountry = !country || (suggestedCountry && suggestedCountry.id !== country.id)
      ? suggestedCountry
      : country;

    if (!newFullNumber.length) {
      setCountry(undefined);
    } else if (!country || (selectedCountry && selectedCountry.code !== country.code)) {
      setCountry(selectedCountry);
    }

    setPhoneNumber(formatPhoneNumber(newFullNumber, selectedCountry));
  }, [country]);

  useEffect(() => {
    if (phoneNumber === undefined && authPhoneNumber) {
      parseFullNumber(authPhoneNumber);
    }
  }, [authPhoneNumber, phoneNumber, parseFullNumber]);

  useLayoutEffect(() => {
    if (inputRef.current && lastSelection) {
      inputRef.current.setSelectionRange(...lastSelection);
    }
  }, [lastSelection]);

  // Media cache storage is always enabled, so we clear it only when user by any chance returned to the auth page
  useEffect(() => {
    setTimeout(() => {
      cacheApi.clear(MEDIA_CACHE_NAME);
      cacheApi.clear(MEDIA_CACHE_NAME_AVATARS);
      cacheApi.clear(MEDIA_PROGRESSIVE_CACHE_NAME);
      cacheApi.clear(CUSTOM_BG_CACHE_NAME);
      cacheApi.clear(LANG_CACHE_NAME);
    }, CLEAR_CACHE_DELAY);
  }, []);

  const handlePhoneNumberChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (authError) {
      clearAuthError();
    }

    // This is for further screens. We delay it until user input to speed up the initial loading.
    if (!isPreloadInitiated) {
      isPreloadInitiated = true;
      preloadFonts();
      preloadImage(monkeyPath);
    }

    const { value, selectionStart, selectionEnd } = e.target;
    setLastSelection(
      selectionStart && selectionEnd && selectionEnd < value.length
        ? [selectionStart, selectionEnd]
        : undefined,
    );

    setIsTouched(true);
    parseFullNumber(value);
  }, [authError, clearAuthError, parseFullNumber]);

  const handleKeepSessionChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAuthRememberMe(e.target.checked);
  }, [setAuthRememberMe]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authIsLoading) {
      return;
    }

    if (canSubmit) {
      setAuthPhoneNumber({ phoneNumber: fullNumber });
    }
  }

  const isAuthReady = authState === 'authorizationStateWaitPhoneNumber';

  return (
    <div id="auth-phone-number-form" className="custom-scroll">
      <div className="auth-form">
        <div id="logo" />
        <div className="caption-image" />
        <p className="note">
          Please confirm your country and
          <br />enter your phone number.
        </p>
        <form action="" onSubmit={handleSubmit}>
          <CountryCodeInput
            id="sign-in-phone-code"
            value={country}
            isLoading={!authNearestCountry && !country}
            onChange={setCountry}
          />
          <InputText
            ref={inputRef}
            id="sign-in-phone-number"
            label="Phone Number"
            value={fullNumber}
            error={authError}
            inputMode="tel"
            onChange={handlePhoneNumberChange}
          />
          <Checkbox
            id="sign-in-keep-session"
            label="Keep me signed in"
            checked={Boolean(authRememberMe)}
            onChange={handleKeepSessionChange}
          />
          {canSubmit && (
            isAuthReady ? (
              <Button type="submit" ripple isLoading={authIsLoading}>Next</Button>
            ) : (
              <Loading />
            )
          )}
          {isAuthReady && (
            <Button isText ripple isLoading={authIsLoadingQrCode} onClick={gotToAuthQrCode}>
              Log in by QR code
            </Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, [
    'connectionState',
    'authState',
    'authPhoneNumber',
    'authIsLoading',
    'authIsLoadingQrCode',
    'authError',
    'authRememberMe',
    'authNearestCountry',
  ]),
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setAuthPhoneNumber',
    'setAuthRememberMe',
    'clearAuthError',
    'loadNearestCountry',
    'gotToAuthQrCode',
  ]),
)(AuthPhoneNumber));
