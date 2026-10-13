import React, { useContext } from 'react';
import MentorVideosScreen from '../mentor/MentorVideosScreen';
import MentorFrozenGate from '../../components/MentorFrozenGate';
import { AuthContext } from '../../contexts/AuthContext';

/** Bottom-tab entry for mentor video uploads (hides stack back affordance). */
export default function UploadTabScreen(props) {
  const { mentorFreeze, isMentorSideFrozen } = useContext(AuthContext);

  if (isMentorSideFrozen) {
    return (
      <MentorFrozenGate
        until={mentorFreeze?.until}
        reason={mentorFreeze?.reason}
      />
    );
  }

  return <MentorVideosScreen {...props} embeddedInTab />;
}
