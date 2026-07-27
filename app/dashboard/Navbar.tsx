'use client';

import { FiHome, FiPieChart, FiList, FiUser, FiBell, FiZap, FiLogOut, FiClock } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/src/components/ThemeToggle';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: string | null;
}

export default function Navbar({ activeTab, setActiveTab, user }: NavbarProps) {
  const router = useRouter();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiHome },
    { id: 'sessions', label: 'Sessions', icon: FiClock },
    { id: 'stats', label: 'Statistics', icon: FiPieChart },
    { id: 'plans', label: 'Plans', icon: FiList },
    { id: 'profile', label: 'Profile', icon: FiUser },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('user');
    router.push('/');
  };

  return (
    <nav aria-label="Main navigation" className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <FiZap className="text-black text-sm" />
            </div>
            <span className="text-lg font-bold text-text hidden sm:inline">Productivity</span>
          </div>

          <div role="tablist" aria-label="Dashboard tabs" className="flex items-center gap-1 bg-page rounded-xl p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-accent text-white' : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            <button className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-all relative">
              <FiBell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
            </button>

            <div className="flex items-center gap-3 pl-3 border-l border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold text-text">
                  {user?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium hidden sm:inline text-text">{user || 'User'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-text-secondary hover:text-danger hover:bg-danger-muted transition-all"
                title="Sign Out"
              >
                <FiLogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
