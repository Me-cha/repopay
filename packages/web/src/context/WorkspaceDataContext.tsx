import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  formatTimeIST,
  ReadError,
  subscribe,
  type BountyDto,
  type ConnectStatusDto,
  type DetailDto,
  type PayoutDto,
} from '../api.js';
import { useAuth } from './AuthContext.js';
import { useRouter } from '../router/Router.js';

export interface WorkspaceStats {
  totalCount: number;
  totalVolumeCents: number;
  activeEscrowCents: number;
  fundedCount: number;
  openDraftCount: number;
  openDraftCents: number;
  needsAttentionCount: number;
  awaitingClaimCount: number;
  awaitingClaimCents: number;
  paidCount: number;
  paidCents: number;
  cancelledCount: number;
  cancelledCents: number;
  repositories: {
    repoFullName: string;
    totalCount: number;
    fundedCount: number;
    attentionCount: number;
    totalCents: number;
    fundedCents: number;
  }[];
}

interface WorkspaceDataContextValue {
  bounties: BountyDto[];
  payouts: PayoutDto[];
  connectStatus: ConnectStatusDto | null;
  stats: WorkspaceStats;
  initialLoading: boolean;
  refreshing: boolean;
  error: string;
  updatedAtIST: string;
  refreshAll: () => void;
  selectedBountyId: string | null;
  selectedBountySummary: BountyDto | null;
  selectedDetail: DetailDto | null;
  detailLoading: boolean;
  detailError: string;
  openBountyDetail: (id: string) => void;
  closeBountyDetail: () => void;
  savePayoutEmail: (email: string) => Promise<ConnectStatusDto>;
}

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | null>(null);

const ESCROW_LOCKED_STATUSES = new Set(['FUNDED', 'NEEDS_REVIEW', 'AWAITING_CLAIM', 'PAYING']);

export function WorkspaceDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { search } = useRouter();

  const [bounties, setBounties] = useState<BountyDto[]>([]);
  const [payouts, setPayouts] = useState<PayoutDto[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectStatusDto | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAtIST, setUpdatedAtIST] = useState('');

  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('bounty');
  });
  const [detailCache, setDetailCache] = useState<Record<string, DetailDto>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const hasLoadedOnce = useRef(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const streamDebounceRef = useRef<number | null>(null);

  // Sync ?bounty= query parameter if navigated
  useEffect(() => {
    const param = new URLSearchParams(search).get('bounty');
    if (param) setSelectedBountyId(param);
  }, [search]);

  const clearPrivateState = useCallback(() => {
    generation.current++;
    inFlight.current = false;
    abortRef.current?.abort();
    if (streamDebounceRef.current !== null) {
      window.clearTimeout(streamDebounceRef.current);
      streamDebounceRef.current = null;
    }
    setBounties([]);
    setPayouts([]);
    setConnectStatus(null);
    setDetailCache({});
    setSelectedBountyId(null);
    setError('Repository access or connection changed. Data is hidden until access is re-verified.');
    setInitialLoading(false);
    setRefreshing(false);
  }, []);

  const refreshAll = useCallback(() => {
    const gen = ++generation.current;
    inFlight.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!hasLoadedOnce.current) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    void (async () => {
      try {
        const [bountyPage, payoutPage, connectRes] = await Promise.all([
          api.bounties('0', controller.signal),
          api.payouts('0', controller.signal),
          api.connectStatus(controller.signal).catch(() => null),
        ]);
        if (gen !== generation.current) return;

        // Collect additional pages if present (bounded to 3 extra pages)
        const allBounties = [...bountyPage.items];
        let nextCursor = bountyPage.nextCursor;
        let safety = 0;
        while (nextCursor && safety < 3) {
          safety++;
          const more = await api.bounties(nextCursor, controller.signal);
          if (gen !== generation.current) return;
          allBounties.push(...more.items);
          nextCursor = more.nextCursor;
        }

        hasLoadedOnce.current = true;
        setBounties(allBounties);
        setPayouts(payoutPage.items);
        if (connectRes) setConnectStatus(connectRes);
        setError('');
        setUpdatedAtIST(formatTimeIST());
      } catch (err) {
        if (gen !== generation.current || controller.signal.aborted) return;
        if (err instanceof ReadError && err.status === 401) {
          window.location.href = '/';
          return;
        }
        setBounties([]);
        setPayouts([]);
        setDetailCache({});
        setError(err instanceof ReadError ? err.message : 'Unable to load current workspace data.');
      } finally {
        if (gen === generation.current) {
          inFlight.current = false;
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    })();
  }, []);

  const handleStreamSignal = useCallback(() => {
    // Do not abort the initial bootstrap fetch during SSE's replay burst on connect
    if (!hasLoadedOnce.current && inFlight.current) return;
    if (streamDebounceRef.current !== null) {
      window.clearTimeout(streamDebounceRef.current);
    }
    streamDebounceRef.current = window.setTimeout(() => {
      streamDebounceRef.current = null;
      refreshAll();
    }, 120);
  }, [refreshAll]);

  useEffect(() => {
    refreshAll();
    return () => {
      generation.current++;
      inFlight.current = false;
      abortRef.current?.abort();
      if (streamDebounceRef.current !== null) {
        window.clearTimeout(streamDebounceRef.current);
      }
    };
  }, [refreshAll]);

  useEffect(() => {
    const heartbeatMs = (user?.heartbeatSeconds ?? 30) * 1000;
    return subscribe(handleStreamSignal, clearPrivateState, heartbeatMs);
  }, [handleStreamSignal, clearPrivateState, user]);

  // Fetch full DetailDto whenever selectedBountyId opens
  useEffect(() => {
    if (!selectedBountyId) {
      setDetailLoading(false);
      setDetailError('');
      return;
    }
    const id = selectedBountyId;
    const ctrl = new AbortController();
    setDetailLoading(true);
    setDetailError('');

    void (async () => {
      try {
        const d = await api.detail(id, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setDetailCache((prev) => ({ ...prev, [id]: d }));
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setDetailError(err instanceof ReadError ? err.message : 'Unable to load bounty inspection details.');
      } finally {
        if (!ctrl.signal.aborted) setDetailLoading(false);
      }
    })();

    return () => { ctrl.abort(); };
  }, [selectedBountyId]);

  const openBountyDetail = useCallback((id: string) => {
    setSelectedBountyId(id);
  }, []);

  const closeBountyDetail = useCallback(() => {
    setSelectedBountyId(null);
    const params = new URLSearchParams(window.location.search);
    if (params.has('bounty')) {
      params.delete('bounty');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  const savePayoutEmail = useCallback(
    async (email: string): Promise<ConnectStatusDto> => {
      let csrf = connectStatus?.csrf;
      if (!csrf) {
        const fresh = await api.connectStatus();
        csrf = fresh.csrf;
      }
      const updated = await api.updateConnect(email, csrf);
      setConnectStatus(updated);
      refreshAll();
      return updated;
    },
    [connectStatus, refreshAll],
  );

  const stats = useMemo<WorkspaceStats>(() => {
    let totalVolumeCents = 0;
    let activeEscrowCents = 0;
    let fundedCount = 0;
    let openDraftCount = 0;
    let openDraftCents = 0;
    let needsAttentionCount = 0;
    let awaitingClaimCount = 0;
    let awaitingClaimCents = 0;
    let paidCount = 0;
    let paidCents = 0;
    let cancelledCount = 0;
    let cancelledCents = 0;

    const repoMap = new Map<
      string,
      {
        repoFullName: string;
        totalCount: number;
        fundedCount: number;
        attentionCount: number;
        totalCents: number;
        fundedCents: number;
      }
    >();

    for (const b of bounties) {
      totalVolumeCents += b.amountCents;
      if (ESCROW_LOCKED_STATUSES.has(b.status)) {
        const unpaid = b.award ? b.award.unpaidCents : b.amountCents;
        activeEscrowCents += unpaid;
      }
      if (b.status === 'FUNDED') fundedCount++;
      if (b.status === 'OPEN' || b.status === 'CAPTURING') {
        openDraftCount++;
        openDraftCents += b.amountCents;
      }
      if (b.needsAttention || b.status === 'NEEDS_REVIEW' || b.status === 'REFUNDING') {
        needsAttentionCount++;
      }
      if (b.status === 'AWAITING_CLAIM') {
        awaitingClaimCount++;
        awaitingClaimCents += b.award?.unpaidCents ?? b.amountCents;
      }
      if (b.status === 'PAID') {
        paidCount++;
        paidCents += b.award?.paidCents ?? b.amountCents;
      } else if (b.award && b.award.paidCents > 0) {
        paidCents += b.award.paidCents;
      }
      if (b.status === 'CANCELLED') {
        cancelledCount++;
        cancelledCents += b.amountCents;
      }

      const existing = repoMap.get(b.repoFullName) ?? {
        repoFullName: b.repoFullName,
        totalCount: 0,
        fundedCount: 0,
        attentionCount: 0,
        totalCents: 0,
        fundedCents: 0,
      };
      existing.totalCount += 1;
      existing.totalCents += b.amountCents;
      if (ESCROW_LOCKED_STATUSES.has(b.status) || b.status === 'PAID') {
        existing.fundedCount += 1;
        existing.fundedCents += b.amountCents;
      }
      if (b.needsAttention || b.status === 'NEEDS_REVIEW') {
        existing.attentionCount += 1;
      }
      repoMap.set(b.repoFullName, existing);
    }

    // Reconcile paidCents with payout rows if higher
    const payoutDeliveredCents = payouts.reduce((acc, p) => acc + p.paidCents, 0);
    if (payoutDeliveredCents > paidCents) {
      paidCents = payoutDeliveredCents;
    }

    const repositories = Array.from(repoMap.values()).sort(
      (a, b) => b.fundedCents - a.fundedCents || b.totalCents - a.totalCents,
    );

    return {
      totalCount: bounties.length,
      totalVolumeCents,
      activeEscrowCents,
      fundedCount,
      openDraftCount,
      openDraftCents,
      needsAttentionCount,
      awaitingClaimCount,
      awaitingClaimCents,
      paidCount,
      paidCents,
      cancelledCount,
      cancelledCents,
      repositories,
    };
  }, [bounties, payouts]);

  const selectedBountySummary = useMemo(
    () => (selectedBountyId ? bounties.find((b) => b.id === selectedBountyId) ?? null : null),
    [bounties, selectedBountyId],
  );

  const selectedDetail = selectedBountyId ? detailCache[selectedBountyId] ?? null : null;

  return (
    <WorkspaceDataContext.Provider
      value={{
        bounties,
        payouts,
        connectStatus,
        stats,
        initialLoading,
        refreshing,
        error,
        updatedAtIST,
        refreshAll,
        selectedBountyId,
        selectedBountySummary,
        selectedDetail,
        detailLoading,
        detailError,
        openBountyDetail,
        closeBountyDetail,
        savePayoutEmail,
      }}
    >
      {children}
    </WorkspaceDataContext.Provider>
  );
}

export function useWorkspaceData() {
  const ctx = useContext(WorkspaceDataContext);
  if (!ctx) {
    throw new Error('useWorkspaceData must be used inside WorkspaceDataProvider');
  }
  return ctx;
}
