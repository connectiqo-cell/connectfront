import { Share } from 'react-native';
import { getCampaignShareLink, shareCampaign } from '../shareProfile';

jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

const CAMPAIGN = {
  campaignId: 'c1a2b3',
  title: 'Monsoon skincare reels',
  brandName: 'Glow Co',
  budgetPerWinner: 12000,
  deadlineLabel: '30 Nov 2026',
};

beforeEach(() => Share.share.mockClear());

describe('campaign sharing', () => {
  it('builds the deep-linkable https campaign url', () => {
    expect(getCampaignShareLink('c1a2b3')).toBe('https://app.connectiqo.com/campaign/c1a2b3');
  });

  it('encodes ids and refuses empty ones', () => {
    expect(getCampaignShareLink('a b/c')).toBe('https://app.connectiqo.com/campaign/a%20b%2Fc');
    expect(getCampaignShareLink('')).toBe('');
    expect(getCampaignShareLink(null)).toBe('');
  });

  it('shares brand, payout, deadline and the link', async () => {
    await expect(shareCampaign(CAMPAIGN)).resolves.toBe(true);

    const { message } = Share.share.mock.calls[0][0];
    expect(message).toContain('Glow Co is looking for creators — Monsoon skincare reels');
    expect(message).toContain('₹12,000 per selected creator');
    expect(message).toContain('Apply by 30 Nov 2026');
    expect(message).toContain('https://app.connectiqo.com/campaign/c1a2b3');
  });

  it('omits payout and deadline lines when absent', async () => {
    await shareCampaign({ campaignId: 'c1', title: 'Untitled brief' });

    const { message } = Share.share.mock.calls[0][0];
    expect(message).toBe('Collab on Connectiqo — Untitled brief\nhttps://app.connectiqo.com/campaign/c1');
  });

  it('does not open the share sheet without a campaign id', async () => {
    await expect(shareCampaign({ title: 'No id' })).resolves.toBe(false);
    expect(Share.share).not.toHaveBeenCalled();
  });
});
