/**
 * Analytics types (stub implementation for cc-switch)
 */

export type EventName = string;

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
}
