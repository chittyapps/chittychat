/**
 * ChittyChat AI Agent Dashboard
 * React component for managing AI agents with Neon integration
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot,
  Plus,
  Activity,
  Database,
  Users,
  Brain,
  Search,
  GitBranch,
  Shield,
  BarChart3
} from 'lucide-react';

const AI_AGENT_API_BASE = 'https://agents.chitty.cc';

export default function AIAgentDashboard() {
  const [agents, setAgents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('chitty_token'));
  const [user, setUser] = useState(null);

  // Agent creation form
  const [newAgent, setNewAgent] = useState({
    name: '',
    type: '',
    capabilities: {}
  });

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [agentsRes, sessionsRes, analyticsRes] = await Promise.all([
        fetch(`${AI_AGENT_API_BASE}/agents/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${AI_AGENT_API_BASE}/agents/sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${AI_AGENT_API_BASE}/analytics/usage`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.agents || []);
      }

      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData.analytics);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const response = await fetch(`${AI_AGENT_API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('chitty_token', data.token);
        loadDashboardData();
      } else {
        alert('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleCreateAgent = async () => {
    try {
      const response = await fetch(`${AI_AGENT_API_BASE}/agents/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAgent)
      });

      if (response.ok) {
        const data = await response.json();
        setAgents([...agents, data.agent]);
        setNewAgent({ name: '', type: '', capabilities: {} });
      } else {
        alert('Failed to create agent');
      }
    } catch (error) {
      console.error('Agent creation error:', error);
    }
  };

  const handleCoordinateAgents = async (taskDescription) => {
    try {
      const response = await fetch(`${AI_AGENT_API_BASE}/agents/coordinate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ taskDescription, maxAgents: 3 })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Coordination started: ${data.coordination.coordinationId}`);
        loadDashboardData();
      }
    } catch (error) {
      console.error('Coordination error:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getAgentStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'hibernating': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (!token) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8" />
          ChittyChat AI Agents
        </h1>
        <Button
          onClick={() => setToken(null)}
          variant="outline"
        >
          Logout
        </Button>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Agents</p>
                  <p className="text-2xl font-bold">{analytics.agents?.active_agents || 0}</p>
                </div>
                <Bot className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                  <p className="text-2xl font-bold">{analytics.sessions?.total_sessions || 0}</p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-2xl font-bold">{analytics.projects?.active_projects || 0}</p>
                </div>
                <Database className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                  <p className="text-2xl font-bold">{analytics.sessions?.recent_sessions || 0}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">AI Agents</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="coordination">Coordination</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          {/* Create New Agent */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New AI Agent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Agent Name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                />
                <select
                  className="border rounded-md p-2"
                  value={newAgent.type}
                  onChange={(e) => setNewAgent({...newAgent, type: e.target.value})}
                >
                  <option value="">Select Type</option>
                  <option value="claude">Claude Agent</option>
                  <option value="gpt">GPT Agent</option>
                  <option value="custom">Custom Agent</option>
                  <option value="coordinator">Coordination Agent</option>
                </select>
                <Button
                  onClick={handleCreateAgent}
                  disabled={!newAgent.name || !newAgent.type}
                >
                  Create Agent
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agents List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Badge className={getAgentStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{agent.type}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-4 w-4" />
                      Branch: {agent.branch_id || 'main'}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Brain className="h-4 w-4" />
                      Capabilities: {Object.keys(agent.capabilities || {}).length}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created: {formatDate(agent.created_at)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent AI Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{session.agent_name}</h4>
                        <p className="text-sm text-gray-600">{session.agent_type}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(session.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline">
                        Session {session.id.split('-')[0]}
                      </Badge>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    No sessions found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coordination" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Multi-Agent Coordination
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Describe the task for agent coordination..."
                    id="coordination-task"
                  />
                  <Button
                    onClick={() => {
                      const task = document.getElementById('coordination-task').value;
                      if (task) handleCoordinateAgents(task);
                    }}
                  >
                    Coordinate Agents
                  </Button>
                </div>
                <div className="text-sm text-gray-600">
                  Enter a task description and ChittyChat will automatically select
                  the best agents and create a shared workspace for collaboration.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Tenant Information</h4>
                  <p className="text-sm text-gray-600">
                    Tenant ID: {user?.tenant_id}
                  </p>
                  <p className="text-sm text-gray-600">
                    Role: {user?.role}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Database Isolation</h4>
                  <p className="text-sm text-gray-600">
                    All AI agents are isolated to your tenant with Row-Level Security (RLS)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Neon Features</h4>
                  <ul className="text-sm text-gray-600 list-disc list-inside">
                    <li>Database branching for agent isolation</li>
                    <li>Vector search with pg_search extension</li>
                    <li>Scale-to-zero cost optimization</li>
                    <li>Automated backup and recovery</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            ChittyChat AI Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}