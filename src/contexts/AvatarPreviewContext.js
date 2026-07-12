import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AvatarPreviewModal } from '../components/AvatarPreviewModal';

const AvatarPreviewContext = createContext(null);

export function AvatarPreviewProvider({ children }) {
  const [state, setState] = useState({
    visible: false,
    uri: null,
    name: '',
    isOwnProfile: false,
    uploading: false,
    onChangePhoto: null,
  });

  const hideAvatarPreview = useCallback(() => {
    setState(prev => ({
      ...prev,
      visible: false,
      onChangePhoto: null,
    }));
  }, []);

  const showAvatarPreview = useCallback(({
    uri = null,
    name = '',
    isOwnProfile = false,
    uploading = false,
    onChangePhoto = null,
  } = {}) => {
    setState({
      visible: true,
      uri,
      name,
      isOwnProfile,
      uploading,
      onChangePhoto,
    });
  }, []);

  const value = useMemo(
    () => ({ showAvatarPreview, hideAvatarPreview }),
    [hideAvatarPreview, showAvatarPreview],
  );

  return (
    <AvatarPreviewContext.Provider value={value}>
      {children}
      <AvatarPreviewModal
        visible={state.visible}
        uri={state.uri}
        name={state.name}
        isOwnProfile={state.isOwnProfile}
        uploading={state.uploading}
        onClose={hideAvatarPreview}
        onChangePhoto={state.onChangePhoto}
      />
    </AvatarPreviewContext.Provider>
  );
}

export function useAvatarPreview() {
  const ctx = useContext(AvatarPreviewContext);
  if (!ctx) {
    throw new Error('useAvatarPreview must be used within AvatarPreviewProvider');
  }
  return ctx;
}

/** Safe for shared components — no-op when provider is absent. */
export function useAvatarPreviewOptional() {
  return useContext(AvatarPreviewContext);
}
