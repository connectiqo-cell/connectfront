import React from 'react';
import MentorVideosScreen from '../mentor/MentorVideosScreen';

/** Bottom-tab entry for mentor video uploads (hides stack back affordance). */
export default function UploadTabScreen(props) {
  return <MentorVideosScreen {...props} embeddedInTab />;
}
