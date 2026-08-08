import React from 'react';
import { View } from 'react-native';
import colors from '../../../styles/colors';
import { CosmicLoader } from '../../../components/LoadingSpinner';

/** Shown while VideoSDK participant ids are not ready yet. */
export default function ParticipantVideoPlaceholder({ style }) {
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.primary[800],
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <CosmicLoader size={48} />
    </View>
  );
}
