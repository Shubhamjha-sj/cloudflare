import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Search, Bell, Filter, TrendingUp, TrendingDown, AlertTriangle, MessageSquare,
  Github, Mail, Users, PieChart, Activity, Zap, Clock, ArrowUpRight, ArrowDownRight,
  Layers, Sparkles
} from 'lucide-react';
import { AIChatbot } from './components/AIChatbot';
import type { TimeRange, Feedback, TrendingTheme, Alert } from './types';

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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);

  // Mock Data
  const kpiData = { totalFeedback: 2847, totalChange: 12.5, avgSentiment: -0.23, sentimentChange: 0.08, criticalAlerts: 7, alertsChange: -2, responseTime: '4.2h', responseChange: -18 };

  const trendingThemes: TrendingTheme[] = [
    { id: '1', theme: 'R2 presigned URL expiration confusion', mentions: 47, change: 156, changeDirection: 'up', sentiment: 'frustrated', isNew: true, products: ['R2'], topSources: ['Discord', 'GitHub'], affectedCustomers: ['TechCorp', 'DataFlow'], createdAt: new Date().toISOString() },
    { id: '2', theme: 'Workers AI inference latency (EU)', mentions: 31, change: 89, changeDirection: 'up', sentiment: 'concerned', isNew: false, products: ['Workers AI'], topSources: ['Support', 'GitHub'], affectedCustomers: ['EuroTech'], createdAt: new Date().toISOString() },
    { id: '3', theme: 'Pages build timeout errors', mentions: 12, change: -67, changeDirection: 'down', sentiment: 'neutral', isNew: false, products: ['Pages'], topSources: ['GitHub', 'Discord'], affectedCustomers: ['WebAgency'], createdAt: new Date().toISOString() },
    { id: '4', theme: 'KV read performance at scale', mentions: 28, change: 34, changeDirection: 'up', sentiment: 'frustrated', isNew: false, products: ['Workers KV'], topSources: ['Support', 'GitHub'], affectedCustomers: ['Acme Corp'], createdAt: new Date().toISOString() },
    { id: '5', theme: 'Turnstile false positives', mentions: 19, change: 22, changeDirection: 'up', sentiment: 'annoyed', isNew: false, products: ['Turnstile'], topSources: ['Support', 'Email'], affectedCustomers: ['ShopMax'], createdAt: new Date().toISOString() },
  ];

  const recentFeedback: Feedback[] = [
    { id: '1', content: 'Workers KV is timing out on large reads in production. This is blocking our release.', source: 'github', sentiment: -0.7, sentimentLabel: 'frustrated', customerName: 'Acme Corp', customerTier: 'enterprise', customerArr: 250000, product: 'Workers KV', themes: ['performance'], urgency: 9, status: 'new', createdAt: new Date(Date.now() - 23 * 60000).toISOString(), updatedAt: new Date().toISOString() },
    { id: '2', content: 'Love the new R2 pricing! But the presigned URL docs are confusing - expiration time units?', source: 'discord', sentiment: 0.2, sentimentLabel: 'neutral', customerTier: 'free', product: 'R2', themes: ['documentation'], urgency: 3, status: 'new', createdAt: new Date(Date.now() - 45 * 60000).toISOString(), updatedAt: new Date().toISOString() },
    { id: '3', content: 'Been waiting 3 days for a response on our Pages deployment issue. Very frustrated.', source: 'support', sentiment: -0.8, sentimentLabel: 'frustrated', customerName: 'TechStart Inc', customerTier: 'pro', customerArr: 12000, product: 'Pages', themes: ['support'], urgency: 7, status: 'new', createdAt: new Date(Date.now() - 60 * 60000).toISOString(), updatedAt: new Date().toISOString() },
    { id: '4', content: "@Cloudflare your Workers AI is 3x slower than the competition in Europe. What's going on?", source: 'twitter', sentiment: -0.6, sentimentLabel: 'frustrated', customerTier: 'unknown', product: 'Workers AI', themes: ['performance'], urgency: 6, status: 'new', createdAt: new Date(Date.now() - 120 * 60000).toISOString(), updatedAt: new Date().toISOString() },
    { id: '5', content: 'Feature request: Can we get sub-minute cron triggers for Workers? Need 30-second intervals.', source: 'forum', sentiment: 0.1, sentimentLabel: 'neutral', customerName: 'DataFlow Ltd', customerTier: 'enterprise', customerArr: 180000, product: 'Workers', themes: ['feature-request'], urgency: 4, status: 'new', createdAt: new Date(Date.now() - 180 * 60000).toISOString(), updatedAt: new Date().toISOString() },
    { id: '6', content: 'Turnstile is blocking legitimate users on our checkout page. Lost $50k in sales yesterday.', source: 'email', sentiment: -0.9, sentimentLabel: 'frustrated', customerName: 'ShopMax', customerTier: 'enterprise', customerArr: 320000, product: 'Turnstile', themes: ['bug'], urgency: 10, status: 'new', createdAt: new Date(Date.now() - 240 * 60000).toISOString(), updatedAt: new Date().toISOString() },
  ];

  const productBreakdown = [
    { product: 'Workers', count: 523, percentage: 18.4, sentiment: -0.15 },
    { product: 'R2', count: 489, percentage: 17.2, sentiment: -0.28 },
    { product: 'Pages', count: 412, percentage: 14.5, sentiment: -0.12 },
    { product: 'Workers KV', count: 298, percentage: 10.5, sentiment: -0.35 },
    { product: 'Workers AI', count: 276, percentage: 9.7, sentiment: -0.22 },
    { product: 'Turnstile', count: 198, percentage: 7.0, sentiment: -0.31 },
  ];

  const sourceBreakdown = [
    { source: 'Support Tickets', icon: MessageSquare, count: 892, percentage: 31.3, color: 'bg-blue-500' },
    { source: 'GitHub Issues', icon: Github, count: 634, percentage: 22.3, color: 'bg-gray-700' },
    { source: 'Discord', icon: DiscordIcon, count: 521, percentage: 18.3, color: 'bg-indigo-500' },
    { source: 'Community Forum', icon: Users, count: 398, percentage: 14.0, color: 'bg-orange-500' },
    { source: 'X/Twitter', icon: Twitter, count: 267, percentage: 9.4, color: 'bg-sky-500' },
    { source: 'Email', icon: Mail, count: 135, percentage: 4.7, color: 'bg-green-500' },
  ];

  const alerts: Alert[] = [
    { id: '1', type: 'critical', message: 'Turnstile blocking legitimate users - Enterprise customer ShopMax reporting $50k revenue impact', product: 'Turnstile', createdAt: new Date(Date.now() - 4 * 3600000).toISOString(), acknowledged: false },
    { id: '2', type: 'warning', message: 'Workers KV timeout reports increased 156% this week - 3 Enterprise customers affected', product: 'Workers KV', createdAt: new Date(Date.now() - 6 * 3600000).toISOString(), acknowledged: false },
    { id: '3', type: 'info', message: 'New feature cluster detected: "Sub-minute cron triggers" - 89 requests over 6 months', product: 'Workers', createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), acknowledged: false },
  ];

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center"><Zap className="w-5 h-5 text-white" /></div>
              <span className="text-xl font-bold text-gray-900">Signal</span>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">BETA</span>
            </div>
            <nav className="hidden md:flex items-center space-x-1 ml-8">
              <button className="px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg">Dashboard</button>
              <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Themes</button>
              <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Feedback</button>
              <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Reports</button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search feedback..." className="pl-10 pr-4 py-2 w-64 bg-gray-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5" /><span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-medium">JD</div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">Jane Doe</div>
                <div className="text-xs text-gray-500">Senior PM, Developer Platform</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
              {(['24h', '7d', '30d', '90d'] as TimeRange[]).map(range => (
                <button key={range} onClick={() => setSelectedTimeRange(range)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedTimeRange === range ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{range}</button>
              ))}
            </div>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="all">All Products</option>
              <option value="workers">Workers</option>
              <option value="r2">R2</option>
              <option value="pages">Pages</option>
              <option value="kv">Workers KV</option>
            </select>
            <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter className="w-4 h-4" /><span>More Filters</span>
            </button>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500"><Clock className="w-4 h-4" /><span>Last updated: 2 minutes ago</span></div>
        </div>

        {/* Critical Alert Banner */}
        {alerts.filter(a => a.type === 'critical').map(alert => (
          <div key={alert.id} className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <div className="flex items-center space-x-2"><span className="text-xs font-semibold text-red-600 uppercase">Critical Alert</span><span className="text-xs text-gray-500">{formatTime(alert.createdAt)}</span></div>
                <p className="text-sm text-gray-800 font-medium">{alert.message}</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">View Details</button>
          </div>
        ))}

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Feedback', value: kpiData.totalFeedback.toLocaleString(), sub: 'this period', change: kpiData.totalChange, icon: MessageSquare, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
            { label: 'Avg Sentiment', value: kpiData.avgSentiment.toFixed(2), sub: '-1 to +1', change: kpiData.sentimentChange, icon: Activity, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', changePrefix: '+' },
            { label: 'Critical Alerts', value: kpiData.criticalAlerts, sub: 'requiring attention', change: kpiData.alertsChange, icon: AlertTriangle, iconBg: 'bg-red-100', iconColor: 'text-red-600', isDown: true },
            { label: 'Avg Response Time', value: kpiData.responseTime, sub: 'to first engagement', change: kpiData.responseChange, icon: Clock, iconBg: 'bg-green-100', iconColor: 'text-green-600', isDown: true, suffix: '%' },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">{kpi.label}</span>
                <div className={`w-8 h-8 ${kpi.iconBg} rounded-lg flex items-center justify-center`}><kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} /></div>
              </div>
              <div className="flex items-end justify-between">
                <div><div className="text-3xl font-bold text-gray-900">{kpi.value}</div><div className="text-xs text-gray-500">{kpi.sub}</div></div>
                <div className={`flex items-center text-sm font-medium ${kpi.change >= 0 ? 'text-green-600' : 'text-green-600'}`}>
                  {kpi.isDown ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  <span>{kpi.changePrefix || ''}{Math.abs(kpi.change)}{kpi.suffix || '%'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Trending Themes */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2"><TrendingUp className="w-5 h-5 text-orange-500" /><h2 className="font-semibold text-gray-900">Trending Themes</h2></div>
                <button className="text-sm text-orange-600 font-medium hover:text-orange-700">View All</button>
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
            {/* Source Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center space-x-2"><Layers className="w-5 h-5 text-orange-500" /><h2 className="font-semibold text-gray-900">By Source</h2></div>
              <div className="p-5 space-y-3">
                {sourceBreakdown.map((source, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <div className={`w-8 h-8 ${source.color} rounded-lg flex items-center justify-center text-white`}><source.icon /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-gray-700">{source.source}</span><span className="text-sm text-gray-500">{source.count}</span></div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${source.color} rounded-full`} style={{ width: `${source.percentage}%` }}></div></div>
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
                <button className="text-sm text-orange-600 font-medium hover:text-orange-700">View All</button>
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
            {/* Product Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2"><PieChart className="w-5 h-5 text-orange-500" /><h2 className="font-semibold text-gray-900">By Product</h2></div>
              </div>
              <div className="p-5 space-y-3">
                {productBreakdown.slice(0, 6).map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${idx * 45 + 20}, 70%, 50%)` }}></div>
                      <span className="text-sm font-medium text-gray-700">{product.product}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm font-medium ${getSentimentColor(product.sentiment)}`}>{product.sentiment.toFixed(2)}</span>
                      <span className="text-sm text-gray-500 w-12 text-right">{product.count}</span>
                      <span className="text-xs text-gray-400 w-10 text-right">{product.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                <button className="px-4 py-2 bg-white text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-50 transition-colors">View Report</button>
                <button className="px-4 py-2 bg-orange-400 text-white text-sm font-medium rounded-lg hover:bg-orange-300 transition-colors">Share</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* AI Chat Button */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all hover:scale-105 z-50">
          <Sparkles className="w-6 h-6 text-white" />
        </button>
      )}

      <AIChatbot isOpen={chatOpen} onClose={() => { setChatOpen(false); setChatExpanded(false); }} isExpanded={chatExpanded} onToggleExpand={() => setChatExpanded(!chatExpanded)} />
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
