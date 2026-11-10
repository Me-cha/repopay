import type { BountyDto } from '../../api.js';

export type StatusTone = 'mint' | 'peach' | 'neutral' | 'rose' | 'ink';

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  FUNDED: { label: 'Funded Escrow', tone: 'mint' },
  OPEN: { label: 'Unfunded Draft', tone: 'neutral' },
  CAPTURING: { label: 'Capturing Escrow', tone: 'peach' },
  NEEDS_REVIEW: { label: 'Needs Review', tone: 'peach' },
  AWAITING_CLAIM: { label: 'Awaiting Claim', tone: 'peach' },
  PAYING: { label: 'Disbursing', tone: 'mint' },
  PAID: { label: 'Settled', tone: 'mint' },
  REFUNDING: { label: 'Refunding', tone: 'rose' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  SENT: { label: 'Delivered', tone: 'mint' },
  SUCCESS: { label: 'Delivered', tone: 'mint' },
  PENDING: { label: 'Pending', tone: 'peach' },
  FAILED: { label: 'Attention Needed', tone: 'rose' },
};

export function getStatusMeta(status: string): { label: string; tone: StatusTone } {
  return (
    STATUS_META[status] ?? {
      label: status
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      tone: 'neutral',
    }
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { label, tone } = getStatusMeta(status);
  return <span className={`c2-pill c2-pill-${tone}`}>{label}</span>;
}

export function describeEscrowState(bounty: Pick<BountyDto, 'status' | 'fundedAt' | 'award' | 'currency'>): {
  headline: string;
  detail: string;
  tone: StatusTone;
} {
  switch (bounty.status) {
    case 'FUNDED':
      return {
        headline: 'Captured in Escrow',
        detail: 'Funds captured and held for qualifying PR merge',
        tone: 'mint',
      };
    case 'NEEDS_REVIEW':
      return {
        headline: 'Captured · Pending Review',
        detail: 'Escrow remains locked while maintainer reviews submission',
        tone: 'peach',
      };
    case 'AWAITING_CLAIM':
      return {
        headline: 'Award Committed',
        detail: bounty.currency === 'PYUSD' ? 'Reserved for awarded contributor to connect a Solana devnet wallet' : 'Reserved for awarded contributor to connect PayPal destination',
        tone: 'peach',
      };
    case 'PAYING':
      return {
        headline: 'Transfer In Flight',
        detail: bounty.currency === 'PYUSD' ? 'PYUSD transfer submitted and awaiting finalized confirmation' : 'PayPal disbursement submitted and reconciling',
        tone: 'mint',
      };
    case 'PAID':
      return {
        headline: 'Disbursed to Contributor',
        detail: 'Award settled and confirmed by payout provider',
        tone: 'mint',
      };
    case 'CAPTURING':
      return {
        headline: 'Capture Pending',
        detail: bounty.currency === 'PYUSD' ? 'Devnet funding in progress; awaiting finalized confirmation' : 'PayPal order created; awaiting capture confirmation',
        tone: 'peach',
      };
    case 'REFUNDING':
      return {
        headline: 'Refund Processing',
        detail: 'Approved cancellation refund is reconciling',
        tone: 'rose',
      };
    case 'CANCELLED':
      return bounty.fundedAt
        ? {
            headline: 'Cancelled After Capture',
            detail: 'Closed under evidenced cancellation notice',
            tone: 'neutral',
          }
        : {
            headline: 'Cancelled · No Funds Captured',
            detail: 'Draft closed before any payment was captured',
            tone: 'neutral',
          };
    case 'OPEN':
    default:
      return {
        headline: 'Unfunded Draft',
        detail: 'No escrow captured yet. Maintainer funding required.',
        tone: 'neutral',
      };
  }
}

export function formatAttentionReason(
  reason: string | null | undefined,
  status: string,
): string | null {
  if (!reason) {
    if (status === 'NEEDS_REVIEW') return 'Maintainer review requested';
    if (status === 'AWAITING_CLAIM') return 'Waiting for contributor payout connection';
    return null;
  }
  const clean = reason.trim();
  if (!clean) return null;
  // Convert SNAKE_CASE codes into calm human-readable prose if needed
  if (/^[A-Z0-9_]+$/.test(clean)) {
    return clean
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase());
  }
  return clean;
}
