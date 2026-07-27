'use client';

import { useState, useEffect } from 'react';
import {
  FiTarget,
  FiCheckCircle,
  FiClock,
  FiPlus,
  FiList,
  FiCalendar,
  FiTrendingUp,
  FiAward,
  FiXCircle,
  FiRefreshCw,
  FiArrowRight,
  FiArrowLeft,
  FiEdit2,
  FiFlag,
  FiTag,
  FiBriefcase,
  FiUser,
  FiHeart,
  FiBook,
  FiDroplet,
  FiAlertCircle,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { Plan } from './types';

interface TabPlansProps {
  plans: Plan[];
  onAddPlan: (plan: Omit<Plan, 'id' | 'status' | 'date'>) => void;
  onUpdatePlan: (id: number, status: 'completed' | 'in-progress' | 'pending' | 'not-started') => void;
  onDeletePlan: (id: number) => void;
}

const tabAnimation = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const categories = [
  { id: 'Work', icon: FiBriefcase },
  { id: 'Personal', icon: FiUser },
  { id: 'Health', icon: FiHeart },
  { id: 'Learning', icon: FiBook },
  { id: 'Fitness', icon: FiDroplet },
  { id: 'Other', icon: FiTag },
];

const priorities = [
  { id: 'high', label: 'High Priority' },
  { id: 'medium', label: 'Medium Priority' },
  { id: 'low', label: 'Low Priority' },
];

const planTypes = [
  { id: 'daily', label: 'Daily', description: 'Plan for today' },
  { id: 'weekly', label: 'Weekly', description: 'Plan for the week' },
  { id: 'monthly', label: 'Monthly', description: 'Plan for the month' },
];

const formSteps = [
  { title: "What's your plan?", desc: 'Give it a clear title', icon: FiTarget },
  { title: 'Add details', desc: 'Describe the plan', icon: FiEdit2 },
  { title: 'Choose timeline', desc: 'Daily / Weekly / Monthly', icon: FiCalendar },
  { title: 'Set priority & category', desc: 'Importance and category', icon: FiFlag },
];

export default function TabPlans({ plans, onAddPlan, onUpdatePlan, onDeletePlan }: TabPlansProps) {
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'in-progress' | 'pending' | 'not-started'>(
    'all',
  );

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const [formStep, setFormStep] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'daily' as 'daily' | 'weekly' | 'monthly',
    priority: 'medium' as 'high' | 'medium' | 'low',
    category: 'Work',
  });

  const today = new Date().toISOString().split('T')[0];
  const todayPlans = plans.filter((p) => p.date === today);
  const historyPlans = plans.filter((p) => p.date !== today);

  const stats = {
    total: todayPlans.length,
    completed: todayPlans.filter((p) => p.status === 'completed').length,
    inProgress: todayPlans.filter((p) => p.status === 'in-progress').length,
    pending: todayPlans.filter((p) => p.status === 'pending').length,
    notStarted: todayPlans.filter((p) => p.status === 'not-started').length,
  };

  const historyStats = {
    total: historyPlans.length,
    completed: historyPlans.filter((p) => p.status === 'completed').length,
    inProgress: historyPlans.filter((p) => p.status === 'in-progress').length,
    pending: historyPlans.filter((p) => p.status === 'pending').length,
    notStarted: historyPlans.filter((p) => p.status === 'not-started').length,
  };

  const filteredHistoryPlans = historyPlans.filter((p) => {
    if (historyFilter === 'all') return true;
    return p.status === historyFilter;
  });

  function handleCreate() {
    if (formData.title.trim()) {
      onAddPlan(formData);
      setToast(`"${formData.title}" added successfully`);
      setFormData({ title: '', description: '', type: 'daily', priority: 'medium', category: 'Work' });
      setFormStep(0);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-muted text-success border-[var(--success)]/30';
      case 'in-progress':
        return 'bg-warning-muted text-warning border-[var(--warning)]/30';
      case 'pending':
        return 'bg-accent-muted text-info border-[var(--info)]/30';
      case 'not-started':
        return 'bg-surface-hover text-text-secondary border-text-muted';
      default:
        return 'bg-surface-hover text-text-secondary border-border-hover';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="text-success" size={14} />;
      case 'in-progress':
        return <FiRefreshCw className="text-warning" size={14} />;
      case 'pending':
        return <FiClock className="text-info" size={14} />;
      case 'not-started':
        return <FiXCircle className="text-text-secondary" size={14} />;
      default:
        return <FiClock className="text-text-secondary" size={14} />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-danger-muted text-danger border-[var(--danger)]/30';
      case 'medium':
        return 'bg-warning-muted text-warning border-[var(--warning)]/30';
      case 'low':
        return 'bg-accent-muted text-info border-[var(--info)]/30';
      default:
        return 'bg-surface-hover text-text-secondary border-border-hover';
    }
  };

  const historyFilters = [
    { id: 'all', label: 'All', icon: FiList },
    { id: 'completed', label: 'Completed', icon: FiCheckCircle },
    { id: 'in-progress', label: 'In Progress', icon: FiRefreshCw },
    { id: 'pending', label: 'Pending', icon: FiClock },
    { id: 'not-started', label: 'Not Started', icon: FiXCircle },
  ];

  function renderFormStep() {
    switch (formStep) {
      case 0:
        return (
          <div className="space-y-3">
            <label className="text-xs text-text-secondary">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Complete project proposal"
              className="w-full px-4 py-3 bg-surface-hover border border-border-hover rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:border-border-hover transition-all"
              autoFocus
            />
            <div className="flex justify-between text-xs text-text-muted">
              <span>Minimum 3 characters</span>
              <span>{formData.title.length}/100</span>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-3">
            <label className="text-xs text-text-secondary">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this plan involve?"
              className="w-full px-4 py-3 bg-surface-hover border border-border-hover rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:border-border-hover transition-all resize-none h-24"
            />
          </div>
        );
      case 2:
        return (
          <div className="grid grid-cols-3 gap-3">
            {planTypes.map((type) => {
              const isSelected = formData.type === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setFormData({ ...formData, type: type.id as 'daily' | 'weekly' | 'monthly' })}
                  className={`p-4 rounded-xl border transition-all text-center ${
                    isSelected ? 'border-accent bg-accent-muted' : 'border-border-hover hover:border-border'
                  }`}
                >
                  <FiCalendar className={`mx-auto ${isSelected ? 'text-text' : 'text-text-secondary'}`} size={24} />
                  <div className={`text-xs font-medium mt-2 ${isSelected ? 'text-text' : 'text-text-secondary'}`}>
                    {type.label}
                  </div>
                  <div className="text-[10px] text-text-muted mt-1">{type.description}</div>
                </button>
              );
            })}
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <label className="text-xs text-text-secondary block mb-2">Priority Level</label>
              <div className="flex gap-2">
                {priorities.map((priority) => {
                  const isSelected = formData.priority === priority.id;
                  return (
                    <button
                      key={priority.id}
                      onClick={() => setFormData({ ...formData, priority: priority.id as 'high' | 'medium' | 'low' })}
                      className={`flex-1 py-2 px-3 rounded-xl border transition-all text-center ${
                        isSelected ? 'border-accent bg-accent-muted' : 'border-border-hover hover:border-border'
                      }`}
                    >
                      <div className={`text-xs font-medium ${isSelected ? 'text-text' : 'text-text-secondary'}`}>
                        {priority.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const isSelected = formData.category === category.id;
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setFormData({ ...formData, category: category.id })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                        isSelected ? 'border-accent bg-accent-muted' : 'border-border-hover hover:border-border'
                      }`}
                    >
                      <Icon className={isSelected ? 'text-text' : 'text-text-secondary'} size={14} />
                      <span className={`text-xs ${isSelected ? 'text-text' : 'text-text-secondary'}`}>
                        {category.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-surface rounded-2xl p-4 border border-border"
        >
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-xs uppercase tracking-wider">Today&apos;s Plans</span>
            <FiTarget className="text-text-secondary" size={16} />
          </div>
          <div className="text-2xl font-bold text-text mt-1">{stats.total}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-surface rounded-2xl p-4 border border-border"
        >
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-xs uppercase tracking-wider">Completed</span>
            <FiCheckCircle className="text-success" size={16} />
          </div>
          <div className="text-2xl font-bold text-success mt-1">{stats.completed}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-surface rounded-2xl p-4 border border-border"
        >
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-xs uppercase tracking-wider">In Progress</span>
            <FiRefreshCw className="text-warning" size={16} />
          </div>
          <div className="text-2xl font-bold text-warning mt-1">{stats.inProgress}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-surface rounded-2xl p-4 border border-border"
        >
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-xs uppercase tracking-wider">Pending</span>
            <FiClock className="text-info" size={16} />
          </div>
          <div className="text-2xl font-bold text-info mt-1">{stats.pending}</div>
        </motion.div>
      </div>

      <div className="flex items-center justify-between">
        <div
          role="tablist"
          aria-label="Plans section tabs"
          className="flex items-center gap-1 bg-surface rounded-xl p-1 border border-border w-fit"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'plans'}
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'plans'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text hover:bg-surface-hover'
            }`}
          >
            <FiTarget size={16} /> <span>Plans</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text hover:bg-surface-hover'
            }`}
          >
            <FiList size={16} /> <span>History{historyPlans.length > 0 ? ` (${historyPlans.length})` : ''}</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'plans' ? (
          <motion.div
            key="plans"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={tabAnimation}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="bg-surface rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-surface-hover rounded-xl">
                  <FiPlus className="text-text-secondary" size={18} />
                </div>
                <h3 className="text-sm font-medium text-text">Create a New Plan</h3>
              </div>

              <AnimatePresence>
                {toast && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-success-muted text-success text-sm font-medium rounded-xl px-4 py-2.5 mb-4 border border-[var(--success)]/30 flex items-center gap-2 overflow-hidden"
                  >
                    <FiCheckCircle size={16} />
                    <span>{toast}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 mb-5">
                {formSteps.map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === formStep ? 'bg-accent w-8' : i < formStep ? 'bg-text-secondary w-6' : 'bg-border w-6'
                      }`}
                    />
                    {i < formSteps.length - 1 && (
                      <div
                        className={`w-8 h-[2px] transition-all ${i < formStep ? 'bg-text-secondary' : 'bg-border'}`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4">
                {(() => {
                  const StepIcon = formSteps[formStep].icon;
                  return <StepIcon className="text-accent" size={18} />;
                })()}
                <div>
                  <div className="text-sm font-medium text-text">{formSteps[formStep].title}</div>
                  <div className="text-xs text-text-secondary">{formSteps[formStep].desc}</div>
                </div>
              </div>

              {renderFormStep()}

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                <button
                  onClick={() => setFormStep(Math.max(0, formStep - 1))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    formStep > 0
                      ? 'text-text-secondary hover:text-text hover:bg-surface-hover'
                      : 'text-text-muted cursor-not-allowed'
                  }`}
                  disabled={formStep === 0}
                >
                  <FiArrowLeft size={16} /> Back
                </button>
                {formStep === formSteps.length - 1 ? (
                  <button
                    onClick={handleCreate}
                    disabled={!formData.title.trim()}
                    className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FiCheckCircle size={16} /> Create Plan
                  </button>
                ) : (
                  <button
                    onClick={() => setFormStep(formStep + 1)}
                    className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-muted transition-all"
                  >
                    Continue <FiArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FiTarget className="text-accent" size={16} />
              <h3 className="text-sm font-semibold text-text">Today&apos;s Plans</h3>
              {todayPlans.length > 0 && <span className="text-xs text-text-muted">({todayPlans.length})</span>}
            </div>
            {todayPlans.length === 0 ? (
              <div className="bg-surface rounded-2xl p-8 text-center border border-border">
                <FiTarget className="mx-auto text-3xl text-text-muted mb-2" />
                <p className="text-sm text-text-secondary">No plans for today</p>
                <p className="text-xs text-text-muted mt-1">Create a new plan to get started</p>
              </div>
            ) : (
              todayPlans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface rounded-2xl p-4 border border-border hover:border-border-hover transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusBadge(plan.status)} border`}>
                          {plan.status.replace('-', ' ')}
                        </span>
                        <h4 className="text-sm font-medium text-text">{plan.title}</h4>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${getPriorityBadge(plan.priority)} border`}
                        >
                          {plan.priority}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1 ml-1">{plan.description}</p>
                      <div className="flex items-center gap-3 mt-2 ml-1 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover border border-border-hover text-text-secondary">
                          {plan.type}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover border border-border-hover text-text-secondary">
                          {plan.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plan.status !== 'completed' && (
                        <button
                          onClick={() => onUpdatePlan(plan.id, 'completed')}
                          className="p-1.5 text-success hover:bg-success-muted rounded-lg transition-all"
                          title="Complete"
                          aria-label={`Mark ${plan.title} as complete`}
                        >
                          <FiCheckCircle size={16} />
                        </button>
                      )}
                      {plan.status !== 'in-progress' && plan.status !== 'completed' && (
                        <button
                          onClick={() => onUpdatePlan(plan.id, 'in-progress')}
                          className="p-1.5 text-warning hover:bg-warning-muted rounded-lg transition-all"
                          title="Start Progress"
                          aria-label={`Start progress on ${plan.title}`}
                        >
                          <FiRefreshCw size={16} />
                        </button>
                      )}
                      {plan.status === 'not-started' && (
                        <button
                          onClick={() => onUpdatePlan(plan.id, 'pending')}
                          className="p-1.5 text-info hover:bg-accent-muted rounded-lg transition-all"
                          title="Set Pending"
                          aria-label={`Set ${plan.title} as pending`}
                        >
                          <FiClock size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onDeletePlan(plan.id)}
                        className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger-muted rounded-lg transition-all"
                        title="Delete"
                        aria-label={`Delete ${plan.title}`}
                      >
                        <FiXCircle size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={tabAnimation}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {plans.length > 0 && historyPlans.length === 0 && (
              <div className="bg-warning-muted text-warning text-xs rounded-2xl p-3 border border-[var(--warning)]/20 flex items-center gap-2">
                <FiAlertCircle size={14} />
                <span>
                  All {plans.length} stored plan(s) have today&apos;s date ({today}). Plans only appear here when their
                  date differs from today.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface rounded-2xl p-4 border border-border">
                <div className="text-xs text-text-secondary">Total History</div>
                <div className="text-xl font-bold text-text">{historyStats.total}</div>
              </div>
              <div className="bg-surface rounded-2xl p-4 border border-border">
                <div className="text-xs text-text-secondary">Completed</div>
                <div className="text-xl font-bold text-success">{historyStats.completed}</div>
              </div>
              <div className="bg-surface rounded-2xl p-4 border border-border">
                <div className="text-xs text-text-secondary">In Progress</div>
                <div className="text-xl font-bold text-warning">{historyStats.inProgress}</div>
              </div>
              <div className="bg-surface rounded-2xl p-4 border border-border">
                <div className="text-xs text-text-secondary">Pending / Not Started</div>
                <div className="text-xl font-bold text-info">{historyStats.pending + historyStats.notStarted}</div>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="History filters"
              className="flex items-center gap-1 bg-surface rounded-xl p-1 border border-border w-fit flex-wrap"
            >
              {historyFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive = historyFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setHistoryFilter(filter.id as typeof historyFilter)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive ? 'bg-accent text-white' : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                    }`}
                  >
                    <Icon size={12} /> <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="bg-surface rounded-2xl p-4 border border-border">
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredHistoryPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <FiList className="mx-auto text-3xl text-text-muted mb-2" />
                    <p className="text-sm text-text-secondary">
                      {historyPlans.length === 0 ? 'No plans in history' : 'No plans match this filter'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {historyPlans.length === 0
                        ? 'Plans from previous days will appear here automatically'
                        : 'Try selecting a different filter above'}
                    </p>
                  </div>
                ) : (
                  filteredHistoryPlans.map((plan) => (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border hover:bg-surface-hover transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusBadge(plan.status)} border`}
                        >
                          {getStatusIcon(plan.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text truncate">{plan.title}</div>
                          <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                            <span className="flex items-center gap-1">
                              <FiCalendar size={10} /> {plan.date}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full ${getPriorityBadge(plan.priority)} border`}
                            >
                              {plan.priority}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover border border-border-hover">
                              {plan.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusBadge(plan.status)} border`}>
                        {plan.status.replace('-', ' ')}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
