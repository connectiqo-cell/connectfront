import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../LargeView', () => 'LargeView');
jest.mock('../MiniView', () => 'MiniView');
jest.mock('../LocalViewContainer', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ participantId }) => (
    <Text>{`local:${participantId ?? 'missing'}`}</Text>
  );
});
jest.mock('../../Components/LocalParticipantPresenter', () => 'LocalParticipantPresenter');
jest.mock('../../Conference/RemoteParticipantPresenter', () => 'RemoteParticipantPresenter');
jest.mock('../../../../components/LoadingSpinner', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    CosmicLoader: () => <Text>loading</Text>,
  };
});

import OneToOneCallLayout from '../OneToOneCallLayout';

describe('OneToOneCallLayout', () => {
  it('uses localParticipantId when only the local participant is present', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <OneToOneCallLayout
          participantCount={1}
          viewLayout="split"
          isLandscape={false}
          localParticipantId="local-123"
          remoteParticipantId={null}
          primaryParticipantId={null}
          secondaryParticipantId={null}
          participantIds={[]}
          localDisplayName="Mentor"
          remoteDisplayName=""
          localScreenShareOn={false}
          presenterId={null}
          onSwapPrimary={() => {}}
          openStatsBottomSheet={() => {}}
          miniViewHeight={160}
        />,
      );
    });

    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('local:local-123');
    expect(text).not.toContain('local:missing');
  });

  it('shows a loader when solo but localParticipantId is not ready yet', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <OneToOneCallLayout
          participantCount={1}
          viewLayout="split"
          isLandscape={false}
          localParticipantId={null}
          remoteParticipantId={null}
          primaryParticipantId={null}
          secondaryParticipantId={null}
          participantIds={[]}
          localDisplayName="Mentor"
          remoteDisplayName=""
          localScreenShareOn={false}
          presenterId={null}
          onSwapPrimary={() => {}}
          openStatsBottomSheet={() => {}}
          miniViewHeight={160}
        />,
      );
    });

    const text = JSON.stringify(tree.toJSON());
    expect(text).not.toContain('local:missing');
    expect(text).not.toContain('local:null');
  });
});
