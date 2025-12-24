/**
 * ChatPage - Claude Code Session Integration
 *
 * This is the main entry point for the Claude Code session/chat functionality
 * that was migrated from the opcode project.
 */

import { useState, useEffect } from 'react';
import { MessageSquare, FolderOpen, History, Bot, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectList } from '@/components/chat/ProjectList';
import { SessionList } from '@/components/chat/SessionList';
import { ClaudeCodeSession } from '@/components/chat/ClaudeCodeSession';
import { ErrorBoundary } from '@/components/chat/ErrorBoundary';
import { useSessionStore } from '@/stores/sessionStore';
import { api, type Project, type Session } from '@/lib/api';

interface ChatPageProps {
  onClose: () => void;
}

type ChatTab = 'session' | 'projects' | 'history';

export function ChatPage({ onClose }: ChatPageProps) {
  const [activeTab, setActiveTab] = useState<ChatTab>('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const {
    currentSession,
    setCurrentSession,
  } = useSessionStore();

  // Load projects on mount
  useEffect(() => {
    setIsLoadingProjects(true);
    api.listProjects()
      .then(setProjects)
      .catch(err => console.error('Failed to load projects:', err))
      .finally(() => setIsLoadingProjects(false));
  }, []);

  // Load sessions when a project is selected
  useEffect(() => {
    if (selectedProject) {
      api.getProjectSessions(selectedProject.id)
        .then(setSessions)
        .catch(err => console.error('Failed to load sessions:', err));
    }
  }, [selectedProject]);

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setActiveTab('history');
  };

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setCurrentSession(session.id);
    setActiveTab('session');
  };

  const handleNewSession = () => {
    if (!selectedProject) {
      setActiveTab('projects');
      return;
    }
    setSelectedSession(null);
    setActiveTab('session');
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setSelectedSession(null);
    setActiveTab('projects');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'projects':
        return (
          <div className="h-full overflow-auto p-4">
            <ProjectList
              projects={projects}
              onProjectClick={handleProjectClick}
              loading={isLoadingProjects}
            />
          </div>
        );

      case 'history':
        if (!selectedProject) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Project Selected</h3>
              <p className="text-muted-foreground mb-4">
                Select a project to view its session history
              </p>
              <Button onClick={() => setActiveTab('projects')}>
                Browse Projects
              </Button>
            </div>
          );
        }
        return (
          <div className="h-full overflow-auto p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">{selectedProject.path.split('/').pop() || selectedProject.path}</h3>
                <p className="text-sm text-muted-foreground">{selectedProject.path}</p>
              </div>
              <Button onClick={handleNewSession}>
                <MessageSquare className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </div>
            <SessionList
              sessions={sessions}
              projectPath={selectedProject.path}
              onSessionClick={handleSessionClick}
            />
          </div>
        );

      case 'session':
      default:
        return (
          <ErrorBoundary>
            <ClaudeCodeSession
              session={selectedSession || currentSession || undefined}
              initialProjectPath={selectedProject?.path}
              onBack={handleBackToProjects}
            />
          </ErrorBoundary>
        );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-500" />
          <span className="font-medium">Claude Code</span>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChatTab)}>
            <TabsList>
              <TabsTrigger value="session" className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Session</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-1">
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
}
