import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  Search, Bell, Filter, TrendingUp, TrendingDown, AlertTriangle, MessageSquare,
  Github, Mail, Users, PieChart, Activity, Zap, Clock, ArrowUpRight, ArrowDownRight,
  Layers, Sparkles, Loader2, ChevronDown, ChevronRight, X, FileText
} from 'lucide-react';
import { AIChatbot } from './components/AIChatbot';
import type { TimeRange, Feedback, TrendingTheme, Alert, ChatSource } from './types';
import { getFeedback, getAnalyticsSummary, getTrendingThemes, getProductBreakdown, getSourceBreakdown, getAlerts, generateReport, ReportResponse } from './services/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

// Icons
const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);
const Twitter = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

function Dashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('7d');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'themes' | 'feedback' | 'reports'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [themeSearch, setThemeSearch] = useState('');
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareSending, setShareSending] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const feedbackPageSize = 20;

  const handleGenerateReport = async (reportType: string) => {
    setShowReportModal(true);
    setReportLoading(true);
    setReportData(null);
    setReportError(null);
    
    try {
      const data = await generateReport(reportType, selectedTimeRange, selectedProduct === 'all' ? undefined : selectedProduct);
      setReportData(data);
    } catch (error: any) {
      setReportError(error.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  const toggleThemeExpanded = (themeId: string) => {
    setExpandedThemes(prev => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else {
        next.add(themeId);
      }
      return next;
    });
  };

  // API Queries
  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['feedback', selectedTimeRange, selectedProduct, selectedSource, feedbackPage, feedbackSearch],
    queryFn: () => getFeedback({ 
      time_range: selectedTimeRange, 
      product: selectedProduct === 'all' ? undefined : [selectedProduct],
      source: selectedSource === 'all' ? undefined : [selectedSource as any],
      search: feedbackSearch || undefined
    }, feedbackPage, feedbackPageSize),
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', selectedTimeRange, selectedProduct, selectedSource],
    queryFn: () => getAnalyticsSummary(selectedTimeRange, selectedProduct === 'all' ? undefined : selectedProduct, selectedSource === 'all' ? undefined : selectedSource),
  });

  const { data: themesData, isLoading: themesLoading } = useQuery({
    queryKey: ['themes', selectedTimeRange, selectedProduct, selectedSource],
    queryFn: () => getTrendingThemes(selectedTimeRange, activeTab === 'themes' ? 20 : 5, selectedProduct === 'all' ? undefined : selectedProduct, selectedSource === 'all' ? undefined : selectedSource),
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', selectedTimeRange],
    queryFn: () => getProductBreakdown(selectedTimeRange),
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources', selectedTimeRange, selectedProduct],
    queryFn: () => getSourceBreakdown(selectedTimeRange, selectedProduct === 'all' ? undefined : selectedProduct),
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(10),
  });

  // Use API data with fallbacks
  const recentFeedback: Feedback[] = feedbackData?.data || [];
  const trendingThemes: TrendingTheme[] = themesData || [];
  const alerts: Alert[] = alertsData || [];
  const productBreakdown = productsData || [];
  
  // Add icons and colors to source breakdown
  const sourceIconMap: Record<string, { icon: () => React.ReactNode; color: string }> = {
    github: { icon: () => <Github className="w-4 h-4" />, color: 'bg-gray-700' },
    discord: { icon: () => <DiscordIcon />, color: 'bg-indigo-500' },
    twitter: { icon: () => <Twitter />, color: 'bg-sky-500' },
    support: { icon: () => <MessageSquare className="w-4 h-4" />, color: 'bg-blue-500' },
    forum: { icon: () => <Users className="w-4 h-4" />, color: 'bg-orange-500' },
    email: { icon: () => <Mail className="w-4 h-4" />, color: 'bg-green-500' },
  };
  const sourceBreakdown = (sourcesData || []).map((s: any) => ({
    ...s,
    icon: sourceIconMap[s.source]?.icon || (() => <MessageSquare className="w-4 h-4" />),
    color: sourceIconMap[s.source]?.color || 'bg-gray-500',
  }));

  // KPI data from analytics
  const kpiData = {
    totalFeedback: analyticsData?.totalFeedback || 0,
    totalChange: analyticsData?.totalFeedbackChange || 0,
    avgSentiment: analyticsData?.avgSentiment || 0,
    sentimentChange: analyticsData?.sentimentChange || 0,
    criticalAlerts: analyticsData?.criticalAlerts || 0,
    alertsChange: analyticsData?.alertsChange || 0,
    responseTime: analyticsData?.avgResponseTime || '0h',
    responseChange: analyticsData?.responseTimeChange || 0
  };

  const isLoading = feedbackLoading || analyticsLoading || themesLoading || productsLoading || sourcesLoading || alertsLoading;

  // Helpers
  const getSourceIcon = (source: string) => {
    const icons: Record<string, React.ReactNode> = { github: <Github className="w-4 h-4" />, discord: <DiscordIcon />, twitter: <Twitter />, support: <MessageSquare className="w-4 h-4" />, forum: <Users className="w-4 h-4" />, email: <Mail className="w-4 h-4" /> };
    return icons[source] || <MessageSquare className="w-4 h-4" />;
  };
  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = { github: 'bg-gray-700 text-white', discord: 'bg-indigo-500 text-white', twitter: 'bg-sky-500 text-white', support: 'bg-blue-500 text-white', forum: 'bg-orange-500 text-white', email: 'bg-green-500 text-white' };
    return colors[source] || 'bg-gray-500 text-white';
  };
  const getTierBadge = (tier?: string) => {
    const badges: Record<string, string> = { enterprise: 'bg-purple-100 text-purple-800 border-purple-200', pro: 'bg-blue-100 text-blue-800 border-blue-200', free: 'bg-gray-100 text-gray-600 border-gray-200' };
    return badges[tier || ''] || 'bg-gray-100 text-gray-500 border-gray-200';
  };
  const getSentimentColor = (s: number) => s >= 0.3 ? 'text-green-600' : s >= -0.3 ? 'text-yellow-600' : 'text-red-600';
  const getSentimentBg = (s: number) => s >= 0.3 ? 'bg-green-100' : s >= -0.3 ? 'bg-yellow-100' : 'bg-red-100';
  const getUrgencyColor = (u: number) => u >= 8 ? 'bg-red-500' : u >= 5 ? 'bg-orange-500' : 'bg-yellow-500';
  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : `${m}m ago`;
  };

  // Handle source click from chatbot - navigate to relevant tab
  const handleSourceNavigation = (source: ChatSource) => {
    setChatOpen(false);
    setChatExpanded(false);
    
    if (source.type === 'feedback') {
      setActiveTab('feedback');
      // Could also scroll to specific feedback item in the future
    } else if (source.type === 'theme') {
      setActiveTab('themes');
      // Expand the clicked theme
      setExpandedThemes(prev => new Set(prev).add(source.id));
    } else if (source.type === 'customer') {
      setActiveTab('feedback');
      // Could filter by customer in the future
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Layers className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center"><Zap className="w-5 h-5 text-white" /></div>
              <span className="text-lg sm:text-xl font-bold text-gray-900">Cerebro</span>
              <span className="hidden sm:inline text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">BETA</span>
            </div>
            <nav className="hidden md:flex items-center space-x-1 ml-8">
              <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'dashboard' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Dashboard</button>
              <button onClick={() => setActiveTab('themes')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'themes' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Themes</button>
              <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'feedback' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Feedback</button>
              <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'reports' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Reports</button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Bell className="w-5 h-5" />
                {alerts && alerts.filter(a => !a.acknowledged && a.type === 'critical').length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Critical Alerts</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto max-h-72">
                    {alerts && alerts.filter(a => !a.acknowledged && a.type === 'critical').length > 0 ? (
                      alerts.filter(a => !a.acknowledged && a.type === 'critical').map(alert => (
                        <div 
                          key={alert.id} 
                          className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                          onClick={() => { setSelectedAlert(alert); setShowNotifications(false); }}
                        >
                          <div className="flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">{alert.message}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{alert.product} • {new Date(alert.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">
                        No critical alerts
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 pl-2 sm:pl-4 border-l border-gray-200">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-medium">JD</div>
              <div className="hidden lg:block">
                <div className="text-sm font-medium text-gray-900">Jane Doe</div>
                <div className="text-xs text-gray-500">Senior PM, Developer Platform</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3">
            <nav className="flex flex-col space-y-1">
              <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={`px-4 py-2.5 text-sm font-medium rounded-lg text-left ${activeTab === 'dashboard' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Dashboard</button>
              <button onClick={() => { setActiveTab('themes'); setMobileMenuOpen(false); }} className={`px-4 py-2.5 text-sm font-medium rounded-lg text-left ${activeTab === 'themes' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Themes</button>
              <button onClick={() => { setActiveTab('feedback'); setMobileMenuOpen(false); }} className={`px-4 py-2.5 text-sm font-medium rounded-lg text-left ${activeTab === 'feedback' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Feedback</button>
              <button onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }} className={`px-4 py-2.5 text-sm font-medium rounded-lg text-left ${activeTab === 'reports' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-100'}`}>Reports</button>
            </nav>
          </div>
        )}
      </header>

      <main className="px-4 sm:px-6 py-4 sm:py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
              {(['24h', '7d', '30d', '90d'] as TimeRange[]).map(range => (
                <button key={range} onClick={() => { setSelectedTimeRange(range); setFeedbackPage(1); }} className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${selectedTimeRange === range ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{range}</button>
              ))}
            </div>
            <select value={selectedProduct} onChange={e => { setSelectedProduct(e.target.value); setFeedbackPage(1); }} className="px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="all">All Products</option>
              <option value="workers">Workers</option>
              <option value="r2">R2</option>
              <option value="pages">Pages</option>
              <option value="kv">Workers KV</option>
            </select>
            <select 
              value={selectedSource} 
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <option value="all">All Sources</option>
              <option value="github">GitHub</option>
              <option value="discord">Discord</option>
              <option value="twitter">Twitter</option>
              <option value="support">Support</option>
              <option value="forum">Forum</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Clock className="w-4 h-4" /><span>Last updated: just now</span>
          </div>
        </div>

        {/* KPI Cards - Dashboard only */}
        {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'Total Feedback', value: kpiData.totalFeedback.toLocaleString(), sub: 'this period', change: kpiData.totalChange, icon: MessageSquare, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
            { label: 'Avg Sentiment', value: kpiData.avgSentiment.toFixed(2), sub: '-1 to +1', change: kpiData.sentimentChange, icon: Activity, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', changePrefix: '+' },
            { label: 'Critical Alerts', value: kpiData.criticalAlerts, sub: 'requiring attention', change: kpiData.alertsChange, icon: AlertTriangle, iconBg: 'bg-red-100', iconColor: 'text-red-600', isDown: true },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-xs sm:text-sm font-medium text-gray-500">{kpi.label}</span>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 ${kpi.iconBg} rounded-lg flex items-center justify-center`}><kpi.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${kpi.iconColor}`} /></div>
              </div>
              <div className="flex items-end justify-between">
                <div><div className="text-2xl sm:text-3xl font-bold text-gray-900">{kpi.value}</div><div className="text-xs text-gray-500">{kpi.sub}</div></div>
                <div className={`flex items-center text-xs sm:text-sm font-medium ${kpi.change >= 0 ? 'text-green-600' : 'text-green-600'}`}>
                  {kpi.isDown ? <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  <span>{kpi.changePrefix || ''}{Math.abs(kpi.change)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* By Product & By Source Row - Dashboard only */}
        {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* By Product */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900">By Product</h2>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {productBreakdown.slice(0, 6).map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${idx * 45 + 20}, 70%, 50%)` }}></div>
                      <span className="text-sm font-medium text-gray-700">{product.product}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-gray-900">{product.count}</span>
                      <span className="text-xs text-gray-400">{product.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* By Source */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900">By Source</h2>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {sourceBreakdown.map((source, idx) => (
                  <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 ${source.color} rounded-lg flex items-center justify-center text-white`}><source.icon /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 capitalize">{source.source}</span>
                        <span className="text-sm font-semibold text-gray-900">{source.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                        <div className={`h-full ${source.color} rounded-full`} style={{ width: `${source.percentage}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Main Content Grid - Dashboard */}
        {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Trending Themes */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2"><TrendingUp className="w-5 h-5 text-orange-500" /><h2 className="font-semibold text-gray-900">Trending Themes</h2></div>
                <button onClick={() => setActiveTab('themes')} className="text-sm text-orange-600 font-medium hover:text-orange-700">View All</button>
              </div>
              <div className="divide-y divide-gray-100">
                {trendingThemes.map(theme => (
                  <div key={theme.id} className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {theme.isNew && <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">NEW</span>}
                          <span className="text-xs text-gray-500">{theme.mentions} mentions</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 leading-snug">{theme.theme}</p>
                      </div>
                      <div className={`flex items-center text-sm font-medium ${theme.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {theme.change > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {Math.abs(theme.change)}%
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {theme.products.map((product, pidx) => <span key={pidx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{product}</span>)}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${theme.sentiment === 'frustrated' ? 'bg-red-100 text-red-700' : theme.sentiment === 'concerned' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{theme.sentiment}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Feedback */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2"><MessageSquare className="w-5 h-5 text-orange-500" /><h2 className="font-semibold text-gray-900">Recent Feedback</h2></div>
                <button onClick={() => setActiveTab('feedback')} className="text-sm text-orange-600 font-medium hover:text-orange-700">View All</button>
              </div>
              <div className="divide-y divide-gray-100 max-h-[680px] overflow-y-auto">
                {recentFeedback.map(feedback => (
                  <div key={feedback.id} className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getSourceColor(feedback.source)}`}>{getSourceIcon(feedback.source)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {feedback.customerName && <span className="text-sm font-medium text-gray-900 truncate">{feedback.customerName}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${getTierBadge(feedback.customerTier)}`}>{feedback.customerTier}</span>
                          {feedback.customerArr && feedback.customerArr > 0 && <span className="text-xs text-gray-500">${(feedback.customerArr / 1000).toFixed(0)}k ARR</span>}
                        </div>
                        <p className="text-sm text-gray-700 mb-2 line-clamp-2">{feedback.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{feedback.product}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getSentimentBg(feedback.sentiment)} ${getSentimentColor(feedback.sentiment)}`}>{feedback.sentiment > 0 ? '+' : ''}{feedback.sentiment.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1"><div className={`w-2 h-2 rounded-full ${getUrgencyColor(feedback.urgency)}`}></div><span className="text-xs text-gray-500">U:{feedback.urgency}</span></div>
                            <span className="text-xs text-gray-400">{formatTime(feedback.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-1 space-y-6">
            {/* Recent Alerts */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2"><Bell className="w-5 h-5 text-orange-500" /><h2 className="font-semibold text-gray-900">Recent Alerts</h2></div>
              </div>
              <div className="divide-y divide-gray-100">
                {alerts.map(alert => (
                  <div key={alert.id} className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${alert.type === 'critical' ? 'bg-red-100' : alert.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                        <AlertTriangle className={`w-4 h-4 ${alert.type === 'critical' ? 'text-red-600' : alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-xs font-semibold uppercase ${alert.type === 'critical' ? 'text-red-600' : alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`}>{alert.type}</span>
                          <span className="text-xs text-gray-400">{formatTime(alert.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-snug">{alert.message}</p>
                        <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{alert.product}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Weekly Digest */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
              <h3 className="font-semibold mb-2">Weekly Digest Ready</h3>
              <p className="text-sm text-orange-100 mb-4">Your automated feedback report for Jan 6-12 is ready to review.</p>
              <div className="flex items-center space-x-2">
                <button onClick={() => setActiveTab('reports')} className="px-4 py-2 bg-white text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-50 transition-colors">View Report</button>
                <button onClick={() => { setShowShareModal(true); setShareSuccess(false); setShareEmail(''); }} className="px-4 py-2 bg-orange-400 text-white text-sm font-medium rounded-lg hover:bg-orange-300 transition-colors">Share</button>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Themes View */}
        {activeTab === 'themes' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">All Trending Themes</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Track emerging patterns and issues across all feedback.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search themes..." 
                  value={themeSearch}
                  onChange={(e) => setThemeSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full sm:w-64 bg-gray-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" 
                />
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {(() => {
                const filteredThemes = trendingThemes.filter(theme => 
                  !themeSearch || 
                  theme.theme.toLowerCase().includes(themeSearch.toLowerCase()) ||
                  theme.products.some(p => p.toLowerCase().includes(themeSearch.toLowerCase())) ||
                  (theme.topIssues && theme.topIssues.some(issue => issue.content.toLowerCase().includes(themeSearch.toLowerCase())))
                );
                
                if (filteredThemes.length === 0) {
                  return (
                    <div className="px-6 py-12 text-center">
                      <p className="text-gray-500">
                        {themeSearch 
                          ? `No themes found for "${themeSearch}". Try a different search term or clear filters.`
                          : 'No trending themes found. Try adjusting your filters or time range.'}
                      </p>
                    </div>
                  );
                }
                
                return filteredThemes.map(theme => {
                const isExpanded = expandedThemes.has(theme.id);
                return (
                <div key={theme.id} className="transition-colors">
                  <div 
                    className="px-6 py-5 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleThemeExpanded(theme.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          {theme.isNew && <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">NEW</span>}
                          <span className="text-sm font-medium text-gray-700">{theme.mentions} mentions</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{theme.products.length} products</span>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">{theme.theme}</h3>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {theme.products.slice(0, 5).map((product, pidx) => (
                            <span key={pidx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{product}</span>
                          ))}
                          {theme.products.length > 5 && (
                            <span className="text-xs text-gray-400">+{theme.products.length - 5} more</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${theme.sentiment === 'frustrated' ? 'bg-red-100 text-red-700' : theme.sentiment === 'concerned' ? 'bg-orange-100 text-orange-700' : theme.sentiment === 'positive' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {theme.sentiment}
                        </span>
                        <div className={`flex items-center text-sm font-medium ${theme.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {theme.change > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                          {Math.abs(theme.change)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Collapsible Top Issues */}
                  {isExpanded && theme.topIssues && theme.topIssues.length > 0 && (
                    <div className="px-6 pb-5 bg-gray-50 border-t border-gray-100">
                      <div className="pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <MessageSquare className="w-4 h-4 mr-2 text-gray-400" />
                          Top 5 Issues
                        </h4>
                        <div className="space-y-3">
                          {theme.topIssues.map((issue, idx) => (
                            <div key={issue.id} className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-xs font-medium text-gray-400">#{idx + 1}</span>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{issue.product}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${issue.sentimentLabel === 'frustrated' ? 'bg-red-100 text-red-700' : issue.sentimentLabel === 'concerned' ? 'bg-orange-100 text-orange-700' : issue.sentimentLabel === 'positive' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {issue.sentimentLabel}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 mb-2">{issue.content}</p>
                              {issue.customerName && (
                                <p className="text-xs text-gray-400">— {issue.customerName}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {isExpanded && (!theme.topIssues || theme.topIssues.length === 0) && (
                    <div className="px-6 pb-5 bg-gray-50 border-t border-gray-100">
                      <p className="text-sm text-gray-500 pt-4">No specific issues found for this theme.</p>
                    </div>
                  )}
                </div>
              )});
              })()}
            </div>
          </div>
        )}

        {/* Feedback View */}
        {activeTab === 'feedback' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">All Feedback</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {(feedbackData?.total || 0) === 0 
                      ? (feedbackSearch 
                          ? `No results for "${feedbackSearch}".`
                          : 'No feedback found.')
                      : `${feedbackData?.total || 0} items`
                    }
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      value={feedbackSearch}
                      onChange={(e) => {
                        setFeedbackSearch(e.target.value);
                        setFeedbackPage(1);
                      }}
                      className="pl-10 pr-4 py-2 w-full sm:w-48 md:w-64 bg-gray-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" 
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2">
                    <button
                      onClick={() => setFeedbackPage(p => Math.max(1, p - 1))}
                      disabled={feedbackPage === 1}
                      className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    <span className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                      {feedbackPage}/{Math.ceil((feedbackData?.total || 0) / feedbackPageSize) || 1}
                    </span>
                    <button
                      onClick={() => setFeedbackPage(p => p + 1)}
                      disabled={!feedbackData?.hasMore}
                      className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {feedbackLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : (
            <div className="divide-y divide-gray-100">
              {recentFeedback.map(feedback => (
                <div key={feedback.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getSourceColor(feedback.source)}`}>{getSourceIcon(feedback.source)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        {feedback.customerName && <span className="text-xs sm:text-sm font-semibold text-gray-900">{feedback.customerName}</span>}
                        <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full border capitalize ${getTierBadge(feedback.customerTier)}`}>{feedback.customerTier}</span>
                        <span className="text-xs text-gray-400">{formatTime(feedback.createdAt)}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">{feedback.content}</p>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 sm:px-2 py-0.5 rounded-full">{feedback.product}</span>
                        <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${getSentimentBg(feedback.sentiment)} ${getSentimentColor(feedback.sentiment)}`}>{feedback.sentiment > 0 ? '+' : ''}{feedback.sentiment.toFixed(2)}</span>
                        <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${feedback.status === 'new' ? 'bg-blue-100 text-blue-700' : feedback.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{feedback.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
            {/* Bottom Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                {feedbackData?.total || 0} total feedback items
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFeedbackPage(1)}
                  disabled={feedbackPage === 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  First
                </button>
                <button
                  onClick={() => setFeedbackPage(p => Math.max(1, p - 1))}
                  disabled={feedbackPage === 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  Previous
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, Math.ceil((feedbackData?.total || 0) / feedbackPageSize)) }, (_, i) => {
                    const totalPages = Math.ceil((feedbackData?.total || 0) / feedbackPageSize);
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (feedbackPage <= 3) {
                      pageNum = i + 1;
                    } else if (feedbackPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = feedbackPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setFeedbackPage(pageNum)}
                        className={`w-8 h-8 text-sm font-medium rounded-lg ${feedbackPage === pageNum ? 'bg-orange-500 text-white' : 'border border-gray-200 hover:bg-white'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setFeedbackPage(p => p + 1)}
                  disabled={!feedbackData?.hasMore}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  Next
                </button>
                <button
                  onClick={() => setFeedbackPage(Math.ceil((feedbackData?.total || 0) / feedbackPageSize))}
                  disabled={!feedbackData?.hasMore}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reports View */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Weekly Digest Report */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-orange-600">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Weekly Feedback Digest</h2>
                    <p className="text-sm text-orange-100 mt-1">January 6-12, 2026 • Auto-generated report</p>
                  </div>
                  <button 
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/30 transition-colors"
                  >
                    Export PDF
                  </button>
                </div>
              </div>
              <div className="p-6">
                {/* Executive Summary */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Activity className="w-5 h-5 text-orange-500 mr-2" />
                    Executive Summary
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 leading-relaxed">
                      This week saw <span className="font-semibold text-gray-900">{feedbackData?.total || 0} feedback items</span> across all channels. 
                      The dominant theme was <span className="font-semibold text-orange-600">{trendingThemes[0]?.theme || 'Performance'}</span> with {trendingThemes[0]?.mentions || 0} mentions. 
                      Overall sentiment averaged <span className={`font-semibold ${kpiData.avgSentiment >= 0 ? 'text-green-600' : 'text-red-600'}`}>{kpiData.avgSentiment.toFixed(2)}</span>, 
                      {kpiData.avgSentiment < -0.3 ? ' indicating significant customer frustration that requires attention.' : 
                       kpiData.avgSentiment < 0 ? ' showing some areas of concern.' : 
                       ' reflecting generally positive customer experiences.'}
                    </p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{feedbackData?.total || 0}</div>
                    <div className="text-sm text-blue-600">Total Feedback</div>
                    <div className={`text-xs mt-1 ${kpiData.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {kpiData.totalChange >= 0 ? '↑' : '↓'} {Math.abs(kpiData.totalChange)}% vs last week
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-700">{trendingThemes.length}</div>
                    <div className="text-sm text-orange-600">Active Themes</div>
                    <div className="text-xs mt-1 text-orange-500">{trendingThemes.filter(t => t.isNew).length} new this week</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{kpiData.criticalAlerts}</div>
                    <div className="text-sm text-red-600">Critical Alerts</div>
                    <div className="text-xs mt-1 text-red-500">Requires immediate attention</div>
                  </div>
                  <div className={`${kpiData.avgSentiment >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-4 text-center`}>
                    <div className={`text-2xl font-bold ${kpiData.avgSentiment >= 0 ? 'text-green-700' : 'text-red-700'}`}>{kpiData.avgSentiment.toFixed(2)}</div>
                    <div className={`text-sm ${kpiData.avgSentiment >= 0 ? 'text-green-600' : 'text-red-600'}`}>Avg Sentiment</div>
                    <div className={`text-xs mt-1 ${kpiData.sentimentChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {kpiData.sentimentChange >= 0 ? '↑' : '↓'} {Math.abs(kpiData.sentimentChange).toFixed(2)} vs last week
                    </div>
                  </div>
                </div>

                {/* Top Themes */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 text-orange-500 mr-2" />
                    Top Themes This Week
                  </h3>
                  <div className="space-y-3">
                    {trendingThemes.slice(0, 5).map((theme, idx) => (
                      <div key={theme.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-semibold">{idx + 1}</span>
                          <div>
                            <span className="font-medium text-gray-900">{theme.theme}</span>
                            <div className="flex items-center space-x-2 mt-1">
                              {theme.products.slice(0, 3).map(p => (
                                <span key={p} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{p}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{theme.mentions}</div>
                          <div className={`text-xs ${theme.change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {theme.change > 0 ? '↑' : '↓'} {Math.abs(theme.change)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Product Breakdown */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Layers className="w-5 h-5 text-orange-500 mr-2" />
                    Feedback by Product
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {productBreakdown.slice(0, 8).map(product => (
                      <div key={product.product} className="p-3 border border-gray-200 rounded-lg">
                        <div className="font-medium text-gray-900 capitalize">{product.product}</div>
                        <div className="text-2xl font-bold text-gray-700 my-1">{product.count}</div>
                        <div className="text-xs text-gray-500">{product.percentage?.toFixed(1) || 0}% of total</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Zap className="w-5 h-5 text-orange-500 mr-2" />
                    Recommended Actions
                  </h3>
                  <div className="space-y-3">
                    {trendingThemes.slice(0, 3).filter(t => t.suggestedAction).map(theme => (
                      <div key={theme.id} className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{theme.theme}</div>
                          <div className="text-sm text-gray-600 mt-1">{theme.suggestedAction || `Address ${theme.mentions} customer concerns about ${theme.theme.toLowerCase()}`}</div>
                        </div>
                      </div>
                    ))}
                    {trendingThemes.length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">No specific recommendations at this time.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Report Types */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Custom Reports</h2>
              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={() => handleGenerateReport('weekly-digest')}
                  className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 cursor-pointer transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3"><Activity className="w-5 h-5 text-orange-600" /></div>
                  <h3 className="font-medium text-gray-900 mb-1">Weekly Digest</h3>
                  <p className="text-sm text-gray-500">Automated summary of key feedback trends</p>
                </button>
                <button 
                  onClick={() => handleGenerateReport('product-health')}
                  className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 cursor-pointer transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3"><PieChart className="w-5 h-5 text-blue-600" /></div>
                  <h3 className="font-medium text-gray-900 mb-1">Product Health</h3>
                  <p className="text-sm text-gray-500">Sentiment and feedback by product</p>
                </button>
                <button 
                  onClick={() => handleGenerateReport('customer-insights')}
                  className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 cursor-pointer transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3"><Users className="w-5 h-5 text-green-600" /></div>
                  <h3 className="font-medium text-gray-900 mb-1">Customer Insights</h3>
                  <p className="text-sm text-gray-500">Feedback patterns by customer tier</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI Chat Button */}
      {!chatOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          {/* Tooltip */}
          <div className="chat-tooltip absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span>Ask Cerebro AI anything!</span>
            </span>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full border-8 border-transparent border-l-gray-900"></div>
          </div>
          {/* Button with pulse effect */}
          <button 
            onClick={() => setChatOpen(true)} 
            className="chat-button-pulse chat-button-bounce relative w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all hover:scale-110"
          >
            <Sparkles className="w-6 h-6 text-white relative z-10" />
          </button>
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedAlert(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              selectedAlert.type === 'critical' ? 'bg-red-50 border-red-200' : 
              selectedAlert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedAlert.type === 'critical' ? 'bg-red-100' : 
                  selectedAlert.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${
                    selectedAlert.type === 'critical' ? 'text-red-600' : 
                    selectedAlert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <span className={`text-xs font-semibold uppercase ${
                    selectedAlert.type === 'critical' ? 'text-red-600' : 
                    selectedAlert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                  }`}>{selectedAlert.type} Alert</span>
                  <p className="text-xs text-gray-500">{formatTime(selectedAlert.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="p-1 hover:bg-white/50 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Message</h3>
                <p className="text-gray-900">{selectedAlert.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Product</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                    {selectedAlert.product}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedAlert.acknowledged ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {selectedAlert.acknowledged ? 'Acknowledged' : 'Pending'}
                  </span>
                </div>
              </div>
              {selectedAlert.feedbackIds && selectedAlert.feedbackIds.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Related Feedback</h3>
                  <p className="text-sm text-gray-600">{selectedAlert.feedbackIds.length} feedback item(s) linked to this alert</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rounded-b-xl">
              <button 
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {!selectedAlert.acknowledged && (
                <button 
                  onClick={() => {
                    // Could call acknowledge API here
                    setSelectedAlert(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Report Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Share Report</h3>
                  <p className="text-sm text-orange-100">Send the weekly digest via email</p>
                </div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6">
              {shareSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Report Sent!</h4>
                  <p className="text-sm text-gray-600">The weekly digest has been sent to {shareEmail}</p>
                  <button 
                    onClick={() => setShowShareModal(false)}
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Email</label>
                      <div className="relative">
                        <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={shareEmail}
                          onChange={(e) => setShareEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Report Preview</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>📊 Weekly Feedback Digest</p>
                        <p>📅 January 6-12, 2026</p>
                        <p>📝 {feedbackData?.total || 0} feedback items analyzed</p>
                        <p>📈 Avg sentiment: {kpiData.avgSentiment.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex space-x-3">
                    <button 
                      onClick={() => setShowShareModal(false)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        if (shareEmail && shareEmail.includes('@')) {
                          setShareSending(true);
                          // Simulate sending email
                          setTimeout(() => {
                            setShareSending(false);
                            setShareSuccess(true);
                          }, 1500);
                        }
                      }}
                      disabled={!shareEmail || !shareEmail.includes('@') || shareSending}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {shareSending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</>
                      ) : (
                        <>Send Report</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReportModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {reportData?.reportType === 'weekly-digest' ? 'Weekly Digest Report' :
                     reportData?.reportType === 'product-health' ? 'Product Health Report' :
                     reportData?.reportType === 'customer-insights' ? 'Customer Insights Report' :
                     'AI-Generated Report'}
                  </h3>
                  <p className="text-xs text-orange-100">
                    {reportData ? `Generated ${new Date(reportData.generatedAt).toLocaleString()}` : 'Generating...'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {reportLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                  <p className="text-gray-600 font-medium">Generating AI Report...</p>
                  <p className="text-sm text-gray-400 mt-1">Analyzing feedback data with Workers AI</p>
                </div>
              ) : reportError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 font-medium">Failed to generate report</p>
                  <p className="text-sm text-gray-500 mt-1">{reportError}</p>
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              ) : reportData ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      {selectedTimeRange === '24h' ? 'Last 24 Hours' : 
                       selectedTimeRange === '7d' ? 'Last 7 Days' :
                       selectedTimeRange === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
                    </span>
                    {selectedProduct !== 'all' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                        {selectedProduct}
                      </span>
                    )}
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    {reportData.summary.split('\n').map((paragraph, idx) => (
                      <p key={idx} className="text-gray-700 leading-relaxed mb-3">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            
            {reportData && !reportLoading && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <p className="text-xs text-gray-400">Powered by Cloudflare Workers AI</p>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      if (reportData) {
                        navigator.clipboard.writeText(reportData.summary);
                      }
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Copy to Clipboard
                  </button>
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AIChatbot 
        isOpen={chatOpen} 
        onClose={() => { setChatOpen(false); setChatExpanded(false); }} 
        isExpanded={chatExpanded} 
        onToggleExpand={() => setChatExpanded(!chatExpanded)} 
        onNavigateToSource={handleSourceNavigation}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

export default App;
