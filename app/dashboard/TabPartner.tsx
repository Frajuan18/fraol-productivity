'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FiUsers,
  FiGrid,
  FiTarget,
  FiZap,
  FiMessageSquare,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiAlertCircle,
  FiClock,
  FiCalendar,
  FiCheckCircle,
  FiAward,
  FiLock,
  FiPlus,
  FiTrash2,
  FiPlay,
  FiPause,
  FiStopCircle,
  FiWifi,
  FiSend,
  FiLink,
  FiCheck,
  FiImage,
  FiUpload,
  FiX,
  FiDownload,
  FiCheckSquare,
  FiSquare,
  FiActivity,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { getRepository } from '@/lib/repositories/repository';
import { getErrorCode } from '@/lib/repositories/errors';
import { getPublicCloudEnabled } from '@/lib/config';
import { connectPartnershipStream } from '@/lib/realtime/sse';
import { applyReadReceipt, countUnread, sortMessages, upsertMessage } from '@/lib/realtime/chat';
import { mergeMessageHistory } from '@/lib/repositories/chatPaging';
import { uploadSnapshot, downloadZip } from '@/lib/snapshots/snapshotApi';
import { formatLongDate } from '@/src/utils/date';
import type { PartnerOverview } from '@/lib/repositories/ProductivityRepository';
import type {
  MediaStatus,
  Message,
  PartnerPrivacySettings,
  PlanVisibility,
  SharedFocusSession,
  SnapshotItem,
  SharedActivityItem,
  UserStatus,
} from '@/src/types/collaboration';
import type { Plan, PlanPriority, PlanStatus } from '@/src/types';

const softCard = 'card-glass rounded-[22px] p-6 sm:p-8';

const CHAT_PAGE_SIZE = 40;
const ACTIVITY_PAGE_SIZE = 10;

const DEMO_USER_ID = 'demo-user';

type PartnerSection = 'overview' | 'plans' | 'focus' | 'activity' | 'chat';

const SECTIONS: { id: PartnerSection; label: string; icon: IconType }[] = [
  { id: 'overview', label: 'Overview', icon: FiGrid },
  { id: 'plans', label: 'Plans', icon: FiTarget },
  { id: 'focus', label: 'Focus', icon: FiZap },
  { id: 'activity', label: 'Activity', icon: FiActivity },
  { id: 'chat', label: 'Chat', icon: FiMessageSquare },
];

async function resolveUserId(): Promise<string> {
  if (getPublicCloudEnabled()) {
    try {
      const response = await fetch('/api/auth/me');
      const body = (await response.json()) as { ok: boolean; user?: { id: string } | null };
      if (body.ok && body.user) return body.user.id;
    } catch {
      // fall through
    }
    return '';
  }
  return DEMO_USER_ID;
}

function statusLabel(status: string): { label: string; dot: string } {
  switch (status) {
    case 'online':
      return { label: 'Online', dot: 'bg-success' };
    case 'focusing':
      return { label: 'Focusing', dot: 'bg-warning' };
    case 'away':
      return { label: 'Away', dot: 'bg-text-faint' };
    default:
      return { label: 'Offline', dot: 'bg-text-muted' };
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const NEXT_STATUS: Record<PlanStatus, PlanStatus> = {
  'not-started': 'in-progress',
  'in-progress': 'completed',
  completed: 'pending',
  pending: 'not-started',
};

function statusPill(status: PlanStatus): { label: string; cls: string } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', cls: 'bg-success/10 text-success border border-success/15' };
    case 'in-progress':
      return { label: 'In progress', cls: 'bg-accent/10 text-accent border border-accent/20' };
    case 'pending':
      return { label: 'Pending', cls: 'bg-warning/10 text-warning border border-warning/15' };
    default:
      return { label: 'Not started', cls: 'bg-surface-hover text-text-muted border border-border' };
  }
}

export default function TabPartner() {
  const reduced = useReducedMotion();
  const [userId, setUserId] = useState<string | null>(null);
  const [overview, setOverview] = useState<PartnerOverview | null>(null);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [commonPlans, setCommonPlans] = useState<Plan[]>([]);
  const [section, setSection] = useState<PartnerSection>('overview');
  const [plansScope, setPlansScope] = useState<'common' | 'personal'>('common');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [planBusy, setPlanBusy] = useState<number | null>(null);
  const [commonTitle, setCommonTitle] = useState('');
  const [commonCategory, setCommonCategory] = useState('');
  const [commonPriority, setCommonPriority] = useState<PlanPriority>('medium');
  const [commonDate, setCommonDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [focusSession, setFocusSession] = useState<SharedFocusSession | null>(null);
  const [partnerPresence, setPartnerPresence] = useState<{ status: UserStatus; lastSeenAt: string } | null>(null);
  const [serverAnchor, setServerAnchor] = useState<{ at: number; receivedAt: number } | null>(null);
  const [focusDuration, setFocusDuration] = useState(25);
  const [focusBusy, setFocusBusy] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const streamRef = useRef<{ close(): void } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [planShareOpen, setPlanShareOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const sectionRef = useRef<PartnerSection>('overview');
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const markReadTimerRef = useRef<number | null>(null);
  const chatLoadedRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const [chatHasOlder, setChatHasOlder] = useState(false);
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [chatOlderError, setChatOlderError] = useState<string | null>(null);
  const [myPrivacy, setMyPrivacy] = useState<PartnerPrivacySettings | null>(null);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsHasMore, setSnapshotsHasMore] = useState(false);
  const [snapshotCursor, setSnapshotCursor] = useState<string | null>(null);
  const [snapshotsBusy, setSnapshotsBusy] = useState<boolean>(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [snapshotSelection, setSnapshotSelection] = useState<Set<string>>(new Set());
  const [exportingSnapshots, setExportingSnapshots] = useState(false);
  const [removingSnapshots, setRemovingSnapshots] = useState(false);
  const [uploadingSnapshot, setUploadingSnapshot] = useState(false);
  const [activityItems, setActivityItems] = useState<SharedActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const activityLoadedRef = useRef(false);
  const activityMoreBusyRef = useRef(false);
  const snapshotsCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sectionRef.current = section;
  }, [section]);

  const conversationId = overview?.conversation.id ?? null;

  const load = useCallback(async () => {
    const uid = await resolveUserId();
    if (!uid) {
      setError('Sign in to open your partner workspace.');
      setLoading(false);
      return;
    }
    setUserId(uid);
    const repo = getRepository();
    setLoading(true);
    try {
      const [overviewResult, myPlansResult, commonResult, activeFocus, privacy] = await Promise.all([
        repo.getPartnerOverview(uid),
        repo.getMyPlans(uid),
        repo.getCommonPlans(uid),
        repo.getActiveSharedFocus(uid),
        repo.getPrivacySettings(uid),
      ]);
      setOverview(overviewResult);
      setMyPlans(myPlansResult.filter((pl) => pl.planType !== 'common'));
      setCommonPlans(commonResult);
      setFocusSession(activeFocus);
      setMyPrivacy(privacy);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const scheduleMarkRead = useCallback(() => {
    if (!userId || !conversationId) return;
    if (markReadTimerRef.current) window.clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = window.setTimeout(() => {
      markReadTimerRef.current = null;
      void getRepository().markRead(userId, conversationId);
    }, 600);
  }, [userId, conversationId]);

  const reloadChat = useCallback(async () => {
    if (!userId || !conversationId || !chatLoadedRef.current) return;
    try {
      const page = await getRepository().listMessagesPaged(userId, conversationId, undefined, CHAT_PAGE_SIZE);
      setMessages((prev) => mergeMessageHistory(prev, page.items));
      const unreadCount = countUnread(page.items, userId);
      setUnread(unreadCount);
      if (unreadCount > 0 && sectionRef.current === 'chat' && document.visibilityState === 'visible') {
        scheduleMarkRead();
      }
    } catch {
      // keep the current list; the next heartbeat/SSE frame resyncs
    }
  }, [userId, conversationId, scheduleMarkRead]);

  const reconcile = useCallback(async () => {
    if (!getPublicCloudEnabled() || !userId) return;
    try {
      const [overviewResult, activeFocus] = await Promise.all([
        getRepository().getPartnerOverview(userId),
        getRepository().getActiveSharedFocus(userId),
      ]);
      if (overviewResult) setOverview(overviewResult);
      setFocusSession(activeFocus);
    } catch {
      // keep the current state; the next heartbeat resyncs focus state
    }
  }, [userId]);

  const loadActivity = useCallback(
    async (silent = false) => {
      if (!userId) return;
      if (!silent) setActivityLoading(true);
      try {
        const page = await getRepository().listSharedActivity(userId, undefined, ACTIVITY_PAGE_SIZE);
        setActivityItems(page.items);
        setActivityHasMore(page.hasMore);
        setActivityCursor(page.nextCursor);
        setActivityError(null);
        activityLoadedRef.current = true;
      } catch (err) {
        if (!silent) setActivityError(err instanceof Error ? err.message : 'Failed to load activity.');
      } finally {
        if (!silent) setActivityLoading(false);
      }
    },
    [userId],
  );

  const loadMoreActivity = useCallback(async () => {
    if (!userId || !activityHasMore || activityMoreBusyRef.current || !activityCursor) return;
    activityMoreBusyRef.current = true;
    try {
      const page = await getRepository().listSharedActivity(userId, activityCursor, ACTIVITY_PAGE_SIZE);
      setActivityItems((prev) => [...prev, ...page.items]);
      setActivityHasMore(page.hasMore);
      setActivityCursor(page.nextCursor);
    } catch {
      // ignore; the sentinel will retry on the next intersection
    } finally {
      activityMoreBusyRef.current = false;
    }
  }, [userId, activityHasMore, activityCursor]);

  useEffect(() => {
    if (!overview || !getPublicCloudEnabled()) return;
    const stream = connectPartnershipStream(overview.partnership.id, {
      onEvent: (event) => {
        switch (event.type) {
          case 'focus.state':
            setFocusSession(event.session);
            if (event.session?.status === 'ended' && activityLoadedRef.current) void loadActivity(true);
            break;
          case 'heartbeat':
            setServerAnchor({ at: event.at ? Date.parse(event.at) : Date.now(), receivedAt: Date.now() });
            if (event.session) setFocusSession(event.session);
            break;
          case 'presence':
            if (event.userId !== userId) setPartnerPresence({ status: event.status, lastSeenAt: event.lastSeenAt });
            break;
          case 'chat.message': {
            if (!conversationId || event.conversationId !== conversationId) break;
            setMessages((prev) => upsertMessage(prev, event.message));
            if (event.message.senderId !== userId) {
              if (sectionRef.current === 'chat' && document.visibilityState === 'visible') {
                if (userId) {
                  scheduleMarkRead();
                  setMessages((prev) => applyReadReceipt(prev, userId, new Date().toISOString()));
                }
                setUnread(0);
              } else {
                setUnread((n) => n + 1);
              }
            }
            break;
          }
          case 'chat.typing': {
            if (conversationId && event.conversationId === conversationId && event.userId !== userId) {
              setPartnerTyping(true);
              if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
              typingTimerRef.current = window.setTimeout(() => setPartnerTyping(false), 2500);
            }
            break;
          }
          case 'chat.read': {
            if (conversationId && event.conversationId === conversationId) {
              setMessages((prev) => applyReadReceipt(prev, event.readerId, event.readAt));
            }
            break;
          }
          case 'privacy.changed':
            void load();
            break;
          default:
            break;
        }
      },
      onReconnect: () => {
        void reloadChat();
        void reconcile();
      },
    });
    streamRef.current = stream;
    return () => {
      streamRef.current = null;
      stream.close();
    };
  }, [overview, userId, conversationId, load, scheduleMarkRead, reloadChat, reconcile, loadActivity]);

  const focusStatus = focusSession?.status;
  const focusEndsAt = focusSession?.endsAt;

  useEffect(() => {
    if (!getPublicCloudEnabled() || !userId) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void getRepository().setUserStatus(userId, 'away');
      else void getRepository().setUserStatus(userId, 'online');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [userId]);

  useEffect(() => {
    if (focusStatus !== 'running' || !focusEndsAt) return;
    const recompute = () => {
      const now = serverAnchor ? serverAnchor.at + (Date.now() - serverAnchor.receivedAt) : Date.now();
      setRemainingMs(Math.max(0, Date.parse(focusEndsAt) - now));
    };
    recompute();
    const interval = window.setInterval(recompute, 250);
    return () => window.clearInterval(interval);
  }, [focusStatus, focusEndsAt, serverAnchor]);

  const pausedRemainingMs = (): number => {
    if (!focusSession || focusSession.status === 'ended') return 0;
    if (focusSession.status === 'paused' && focusSession.pausedAt && focusSession.endsAt) {
      return Math.max(0, Date.parse(focusSession.endsAt) - Date.parse(focusSession.pausedAt));
    }
    return 0;
  };

  const formatRemaining = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const runFocusAction = async (action: 'start' | 'pause' | 'resume' | 'complete' | 'cancel') => {
    if (!userId || focusBusy) return;
    setFocusBusy(true);
    setError(null);
    try {
      const repo = getRepository();
      const session = focusSession;
      let result: SharedFocusSession | null = null;
      if (action === 'start') result = await repo.startSharedFocus(userId, focusDuration);
      else if (session) {
        if (action === 'pause') result = await repo.pauseSharedFocus(userId, session.id);
        else if (action === 'resume') result = await repo.resumeSharedFocus(userId, session.id);
        else if (action === 'complete') result = await repo.completeSharedFocus(userId, session.id);
        else if (action === 'cancel') result = await repo.cancelSharedFocus(userId, session.id);
      }
      if (result) setFocusSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shared focus.');
    } finally {
      setFocusBusy(false);
    }
  };

  const loadChat = useCallback(async () => {
    if (!userId || !conversationId || chatLoadedRef.current) return;
    setChatLoading(true);
    try {
      const page = await getRepository().listMessagesPaged(userId, conversationId, undefined, CHAT_PAGE_SIZE);
      setMessages(sortMessages(page.items));
      setChatHasOlder(page.hasOlder);
      const unreadCount = countUnread(page.items, userId);
      setUnread(unreadCount);
      if (unreadCount > 0 && document.visibilityState === 'visible' && sectionRef.current === 'chat') {
        void getRepository().markRead(userId, conversationId);
        setMessages((prev) => applyReadReceipt(prev, userId, new Date().toISOString()));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages.');
    } finally {
      setChatLoading(false);
      chatLoadedRef.current = true;
    }
  }, [userId, conversationId]);

  const loadOlderMessages = useCallback(async () => {
    if (!userId || !conversationId || !chatHasOlder || loadingOlderRef.current) return;
    const current = messagesRef.current;
    if (current.length === 0) return;
    loadingOlderRef.current = true;
    setChatLoadingOlder(true);
    setChatOlderError(null);
    const el = scrollRef.current;
    const anchorHeight = el ? el.scrollHeight : 0;
    try {
      const cursor = current[0]?.createdAt;
      const page = await getRepository().listMessagesPaged(userId, conversationId, cursor, CHAT_PAGE_SIZE);
      setMessages((prev) => mergeMessageHistory(prev, page.items));
      setChatHasOlder(page.hasOlder);
      requestAnimationFrame(() => {
        const elNow = scrollRef.current;
        if (elNow) elNow.scrollTop = elNow.scrollHeight - anchorHeight;
      });
    } catch (err) {
      setChatOlderError(err instanceof Error ? err.message : 'Failed to load earlier messages.');
    } finally {
      loadingOlderRef.current = false;
      setChatLoadingOlder(false);
    }
  }, [userId, conversationId, chatHasOlder]);

  const handleChatScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop < 56 && chatHasOlder) void loadOlderMessages();
  };

  useEffect(() => {
    return () => {
      if (markReadTimerRef.current) window.clearTimeout(markReadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!snapshotsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    snapshotsCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSnapshotsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [snapshotsOpen]);

  const handleSectionChange = (next: PartnerSection) => {
    setSection(next);
    if (next === 'chat') void loadChat();
    if (next === 'activity' && !activityLoadedRef.current) void loadActivity();
  };  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, partnerTyping, chatLoading]);

  const handleChatInput = (value: string) => {
    setChatInput(value);
    const now = Date.now();
    if (userId && conversationId && now - lastTypingRef.current > 1200) {
      lastTypingRef.current = now;
      void getRepository().sendTyping(userId, conversationId);
    }
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!userId || !conversationId || !text || sending) return;
    setSending(true);
    setError(null);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: userId,
      type: 'text',
      body: text,
      readAt: null,
      delivery: 'sending',
      createdAt: new Date().toISOString(),
    };
    setChatInput('');
    lastTypingRef.current = 0;
    setMessages((prev) => sortMessages([...prev, optimistic]));
    try {
      const message = await getRepository().sendMessage(userId, conversationId, {
        type: 'text',
        body: text,
      });
      setMessages((prev) => sortMessages(prev.map((m) => (m.id === optimistic.id ? { ...message, delivery: 'sent' } : m))));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const openSnapshots = () => {
    setSnapshotsOpen(true);
    setSnapshotError(null);
    setSnapshotNotice(null);
    setSnapshotSelection(new Set());
    void loadSnapshots(null, true);
  };

  const loadSnapshots = async (cursor: string | null = null, reset = false) => {
    if (!userId || !conversationId || snapshotsLoading) return;
    setSnapshotsLoading(true);
    setSnapshotError(null);
    try {
      const page = await getRepository().listSnapshots(userId, conversationId, cursor ?? undefined, 12);
      setSnapshots((prev) => (reset ? page.items : [...prev, ...page.items.filter((n) => !prev.some((p) => p.id === n.id))]));
      setSnapshotsHasMore(page.hasMore);
      setSnapshotCursor(page.nextCursor);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Failed to load snapshots.');
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const toggleSnapshotSelection = (id: string) => {
    setSnapshotSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportSnapshots = async () => {
    if (!userId || !conversationId || snapshotSelection.size === 0 || exportingSnapshots) return;
    setExportingSnapshots(true);
    setSnapshotError(null);
    setSnapshotNotice(null);
    try {
      const result = await getRepository().exportSnapshots(userId, conversationId, [...snapshotSelection]);
      downloadZip(result);
      if (result.failed.length > 0) {
        setSnapshotError(
          `${result.exported.length} exported; ${result.failed.length} could not be exported (${result.failed[0].reason}).`,
        );
      } else {
        setSnapshotNotice(`Exported ${result.exported.length} snapshot${result.exported.length !== 1 ? 's' : ''} as ${result.fileName}. You can now remove them.`);
      }
      await loadSnapshots(undefined, true);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExportingSnapshots(false);
    }
  };

  const handleRemoveSnapshots = async () => {
    if (!userId || !conversationId || snapshotSelection.size === 0 || removingSnapshots) return;
    setRemovingSnapshots(true);
    setSnapshotError(null);
    setSnapshotNotice(null);
    try {
      const result = await getRepository().removeSnapshotsAfterExport(userId, conversationId, [...snapshotSelection]);
      setSnapshotSelection(new Set());
      await loadSnapshots(undefined, true);
      await loadChatRef();
      if (result.failed.length > 0) {
        setSnapshotNotice(
          `Removed ${result.removed.length}; ${result.failed.length} not removed (${result.failed[0].reason}).`,
        );
      } else {
        setSnapshotNotice(`Removed ${result.removed.length} snapshot${result.removed.length !== 1 ? 's' : ''} after export.`);
      }
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Failed to remove snapshots.');
    } finally {
      setRemovingSnapshots(false);
    }
  };

  const handleUploadSnapshot = async (file: File, caption: string | null) => {
    if (!file || uploadingSnapshot) return;
    setUploadingSnapshot(true);
    setSnapshotError(null);
    try {
      const message = await uploadSnapshot(file, caption);
      setMessages((prev) => upsertMessage(prev, message));
      setSnapshotNotice('Snapshot shared.');
      await loadSnapshots(undefined, true);
    } catch (err) {
      if (getErrorCode(err) === 'SNAPSHOTS_DISABLED') setSnapshotError('Snapshot sharing is disabled.');
      else setSnapshotError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingSnapshot(false);
    }
  };

  const loadChatRef = useCallback(async () => {
    if (!userId || !conversationId || !chatLoadedRef.current) return;
    try {
      const page = await getRepository().listMessagesPaged(userId, conversationId, undefined, CHAT_PAGE_SIZE);
      setMessages((prev) => mergeMessageHistory(prev, page.items));
      const unreadCount = countUnread(page.items, userId);
      setUnread(unreadCount);
    } catch {
      // keep the current list
    }
  }, [userId, conversationId]);

  const handleSharePlan = async (plan: Plan) => {
    if (!userId || !conversationId || sending) return;
    setSending(true);
    setError(null);
    setPlanShareOpen(false);
    try {
      const message = await getRepository().sendMessage(userId, conversationId, {
        type: 'plan_reference',
        planId: plan.id,
        body: plan.title,
      });
      setMessages((prev) => upsertMessage(prev, message));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share plan.');
    } finally {
      setSending(false);
    }
  };

  const timeLabel = (iso: string): string => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleToggleShare = async (planId: number, current: PlanVisibility | undefined) => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await getRepository().changePlanVisibility(
        userId,
        planId,
        current === 'partner_shared' ? 'private' : 'partner_shared',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan visibility.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCommonPlan = async () => {
    if (!userId || !commonTitle.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      await getRepository().createCommonPlan(userId, {
        title: commonTitle.trim(),
        description: '',
        type: 'weekly',
        priority: commonPriority,
        category: commonCategory.trim(),
        date: commonDate,
        status: 'not-started',
      });
      setCommonTitle('');
      setCommonCategory('');
      setCommonPriority('medium');
      setCommonDate(new Date().toISOString().split('T')[0]);
      setCommonPlans(await getRepository().getCommonPlans(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create common plan.');
    } finally {
      setCreating(false);
    }
  };

  const handleCycleCommonStatus = async (plan: Plan) => {
    if (!userId || planBusy !== null) return;
    setPlanBusy(plan.id);
    setError(null);
    try {
      const updated = await getRepository().updateCommonPlan(
        userId,
        plan.id,
        { status: NEXT_STATUS[plan.status] },
        plan.updatedAt,
      );
      if (updated) setCommonPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    } catch (err) {
      if (getErrorCode(err) === 'CONFLICT') {
        setError('This plan was changed by your partner. Reloading…');
        setCommonPlans(await getRepository().getCommonPlans(userId));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update common plan.');
      }
    } finally {
      setPlanBusy(null);
    }
  };

  const handleDeleteCommonPlan = async (plan: Plan) => {
    if (!userId || planBusy !== null) return;
    setPlanBusy(plan.id);
    setError(null);
    try {
      const deleted = await getRepository().deletePlan(userId, plan.id);
      if (deleted) setCommonPlans((prev) => prev.filter((p) => p.id !== plan.id));
      else setError('Only the plan owner can delete a common plan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete common plan.');
    } finally {
      setPlanBusy(null);
    }
  };

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.22, delay: reduced ? 0 : delay },
  });

  const mySharedPlans = myPlans.filter((p) => p.visibility === 'partner_shared');

  const partnerName = overview?.profile.displayName ?? 'partner';
  const visiblePlans = commonPlans.filter((p) => p.visibility === 'partner_shared');

  const presenceStatus = partnerPresence?.status ?? overview?.profile.status ?? 'offline';
  const presenceSeen = partnerPresence?.lastSeenAt ?? overview?.profile.lastSeenAt ?? '';

  const stats = overview?.statistics;
  const statCards = [
    { label: 'Today', value: `${stats?.focusMinutesToday ?? 0}m`, icon: FiClock },
    { label: 'This week', value: `${stats?.focusMinutesThisWeek ?? 0}m`, icon: FiCalendar },
    { label: 'Sessions', value: `${stats?.completedSessions ?? 0}`, icon: FiCheckCircle },
    { label: 'Streak', value: `${stats?.currentStreak ?? 0}d`, icon: FiAward },
  ];

  const sectionClass = (active: boolean) =>
    `flex items-center gap-2 rounded-[10px] px-3.5 h-9 text-[13px] font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
      active ? 'bg-surface-raised text-accent shadow-[var(--card-shadow)]' : 'text-text-secondary hover:text-text'
    }`;

  return (
    <div className="space-y-8">
      <motion.header {...fade(0)} className="flex flex-col gap-1">
        <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{formatLongDate(new Date())}</div>
        <h1 className="mt-1.5 text-[34px] sm:text-[40px] font-semibold leading-[1.1] tracking-[-0.025em] text-text">
          Partner
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          Your private workspace with a fixed partner — share plans, focus together, and stay accountable.
        </p>
      </motion.header>

      <div className="flex flex-wrap gap-1 rounded-[14px] border border-border bg-surface-hover p-1 w-fit">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSectionChange(s.id)}
              aria-current={active ? 'page' : undefined}
              className={sectionClass(active)}
            >
              <Icon size={15} />
              {s.label}
              {s.id === 'chat' && unread > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <motion.section key={i} className={`${softCard} lg:col-span-6 animate-pulse`}>
              <div className="h-5 w-32 rounded bg-surface-hover" />
              <div className="mt-6 h-12 rounded-xl bg-surface-hover" />
              <div className="mt-3 h-12 rounded-xl bg-surface-hover" />
            </motion.section>
          ))}
        </div>
      ) : (
        <>
          {error && (
            <motion.div {...fade(0.05)} className="rounded-[16px] border border-danger/25 bg-danger/10 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <FiAlertCircle className="mt-0.5 shrink-0 text-danger" size={16} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-danger">{error}</p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-danger hover:opacity-80 transition-opacity"
                  >
                    <FiRefreshCw size={12} /> Retry
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {!overview ? (
            <motion.section {...fade(0.08)} className={softCard}>
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <span className="w-14 h-14 rounded-2xl bg-accent-muted flex items-center justify-center">
                  <FiUsers size={24} className="text-accent" />
                </span>
                <div>
                  <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-text">No partner configured</h2>
                  <p className="mt-2 max-w-md text-[13px] text-text-muted">
                    Your account is not part of a configured partnership yet. Partnerships are set up by an
                    administrator with <code className="rounded bg-surface-hover px-1.5 py-0.5 text-xs">npm run partner:seed</code>;
                    there is no invitation flow.
                  </p>
                </div>
              </div>
            </motion.section>
          ) : (
            <>
              {section === 'overview' && (
                <div className="space-y-6">
                  <motion.section {...fade(0.08)} className={softCard}>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-hover text-2xl font-semibold text-accent">
                          {overview.profile.displayName[0]?.toUpperCase() ?? 'P'}
                        </div>
                        <div>
                          <div className="text-[18px] font-semibold tracking-[-0.01em] text-text">
                            {overview.profile.displayName}
                          </div>
                          <div className="mt-0.5 text-[13px] text-text-muted">{overview.profile.email}</div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${statusLabel(presenceStatus).dot}`} />
                            <span className="text-xs text-text-secondary">
                              {statusLabel(presenceStatus).label}
                            </span>
                            {presenceSeen && (
                              <span className="text-[10px] text-text-muted">
                                · seen {relativeTime(presenceSeen)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-hover px-3 py-1.5 text-xs text-text-secondary">
                        <FiUsers size={13} className="text-accent" /> Connected partner
                      </div>
                    </div>
                  </motion.section>

                  <motion.section {...fade(0.12)} className={softCard}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Partner statistics</h2>
                        <p className="mt-1 text-[13px] text-text-muted">
                          Recent focus activity your partner shared with you.
                        </p>
                      </div>
                      {stats && !stats.privacyEnabled && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-hover px-3 py-1.5 text-[11px] text-text-muted">
                          <FiLock size={11} /> Statistics private
                        </span>
                      )}
                    </div>
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                          <div
                            key={card.label}
                            className="rounded-[14px] border border-border bg-surface-hover/60 px-4 py-3.5"
                          >
                            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-text-muted">
                              <Icon size={12} />
                              {card.label}
                            </div>
                            <div className="mt-1.5 text-[20px] font-semibold tracking-[-0.01em] text-text">
                              {card.value}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.section>

                  <motion.section {...fade(0.16)} className={softCard}>
                    <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">
                      {overview.profile.displayName}&rsquo;s shared plans
                    </h2>
                    <p className="mt-1 text-[13px] text-text-muted">
                      Personal plans your partner chose to share with you.
                    </p>
                    {overview.sharedPlans.length === 0 ? (
                      <p className="mt-6 text-sm text-text-muted">
                        {overview.privacy?.sharePlans === false
                          ? 'Your partner keeps their plans private.'
                          : 'Your partner hasn&rsquo;t shared any plans yet.'}
                      </p>
                    ) : (
                      <ul className="mt-4 divide-y divide-divider">
                        {overview.sharedPlans.map((plan) => (
                          <li key={plan.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                            <span className="w-9 h-9 shrink-0 rounded-xl bg-surface-hover flex items-center justify-center">
                              <FiTarget size={15} className="text-accent" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-medium text-text">{plan.title}</div>
                              <div className="text-[11px] text-text-muted">{plan.category}</div>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                              <FiClock size={11} /> {plan.date}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.section>
                </div>
              )}

              {section === 'plans' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-1 rounded-[14px] border border-border bg-surface-hover p-1 w-fit">
                    {(
                      [
                        { id: 'common', label: 'Common plans' },
                        { id: 'personal', label: 'Personal sharing' },
                      ] as const
                    ).map((scope) => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => setPlansScope(scope.id)}
                        aria-pressed={plansScope === scope.id}
                        className={sectionClass(plansScope === scope.id)}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>

                  {plansScope === 'common' ? (
                    <motion.section {...fade(0.08)} className={softCard}>
                      <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Common plans</h2>
                      <p className="mt-1 text-[13px] text-text-muted">
                        One shared plan document for both of you. Owner and editor can edit; only the owner can
                        delete. Edits are conflict-checked so you never overwrite each other silently.
                      </p>

                      <div className="mt-5 rounded-[14px] border border-border bg-surface-hover/60 p-4">
                        <div className="text-[13px] font-semibold text-text">New common plan</div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          <input
                            type="text"
                            value={commonTitle}
                            onChange={(e) => setCommonTitle(e.target.value)}
                            placeholder="Plan title"
                            className="sm:col-span-4 px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all"
                          />
                          <input
                            type="text"
                            value={commonCategory}
                            onChange={(e) => setCommonCategory(e.target.value)}
                            placeholder="Category (optional)"
                            className="sm:col-span-3 px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all"
                          />
                          <select
                            value={commonPriority}
                            onChange={(e) => setCommonPriority(e.target.value as PlanPriority)}
                            className="sm:col-span-2 px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-text text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                          <input
                            type="date"
                            value={commonDate}
                            onChange={(e) => setCommonDate(e.target.value)}
                            className="sm:col-span-3 px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-text text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all"
                          />
                          <button
                            type="button"
                            disabled={creating || !commonTitle.trim()}
                            onClick={() => void handleCreateCommonPlan()}
                            className="sm:col-span-12 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 h-10 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            <FiPlus size={15} /> Create common plan
                          </button>
                        </div>
                      </div>

                      {commonPlans.length === 0 ? (
                        <p className="mt-6 text-sm text-text-muted">
                          No common plans yet. Create your first one above — your partner will see it immediately.
                        </p>
                      ) : (
                        <ul className="mt-4 divide-y divide-divider">
                          {commonPlans.map((plan) => {
                            const isOwner = plan.memberRole === 'owner';
                            const pill = statusPill(plan.status);
                            return (
                              <li
                                key={plan.id}
                                className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                              >
                                <span className="w-9 h-9 shrink-0 rounded-xl bg-surface-hover flex items-center justify-center">
                                  <FiUsers size={15} className="text-accent" />
                                </span>
                                <div className="min-w-0 flex-1 basis-52">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-[14px] font-medium text-text">{plan.title}</span>
                                    <span
                                      className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                        isOwner
                                          ? 'border-accent/20 bg-accent-muted text-accent'
                                          : 'border-border bg-surface-hover text-text-muted'
                                      }`}
                                    >
                                      {isOwner ? 'Owner' : 'Editor'}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                    {plan.category ? <span>{plan.category}</span> : null}
                                    <span className="inline-flex items-center gap-1">
                                      <FiCalendar size={10} /> {plan.date}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${pill.cls}`}
                                >
                                  {pill.label}
                                </span>
                                <button
                                  type="button"
                                  disabled={planBusy !== null}
                                  onClick={() => void handleCycleCommonStatus(plan)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-hover/60 hover:bg-surface-hover px-2.5 h-8 text-xs font-semibold text-text-secondary transition-colors duration-150 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                                >
                                  <FiRefreshCw size={12} /> Advance
                                </button>
                                {isOwner && (
                                  <button
                                    type="button"
                                    disabled={planBusy !== null}
                                    onClick={() => void handleDeleteCommonPlan(plan)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-danger/25 bg-danger/10 hover:bg-danger/15 px-2.5 h-8 text-xs font-semibold text-danger transition-colors duration-150 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                                  >
                                    <FiTrash2 size={12} /> Delete
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </motion.section>
                  ) : (
                    <motion.section {...fade(0.08)} className={softCard}>
                      <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Plans you share</h2>
                      <p className="mt-1 text-[13px] text-text-muted">
                        Toggle which personal plans your partner can see.
                      </p>
                      {myPlans.length === 0 ? (
                        <p className="mt-6 text-sm text-text-muted">Create a plan first, then choose what to share.</p>
                      ) : (
                        <ul className="mt-4 divide-y divide-divider">
                          {myPlans.map((plan) => {
                            const shared = plan.visibility === 'partner_shared';
                            return (
                              <li key={plan.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                <span className="w-9 h-9 shrink-0 rounded-xl bg-surface-hover flex items-center justify-center">
                                  <FiTarget size={15} className="text-accent" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[14px] font-medium text-text">{plan.title}</div>
                                  <div className="text-[11px] text-text-muted">
                                    {shared ? 'Shared with partner' : 'Private to you'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleToggleShare(plan.id, plan.visibility)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none disabled:opacity-50 ${
                                    shared
                                      ? 'bg-danger/10 text-danger hover:bg-danger/15'
                                      : 'bg-accent/10 text-accent hover:bg-accent/15'
                                  }`}
                                >
                                  {shared ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                                  {shared ? 'Unshare' : 'Share'}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {mySharedPlans.length > 0 && (
                        <p className="mt-4 rounded-[12px] border border-border bg-surface-hover/50 px-3.5 py-2.5 text-xs text-text-secondary">
                          <FiUsers size={12} className="mr-1.5 inline text-accent" />
                          {mySharedPlans.length} of your plans are currently visible to{' '}
                          {overview.profile.displayName}.
                        </p>
                      )}
                    </motion.section>
                  )}
                </div>
              )}

              {section === 'focus' && (
                <motion.section {...fade(0.08)} className={softCard}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                        <FiZap size={18} className="text-accent" />
                      </span>
                      <div>
                        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Shared focus</h2>
                        <p className="text-[13px] text-text-muted">
                          Lock in focus sessions together. The timer is server-authoritative and stays in sync on
                          both dashboards.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FiWifi size={13} className="text-success" />
                      <span className="text-xs text-text-muted">Realtime active</span>
                    </div>
                  </div>

                  {!getPublicCloudEnabled() ? (
                    <p className="mt-6 text-sm text-text-muted">
                      Realtime shared focus requires MongoDB mode. Enable{' '}
                      <code className="rounded bg-surface-hover px-1.5 py-0.5 text-xs">NEXT_PUBLIC_MONGODB_ENABLED</code>{' '}
                      to use it.
                    </p>
                  ) : focusSession && focusSession.status !== 'ended' ? (
                    <div className="mt-6">
                      <div className="rounded-[16px] border border-accent/20 bg-accent-muted/30 px-6 py-8 text-center">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                          {focusSession.status === 'paused' ? 'Paused' : 'Focusing together'}
                        </div>
                        <div className="mt-2 text-[52px] sm:text-[64px] font-semibold tracking-tight text-text tabular-nums">
                          {formatRemaining(focusSession.status === 'running' ? remainingMs : pausedRemainingMs())}
                        </div>
                        <div className="mt-2 text-xs text-text-muted">
                          {focusSession.durationMinutes} min session · started with{' '}
                          {overview.profile.displayName}
                        </div>
                        {focusSession.status === 'paused' && (
                          <div className="mt-2 text-xs text-warning">Timer paused — resume to keep going.</div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                        {focusSession.status === 'running' ? (
                          <button
                            type="button"
                            disabled={focusBusy}
                            onClick={() => void runFocusAction('pause')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-hover/60 hover:bg-surface-hover px-4 h-10 text-[13px] font-semibold text-text transition-colors duration-150 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            <FiPause size={15} /> Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={focusBusy}
                            onClick={() => void runFocusAction('resume')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 h-10 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            <FiPlay size={15} /> Resume
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={focusBusy}
                          onClick={() => void runFocusAction('complete')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-success/25 bg-success/10 hover:bg-success/15 px-4 h-10 text-[13px] font-semibold text-success transition-colors duration-150 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <FiCheckCircle size={15} /> Complete
                        </button>
                        <button
                          type="button"
                          disabled={focusBusy}
                          onClick={() => void runFocusAction('cancel')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger/10 hover:bg-danger/15 px-4 h-10 text-[13px] font-semibold text-danger transition-colors duration-150 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <FiStopCircle size={15} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {[15, 25, 45, 60].map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => setFocusDuration(minutes)}
                            aria-pressed={focusDuration === minutes}
                            className={`inline-flex items-center rounded-xl border px-3.5 h-9 text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                              focusDuration === minutes
                                ? 'border-accent/30 bg-accent-muted text-accent'
                                : 'border-border bg-surface-hover/60 text-text-secondary hover:text-text'
                            }`}
                          >
                            {minutes} min
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={focusBusy}
                          onClick={() => void runFocusAction('start')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 h-10 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <FiPlay size={15} /> Start together
                        </button>
                      </div>
                      <p className="mt-4 text-xs text-text-muted">
                        Starting a session sets both of you to &ldquo;focusing&rdquo; and records completed focus
                        minutes for each partner when you finish.
                      </p>
                    </div>
                  )}
                </motion.section>
              )}

              {section === 'activity' && (
                <motion.section {...fade(0.08)} className={softCard}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-text">Shared activity</h2>
                      <p className="mt-1 text-[13px] text-text-muted">
                        Completed focus sessions you and your partner finished together.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadActivity()}
                      disabled={activityLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-hover/60 px-3 h-9 text-[13px] font-semibold text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <FiRefreshCw size={13} className={activityLoading ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>

                  {activityError && (
                    <div className="mt-4 rounded-[14px] border border-danger/25 bg-danger/10 px-4 py-3 text-[13px] text-danger">
                      {activityError}
                    </div>
                  )}

                  <div className="mt-5">
                    {activityLoading && activityItems.length === 0 ? (
                      <div className="flex h-40 items-center justify-center">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      </div>
                    ) : activityItems.length === 0 ? (
                      <div className="flex h-40 flex-col items-center justify-center text-center">
                        <FiActivity size={22} className="text-text-faint" />
                        <p className="mt-2 text-[13px] text-text-muted">
                          No shared focus sessions yet. Start a focus session together to see it here.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-divider overflow-hidden rounded-[16px] border border-border">
                        {activityItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-3.5 px-4 py-3.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted/40 text-accent">
                              <FiZap size={17} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-text">{item.title}</p>
                              <p className="truncate text-xs text-text-muted">{item.subtitle}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[13px] font-semibold text-text tabular-nums">
                                {item.minutes}m
                              </div>
                              <div className="text-[11px] text-text-muted">{relativeTime(item.createdAt)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activityHasMore && (
                      <div
                        ref={(node) => {
                          if (!node) return;
                          const observer = new IntersectionObserver(
                            (entries) => {
                              if (entries[0]?.isIntersecting && !activityLoading) {
                                void loadMoreActivity();
                              }
                            },
                            { rootMargin: '320px 0px' },
                          );
                          observer.observe(node);
                          setTimeout(() => observer.disconnect(), 4000);
                        }}
                        className="mt-4 h-px"
                        aria-hidden
                      />
                    )}

                    {!activityHasMore && activityItems.length > ACTIVITY_PAGE_SIZE && (
                      <div className="mt-4 flex items-center justify-center gap-2 py-1 text-xs text-text-muted">
                        <FiCheckCircle size={13} className="shrink-0" />
                        <span>You&rsquo;ve reached the end of your shared activity.</span>
                      </div>
                    )}
                  </div>
                </motion.section>
              )}

              {section === 'chat' && (
                <motion.section {...fade(0.08)} className={`${softCard} flex h-[560px] flex-col`}>
                  <div className="flex items-center justify-between gap-3 border-b border-divider pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                        <FiMessageSquare size={18} className="text-accent" />
                      </span>
                      <div>
                        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">Private chat</h2>
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                          <span
                            className={`h-2 w-2 rounded-full ${statusLabel(presenceStatus).dot}`}
                          />
                          {statusLabel(presenceStatus).label} · {partnerName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface-hover/60 px-3 h-9 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 ${
                          myPrivacy?.shareSnapshots === false || uploadingSnapshot
                            ? 'pointer-events-none opacity-40'
                            : 'hover:text-text'
                        }`}
                        title={
                          myPrivacy?.shareSnapshots === false
                            ? 'Snapshot sharing is disabled in Partner privacy.'
                            : 'Share a snapshot'
                        }
                      >
                        {uploadingSnapshot ? (
                          <FiRefreshCw size={14} className="animate-spin" />
                        ) : (
                          <FiImage size={14} />
                        )}
                        Upload snapshot
                        <input
                          type="file"
                          accept="image/*"
                          disabled={myPrivacy?.shareSnapshots === false || uploadingSnapshot || !getPublicCloudEnabled()}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleUploadSnapshot(file, null);
                            e.currentTarget.value = '';
                          }}
                          className="sr-only"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={openSnapshots}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-hover/60 px-3 h-9 text-[13px] font-medium text-text-secondary hover:text-text transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <FiImage size={14} /> Snapshots
                      </button>
                      {planShareOpen ? (
                        <div className="relative">
                          <div className="absolute right-0 top-9 z-20 w-72 rounded-[16px] border border-border bg-surface shadow-xl shadow-black/5 p-2">
                            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                              Share a plan with {partnerName.split(' ')[0]}
                            </p>
                            <div className="max-h-52 space-y-1 overflow-y-auto">
                              {visiblePlans.length === 0 && (
                                <p className="px-2 py-2 text-xs text-text-muted">
                                  No visible common plans to share yet.
                                </p>
                              )}
                              {visiblePlans.map((plan) => (
                                <button
                                  key={plan.id}
                                  type="button"
                                  disabled={sending}
                                  onClick={() => void handleSharePlan(plan)}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-hover/60 transition-colors disabled:opacity-50"
                                >
                                  <FiLink size={13} className="shrink-0 text-text-muted" />
                                  <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                                    {plan.title}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPlanShareOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-hover/60 px-3 h-9 text-[13px] font-medium text-text-secondary hover:text-text transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <FiLink size={14} /> Share a plan
                        </button>
                      )}
                    </div>
                  </div>

                  <div ref={scrollRef} onScroll={handleChatScroll} className="flex-1 space-y-2 overflow-y-auto py-4 pr-1">
                    {!chatLoading && messages.length > 0 && (
                      <div className="flex justify-center">
                        {chatLoadingOlder ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface-hover/40 px-3 py-1 text-[11px] text-text-muted">
                            <FiRefreshCw size={11} className="animate-spin" /> Loading earlier messages…
                          </span>
                        ) : chatOlderError ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-danger/25 bg-danger/10 px-3 py-1 text-[11px] text-danger">
                            <FiAlertCircle size={11} /> Couldn&rsquo;t load earlier messages.
                            <button
                              type="button"
                              onClick={() => void loadOlderMessages()}
                              className="font-semibold underline underline-offset-2 hover:opacity-80"
                            >
                              Retry
                            </button>
                          </span>
                        ) : !chatHasOlder ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface-hover/40 px-3 py-1 text-[11px] text-text-muted">
                            <FiCheckCircle size={11} /> You&rsquo;ve reached the start of the conversation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] text-text-faint">
                            <FiClock size={11} /> Scroll up for earlier messages
                          </span>
                        )}
                      </div>
                    )}
                    {chatLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <FiMessageSquare size={22} className="text-text-faint" />
                        <p className="mt-2 text-[13px] text-text-muted">
                          No messages yet — say hello to {partnerName.split(' ')[0]}.
                        </p>
                      </div>
                    ) : (
                      messages.map((m) => {
                        if (m.type === 'system') {
                          return (
                            <div key={m.id} className="flex justify-center py-2">
                              <span className="rounded-full border border-divider bg-surface-hover/40 px-3 py-1 text-[11px] text-text-muted">
                                {m.body}
                              </span>
                            </div>
                          );
                        }
                        const mine = m.senderId === userId;
                        const isPlan = m.type === 'plan_reference';
                        const isImage = m.type === 'image';
                        return (
                          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                                mine
                                  ? 'rounded-br-md bg-accent text-white'
                                  : 'rounded-bl-md border border-border bg-surface-hover/50 text-text'
                              }`}
                            >
                              {isImage ? (
                                <div className="space-y-1.5">
                                  {m.mediaId ? (
                                    <img
                                      src={`/api/media/${m.mediaId}`}
                                      alt={m.body ?? 'Shared snapshot'}
                                      loading="lazy"
                                      className={`max-h-56 w-auto max-w-[240px] rounded-lg object-contain ${
                                        m.mediaStatus === 'exported_and_removed' ? 'opacity-40 grayscale' : ''
                                      }`}
                                    />
                                  ) : (
                                    <FiImage size={36} className="text-text-faint" />
                                  )}
                                  {m.body ? (
                                    <p className="text-[13px] leading-snug break-words">{m.body}</p>
                                  ) : null}
                                  {m.mediaStatus === 'exported_and_removed' && (
                                    <p className="text-[11px] text-text-muted">Exported and removed</p>
                                  )}
                                </div>
                              ) : isPlan ? (
                                <div>
                                  <p
                                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                                      mine ? 'text-white/70' : 'text-text-muted'
                                    }`}
                                  >
                                    Shared a plan
                                  </p>
                                  <p className="mt-0.5 text-[13px] font-medium">{m.body}</p>
                                </div>
                              ) : (
                                <p className="text-[13.5px] leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                              )}
                              <div
                                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                  mine ? 'text-white/60' : 'text-text-faint'
                                }`}
                              >
                                <span>{timeLabel(m.createdAt)}</span>
                                {mine && (
                                  <span className="inline-flex items-center gap-0.5" aria-label={m.delivery === 'sending' ? 'Sending' : m.readAt ? 'Read' : 'Delivered'}>
                                    {m.delivery === 'sending' ? (
                                      <FiRefreshCw size={11} className="animate-spin" aria-hidden />
                                    ) : m.readAt ? (
                                      <FiCheckCircle size={12} aria-hidden />
                                    ) : (
                                      <FiCheck size={12} aria-hidden />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {partnerTyping && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-md border border-border bg-surface-hover/50 px-3.5 py-2.5 text-[12.5px] text-text-muted">
                          {partnerName.split(' ')[0]} is typing…
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-divider pt-3">
                    <input
                      value={chatInput}
                      onChange={(e) => handleChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder={`Message ${partnerName.split(' ')[0]}`}
                      disabled={sending}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-hover/40 px-3.5 text-[13.5px] text-text placeholder:text-text-faint outline-none focus:border-accent/50 focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={sending || !chatInput.trim()}
                      onClick={() => void handleSendMessage()}
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <FiSend size={15} /> Send
                    </button>
                  </div>
                </motion.section>
              )}

              {snapshotsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setSnapshotsOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="snapshots-dialog-title"
                    className="relative z-10 w-full max-w-3xl flex flex-col rounded-[22px] border border-border bg-surface shadow-2xl shadow-black/20 max-h-[85vh]"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-divider px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center">
                          <FiImage size={16} className="text-accent" />
                        </span>
                        <div>
                          <h2 id="snapshots-dialog-title" className="text-[16px] font-semibold tracking-[-0.01em] text-text">
                            Shared snapshots
                          </h2>
                          <p className="text-xs text-text-muted">
                            Pick snapshots, export them as a ZIP, then remove after a verified export.
                          </p>
                        </div>
                      </div>
                      <button
                        ref={snapshotsCloseRef}
                        type="button"
                        onClick={() => setSnapshotsOpen(false)}
                        aria-label="Close snapshots"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-hover/60 text-text-secondary hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <FiX size={16} />
                      </button>
                    </div>

                    {(snapshotError || snapshotNotice) && (
                      <div
                        className={`border-b px-6 py-2.5 text-xs ${
                          snapshotError ? 'border-danger/25 bg-danger/10 text-danger' : 'border-border bg-accent-muted/20 text-text-secondary'
                        }`}
                        role={snapshotError ? 'alert' : 'status'}
                        aria-live="polite"
                      >
                        {snapshotError ?? snapshotNotice}
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-5">
                      {snapshotsLoading && snapshots.length === 0 ? (
                        <div className="flex h-48 items-center justify-center">
                          <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        </div>
                      ) : snapshots.length === 0 ? (
                        <div className="flex h-44 flex-col items-center justify-center text-center">
                          <FiImage size={22} className="text-text-faint" />
                          <p className="mt-2 text-[13px] text-text-muted">
                            No snapshots shared yet. Upload one from the chat.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {snapshots.map((item) => {
                            const selected = snapshotSelection.has(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleSnapshotSelection(item.id)}
                                aria-pressed={selected}
                                aria-label={`Toggle snapshot from ${item.senderName}, ${item.createdAt}`}
                                className={`group relative aspect-square overflow-hidden rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-focus-ring transition-colors ${
                                  selected ? 'border-accent ring-2 ring-accent/40' : 'border-border hover:border-accent/40'
                                }`}
                              >
                                {item.url ? (
                                  <img
                                    src={item.url}
                                    alt={item.caption ?? `Snapshot by ${item.senderName}`}
                                    loading="lazy"
                                    className={`h-full w-full object-cover ${item.status === 'exported_and_removed' ? 'opacity-40 grayscale' : ''}`}
                                  />
                                ) : (
                                  <FiImage size={28} className="mx-auto mt-10 text-text-faint" />
                                )}
                                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-6 text-left">
                                  <span className="block truncate text-[11px] font-medium text-white">
                                    {item.senderName}
                                  </span>
                                  <span className="block text-[10px] text-white/80">
                                    {timeLabel(item.createdAt)}
                                    {item.status === 'exported_and_removed' ? ' · removed' : item.exported ? ' · exported' : ''}
                                  </span>
                                </span>
                                <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-black/40 text-white">
                                  {selected ? <FiCheckSquare size={14} /> : <FiSquare size={14} />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {snapshotsHasMore && (
                        <div
                          ref={(node) => {
                            if (!node) return;
                            const observer = new IntersectionObserver(
                              (entries) => {
                                if (entries[0]?.isIntersecting && !snapshotsLoading) {
                                  void loadSnapshots(snapshotCursor);
                                }
                              },
                              { rootMargin: '320px 0px' },
                            );
                            observer.observe(node);
                            setTimeout(() => observer.disconnect(), 4000);
                          }}
                          className="mt-4 h-px"
                          aria-hidden
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-6 py-4">
                      <div className="text-xs text-text-muted">
                        {snapshotSelection.size} selected
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={snapshotSelection.size === 0 || exportingSnapshots}
                          onClick={() => void handleExportSnapshots()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent-muted/20 px-3.5 h-9 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-muted/40 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <FiDownload size={14} />
                          {exportingSnapshots ? 'Exporting…' : 'Export ZIP'}
                        </button>
                        <button
                          type="button"
                          disabled={snapshotSelection.size === 0 || removingSnapshots}
                          onClick={() => void handleRemoveSnapshots()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger/10 px-3.5 h-9 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/15 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <FiTrash2 size={14} />
                          {removingSnapshots ? 'Removing…' : 'Remove after export'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
