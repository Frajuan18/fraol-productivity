'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FiHome,
  FiClock,
  FiPieChart,
  FiList,
  FiUser,
  FiZap,
  FiBell,
  FiLogOut,
  FiPlus,
  FiTarget,
  FiSidebar,
  FiMenu,
  FiX,
  FiSun,
  FiMoon,
  FiChevronDown,
  FiChevronUp,
  FiUsers,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { useTheme } from '@/src/contexts/ThemeContext';
import { getPublicCloudEnabled } from '@/lib/config';
import { getRepository } from '@/lib/repositories/repository';

const DEMO_USER_ID = 'demo-user';

function statusLabel(status: string): { label: string; dot: string } {
  switch (status) {
    case 'online':
      return { label: 'Online', dot: 'bg-success' };
    case 'focusing':
      return { label: 'Focusing', dot: 'bg-warning' };
    default:
      return { label: 'Offline', dot: 'bg-text-muted' };
  }
}

interface SubItem {
  id: string;
  label: string;
  icon: IconType;
}

interface NavItem {
  id: string;
  label: string;
  icon: IconType;
  sub?: SubItem[];
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  sessionsSub: 'new' | 'history';
  onSessionsSubChange: (sub: 'new' | 'history') => void;
  plansSection: 'plans' | 'history';
  onPlansSectionChange: (section: 'plans' | 'history') => void;
  partnerName?: string | null;
  partnerStatus?: string | null;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Main',
    items: [
      { id: 'overview', label: 'Overview', icon: FiHome },
      {
        id: 'sessions',
        label: 'Sessions',
        icon: FiClock,
        sub: [
          { id: 'new', label: 'New Session', icon: FiPlus },
          { id: 'history', label: 'History', icon: FiList },
        ],
      },
      { id: 'stats', label: 'Statistics', icon: FiPieChart },
    ],
  },
  {
    label: 'Planning',
    items: [
      {
        id: 'plans',
        label: 'Plans',
        icon: FiList,
        sub: [
          { id: 'plans', label: 'Plans', icon: FiTarget },
          { id: 'history', label: 'History', icon: FiList },
        ],
      },
    ],
  },
  {
    label: 'Personal',
    items: [
      { id: 'profile', label: 'Profile', icon: FiUser },
      { id: 'partner', label: 'Partner', icon: FiUsers },
    ],
  },
];

function Avatar({ user, size }: { user: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  const initial = user?.[0]?.toUpperCase() || 'U';

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-border bg-surface-hover"
      style={{ width: size, height: size }}
    >
      {failed ? (
        <div
          className="flex h-full w-full items-center justify-center bg-accent-muted text-accent"
          style={{ fontSize: size * 0.42 }}
        >
          <span className="font-semibold">{initial}</span>
        </div>
      ) : (
        <Image
          src="/images/profile.png"
          alt="Profile avatar"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

interface SidebarContentProps {
  variant: 'desktop' | 'mobile';
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: () => void;
  sessionsSub: 'new' | 'history';
  onSessionsSubChange: (sub: 'new' | 'history') => void;
  plansSection: 'plans' | 'history';
  onPlansSectionChange: (section: 'plans' | 'history') => void;
  partnerName?: string | null;
  partnerStatus?: string | null;
}

function SidebarContent({
  variant,
  activeTab,
  setActiveTab,
  user,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  sessionsSub,
  onSessionsSubChange,
  plansSection,
  onPlansSectionChange,
  partnerName,
  partnerStatus,
}: SidebarContentProps) {
  const router = useRouter();
  const isCollapsed = variant === 'desktop' && collapsed;
  const isDesktop = variant === 'desktop';

  const subMap: Record<string, { active: string; onChange: (v: string) => void }> = {
    sessions: { active: sessionsSub, onChange: (v) => onSessionsSubChange(v as 'new' | 'history') },
    plans: { active: plansSection, onChange: (v) => onPlansSectionChange(v as 'plans' | 'history') },
  };

  const handleLogout = () => {
    if (getPublicCloudEnabled()) {
      void fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    }
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('user');
    router.push('/');
  };

  const itemClass = (isActive: boolean) =>
    `group relative flex h-9 w-full items-center rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
      isCollapsed ? 'justify-center' : 'gap-2.5 px-2.5 text-[13.5px]'
    } ${
      isActive
        ? 'bg-surface-hover font-medium text-text'
        : 'font-normal text-text-secondary hover:bg-surface-hover/60 hover:text-text'
    }`;

  const tooltip = (label: string) => (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] font-medium text-text opacity-0 shadow-[var(--card-shadow)] transition-all delay-0 duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-500 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
      {label}
    </span>
  );

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-14 shrink-0 items-center ${
          isCollapsed ? 'flex-col justify-center gap-2 px-0' : 'justify-between pl-4 pr-3'
        }`}
      >
        <div className={`flex min-w-0 items-center ${isCollapsed ? '' : 'gap-3'}`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast">
            <FiZap size={14} />
          </div>
          {!isCollapsed && (
            <button
              onClick={onToggleCollapsed}
              aria-label="Workspace"
              className="flex min-w-0 items-center gap-1.5 rounded-lg py-1 pr-2 outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span className="truncate text-[15px] font-medium tracking-[-0.01em] text-text">Frabit</span>
              <span className="flex shrink-0 flex-col leading-[0] text-text-muted">
                <FiChevronUp size={11} />
                <FiChevronDown size={11} className="-mt-[3px]" />
              </span>
            </button>
          )}
        </div>
        {isDesktop && (
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <FiSidebar size={18} />
          </button>
        )}
        {variant === 'mobile' && (
          <button
            data-close
            onClick={onNavigate}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <FiX size={20} />
          </button>
        )}
      </div>

      <nav
        aria-label="Main navigation"
        className={`flex-1 ${isCollapsed ? 'px-2 pb-3 pt-2' : 'overflow-y-auto px-3 pb-3 pt-0'}`}
      >
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={isCollapsed ? 'mt-4 first:mt-0' : ''}>
            {!isCollapsed && (
              <div
                className={`px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted ${
                  gi === 0 ? 'pt-0.5' : 'pt-5'
                }`}
              >
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const subActive = item.sub ? subMap[item.id]?.active : null;

                return (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => {
                        setActiveTab(item.id);
                        onNavigate();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={itemClass(isActive)}
                    >
                      <span className="flex w-5 shrink-0 items-center justify-center">
                        <Icon size={16} />
                      </span>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                      {isCollapsed && tooltip(item.label)}
                    </button>

                    {item.sub && !isCollapsed && (
                      <div className="pb-0.5 pt-0">
                        {item.sub.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = subActive === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setActiveTab(item.id);
                                subMap[item.id].onChange(sub.id);
                                onNavigate();
                              }}
                              aria-current={isSubActive ? 'true' : undefined}
                              className={`flex h-8 w-full items-center gap-2.5 rounded-lg pl-9 pr-3 text-[13px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                                isSubActive
                                  ? 'font-medium text-text'
                                  : 'font-normal text-text-muted hover:bg-surface-hover hover:text-text'
                              }`}
                            >
                              <SubIcon size={13} className="shrink-0 opacity-80" />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0">
        <div
          className={
            isCollapsed
              ? 'flex flex-col items-center gap-1 px-2 pb-3 pt-3'
              : 'flex items-center justify-between px-4 pb-3 pt-1'
          }
        >
          {isDesktop && (
            <button
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <FiSidebar size={16} />
            </button>
          )}
          <div className={isCollapsed ? 'flex flex-col items-center gap-1' : 'flex items-center gap-0.5'}>
            {!isDesktop && <ThemeToggle />}
            <button
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <FiBell size={16} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
            </button>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign Out"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors duration-150 hover:bg-danger-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <FiLogOut size={16} />
            </button>
          </div>
        </div>

        <div className={isCollapsed ? 'px-2 pb-4' : 'px-4 pb-4'}>
          {partnerName && (
            <button
              onClick={() => {
                setActiveTab('partner');
                onNavigate();
              }}
              title="Open partner workspace"
              className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <span
                className="relative flex shrink-0 items-center justify-center rounded-full bg-accent-muted font-semibold text-accent"
                style={{ width: isCollapsed ? 32 : 28, height: isCollapsed ? 32 : 28 }}
              >
                <span className="text-[13px]">{partnerName[0]?.toUpperCase() ?? 'P'}</span>
                {partnerStatus && (
                  <span
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${statusLabel(partnerStatus).dot}`}
                  />
                )}
              </span>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-text">{partnerName}</div>
                  <div className="truncate text-[11px] text-text-muted">
                    {partnerStatus ? statusLabel(partnerStatus).label : 'Offline'} · partner
                  </div>
                </div>
              )}
            </button>
          )}
          <button
            onClick={() => {
              setActiveTab('profile');
              onNavigate();
            }}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <Avatar user={user} size={isCollapsed ? 36 : 32} />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-text">{user || 'User'}</div>
                <div className="truncate text-[11px] text-text-muted">View profile</div>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  collapsed,
  onToggleCollapsed,
  sessionsSub,
  onSessionsSubChange,
  plansSection,
  onPlansSectionChange,
  partnerName,
  partnerStatus,
}: SidebarProps) {
  const reduced = useReducedMotion();
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === 'dark' ? '/images/logo dark (1).png' : '/images/logo light (2).png';
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [islandOpen, setIslandOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 12);
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; status: string } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);

  const handleIslandLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('user');
    router.push('/');
  };

  const closeMobile = () => {
    setMobileOpen(false);
    menuBtnRef.current?.focus();
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusables = drawer.querySelectorAll<HTMLElement>('button:not([disabled])');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    drawer.addEventListener('keydown', onKey);
    return () => drawer.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!islandOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setIslandOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIslandOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [islandOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let uid = DEMO_USER_ID;
        if (getPublicCloudEnabled()) {
          const meResponse = await fetch('/api/auth/me');
          const me = (await meResponse.json()) as { ok: boolean; user?: { id: string } | null };
          if (!me.ok || !me.user) return;
          uid = me.user.id;
        }
        const overview = await getRepository().getPartnerOverview(uid);
        if (cancelled || !overview) return;
        setPartnerInfo({ name: overview.profile.displayName, status: overview.profile.status });
      } catch {
        // The partner chip simply stays hidden when no configured partner is available.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const contentProps = {
    activeTab,
    setActiveTab,
    user,
    collapsed,
    onToggleCollapsed,
    sessionsSub,
    onSessionsSubChange,
    plansSection,
    onPlansSectionChange,
    partnerName: partnerInfo?.name ?? partnerName ?? null,
    partnerStatus: partnerInfo?.status ?? partnerStatus ?? null,
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-divider bg-page px-4 lg:hidden">
        <button
          ref={menuBtnRef}
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <FiMenu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Image src={logoSrc} alt="Frabit logo" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-text">Productivity</span>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <ThemeToggle />
          <button
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <FiBell size={17} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
          </button>
        </div>
      </header>

      <aside className="sticky top-0 hidden h-screen w-[72px] shrink-0 flex-col items-center py-5 lg:flex">
        <button
          onClick={() => setActiveTab('overview')}
          aria-label="Frabit home"
          className="group/logo relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Image src={logoSrc} alt="Frabit logo" width={40} height={40} className="h-10 w-10 object-contain" priority />
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] font-medium text-text opacity-0 shadow-[var(--card-shadow)] transition-all duration-150 group-hover/logo:translate-x-0 group-hover/logo:opacity-100 group-hover/logo:delay-300">
            Frabit
          </span>
        </button>
        <div className="flex flex-1 items-center">
          <nav
            aria-label="Main navigation"
            className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface/80 px-1.5 py-3 shadow-[var(--card-shadow)] backdrop-blur-xl"
          >
            {NAV_GROUPS.map((group, gi) => (
              <Fragment key={group.label}>
                {gi > 0 && <span className="my-1.5 h-px w-5 bg-border" aria-hidden />}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="group relative">
                      <button
                        onClick={() => setActiveTab(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.label}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring ${
                          isActive
                            ? 'bg-surface-hover text-text'
                            : 'text-text-secondary hover:bg-surface-hover/60 hover:text-text'
                        }`}
                      >
                        <Icon size={20} />
                      </button>
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] font-medium text-text opacity-0 shadow-[var(--card-shadow)] transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-300 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </nav>
        </div>
      </aside>

      <div ref={islandRef} className="fixed right-4 top-4 z-50 hidden lg:block">
        <div
          className={`relative flex items-center gap-1 rounded-full border py-1.5 pl-1.5 pr-1 transition-all duration-300 ${
            scrolled
              ? 'border-border/60 bg-surface/55 shadow-[var(--card-shadow-hover)] backdrop-blur-xl'
              : 'border-border bg-surface shadow-[var(--card-shadow)]'
          }`}
        >
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
          </button>
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <button
            onClick={() => setIslandOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={islandOpen}
            aria-label="Account menu"
            className="flex h-8 items-center gap-1.5 rounded-full pr-1 outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Avatar user={user} size={26} />
            <span className="hidden max-w-[110px] truncate text-[13px] font-medium text-text xl:block">
              {user || 'User'}
            </span>
            <FiChevronDown
              size={13}
              className={`shrink-0 text-text-muted transition-transform duration-200 ${islandOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {islandOpen && (
              <motion.div
                role="menu"
                aria-label="Account"
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }}
                className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-border/70 bg-surface/85 shadow-[var(--card-shadow-hover)] backdrop-blur-2xl"
              >
                <div className="flex items-center gap-3 border-b border-border/60 px-3.5 py-3">
                  <Avatar user={user} size={36} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-text">{user || 'User'}</div>
                    <div className="truncate text-[11px] text-text-muted">Frabit · Focus workspace</div>
                  </div>
                </div>
                <div className="p-1.5">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setActiveTab('profile');
                      setIslandOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-text outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <FiUser size={15} className="text-text-secondary" />
                    Profile
                  </button>
                  <button
                    role="menuitem"
                    onClick={handleIslandLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-danger outline-none transition-colors duration-150 hover:bg-danger-muted focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <FiLogOut size={15} />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-overlay lg:hidden"
              onClick={closeMobile}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
            />
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="fixed inset-y-0 left-0 z-[70] w-[280px] bg-page shadow-[var(--card-shadow-hover)] lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'tween', duration: reduced ? 0 : 0.28, ease: [0.32, 0.72, 0, 1] }}
            >
              <SidebarContent variant="mobile" {...contentProps} onNavigate={closeMobile} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
