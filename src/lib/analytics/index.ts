/**
 * Analytics stub implementation for cc-switch
 *
 * This is a no-op implementation that satisfies the analytics API
 * without actually tracking any events.
 */

import type { EventName } from './types';

export type { EventName } from './types';

// No-op analytics instance
export const analytics = {
  isEnabled: () => false,
  hasConsented: () => false,
  track: (_eventName: string, _properties?: Record<string, any>) => {},
  setScreen: (_screenName: string) => {},
  shutdown: () => {},
  identify: (_userId: string, _traits?: Record<string, any>) => {},
  reset: () => {},
};

// Event names (empty object since we don't track)
export const ANALYTICS_EVENTS = {
  APP_STARTED: 'app_started',
  APP_CLOSED: 'app_closed',
  SESSION_COMPLETED: 'session_completed',
  SESSION_RESUMED: 'session_resumed',
  TAB_CREATED: 'tab_created',
  TAB_CLOSED: 'tab_closed',
  FILE_OPENED: 'file_opened',
  FILE_EDITED: 'file_edited',
  FILE_SAVED: 'file_saved',
  MCP_SERVER_DISCONNECTED: 'mcp_server_disconnected',
  SETTINGS_CHANGED: 'settings_changed',
} as const;

// Helper function to create no-op event
const noopEvent = (event: string, properties?: Record<string, any>) => ({
  event,
  properties: properties || {},
});

// Event builders - all return no-op events
export const eventBuilders = {
  session: (props: { model?: string; source?: string; resumed?: boolean; checkpoint_id?: string }) =>
    noopEvent('session_created', props),

  feature: (feature: string, subfeature?: string, metadata?: Record<string, any>) =>
    noopEvent('feature_used', { feature, subfeature, ...metadata }),

  model: (newModel: string, previousModel?: string, source?: string) =>
    noopEvent('model_selected', { new_model: newModel, previous_model: previousModel, source }),

  agent: (agentType: string, success: boolean, agentName?: string, durationMs?: number) =>
    noopEvent('agent_executed', { agent_type: agentType, success, agent_name: agentName, duration_ms: durationMs }),

  mcp: (serverName: string, success: boolean, serverType?: string) =>
    noopEvent('mcp_server_connected', { server_name: serverName, success, server_type: serverType }),

  slashCommand: (command: string, success: boolean) =>
    noopEvent('slash_command_used', { command, success }),

  error: (errorType: string, errorCode?: string, context?: string) =>
    noopEvent('error_occurred', { error_type: errorType, error_code: errorCode, context }),

  performance: (metrics: Record<string, number>) =>
    noopEvent('performance_metrics', metrics),

  // Claude Code Session events
  promptSubmitted: (props: Record<string, any>) =>
    noopEvent('prompt_submitted', props),

  sessionStopped: (props: Record<string, any>) =>
    noopEvent('session_stopped', props),

  enhancedSessionStopped: (props: Record<string, any>) =>
    noopEvent('enhanced_session_stopped', props),

  checkpointCreated: (props: Record<string, any>) =>
    noopEvent('checkpoint_created', props),

  checkpointRestored: (props: Record<string, any>) =>
    noopEvent('checkpoint_restored', props),

  toolExecuted: (props: Record<string, any>) =>
    noopEvent('tool_executed', props),

  // Agent events
  agentStarted: (props: Record<string, any>) =>
    noopEvent('agent_started', props),

  agentProgress: (props: Record<string, any>) =>
    noopEvent('agent_progress', props),

  agentError: (props: Record<string, any>) =>
    noopEvent('agent_error', props),

  // MCP events
  mcpServerAdded: (props: Record<string, any>) =>
    noopEvent('mcp_server_added', props),

  mcpServerRemoved: (props: Record<string, any>) =>
    noopEvent('mcp_server_removed', props),

  mcpToolInvoked: (props: Record<string, any>) =>
    noopEvent('mcp_tool_invoked', props),

  mcpConnectionError: (props: Record<string, any>) =>
    noopEvent('mcp_connection_error', props),

  // Slash command events
  slashCommandSelected: (props: Record<string, any>) =>
    noopEvent('slash_command_selected', props),

  slashCommandExecuted: (props: Record<string, any>) =>
    noopEvent('slash_command_executed', props),

  slashCommandCreated: (props: Record<string, any>) =>
    noopEvent('slash_command_created', props),

  // Error and performance events
  apiError: (props: Record<string, any>) =>
    noopEvent('api_error', props),

  uiError: (props: Record<string, any>) =>
    noopEvent('ui_error', props),

  performanceBottleneck: (props: Record<string, any>) =>
    noopEvent('performance_bottleneck', props),

  memoryWarning: (props: Record<string, any>) =>
    noopEvent('memory_warning', props),

  // User journey events
  journeyMilestone: (props: Record<string, any>) =>
    noopEvent('journey_milestone', props),

  // Enhanced tracking
  enhancedPromptSubmitted: (props: Record<string, any>) =>
    noopEvent('enhanced_prompt_submitted', props),

  enhancedToolExecuted: (props: Record<string, any>) =>
    noopEvent('enhanced_tool_executed', props),

  enhancedError: (props: Record<string, any>) =>
    noopEvent('enhanced_error', props),

  // Session engagement
  sessionEngagement: (props: Record<string, any>) =>
    noopEvent('session_engagement', props),

  // Feature discovery
  featureDiscovered: (props: Record<string, any>) =>
    noopEvent('feature_discovered', props),

  featureAdopted: (props: Record<string, any>) =>
    noopEvent('feature_adopted', props),

  featureCombination: (props: Record<string, any>) =>
    noopEvent('feature_combination', props),

  // Quality metrics
  outputRegenerated: (props: Record<string, any>) =>
    noopEvent('output_regenerated', props),

  conversationAbandoned: (reason: string, messagesCount: number) =>
    noopEvent('conversation_abandoned', { reason, messages_count: messagesCount }),

  suggestionAccepted: (props: Record<string, any>) =>
    noopEvent('suggestion_accepted', props),

  suggestionRejected: (props: Record<string, any>) =>
    noopEvent('suggestion_rejected', props),

  // AI interactions
  aiInteraction: (props: Record<string, any>) =>
    noopEvent('ai_interaction', props),

  promptPattern: (props: Record<string, any>) =>
    noopEvent('prompt_pattern', props),

  // Workflow tracking
  workflowStarted: (props: Record<string, any>) =>
    noopEvent('workflow_started', props),

  workflowCompleted: (props: Record<string, any>) =>
    noopEvent('workflow_completed', props),

  workflowAbandoned: (props: Record<string, any>) =>
    noopEvent('workflow_abandoned', props),

  // Network performance
  networkPerformance: (props: Record<string, any>) =>
    noopEvent('network_performance', props),

  networkFailure: (props: Record<string, any>) =>
    noopEvent('network_failure', props),

  // Resource usage
  resourceUsageHigh: (props: Record<string, any>) =>
    noopEvent('resource_usage_high', props),

  resourceUsageSampled: (props: Record<string, any>) =>
    noopEvent('resource_usage_sampled', props),
};
