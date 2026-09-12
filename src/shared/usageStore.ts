import { AgentSnapshot } from './types';

export type UsageStoreListener = (snapshots: AgentSnapshot[]) => void;

/**
 * Holds the latest published snapshot per agent provider and notifies
 * listeners whenever one changes. No `vscode` import: this is the shared
 * data source for both the status bar controller (writer) and the sidebar
 * panel (reader), and stays independently unit-testable.
 */
export class UsageStore {
  private readonly snapshotsByProviderId = new Map<string, AgentSnapshot>();
  private readonly listeners = new Set<UsageStoreListener>();

  snapshots(): AgentSnapshot[] {
    return Array.from(this.snapshotsByProviderId.values());
  }

  set(snapshot: AgentSnapshot): void {
    this.snapshotsByProviderId.set(snapshot.providerId, snapshot);
    const current = this.snapshots();
    for (const listener of this.listeners) {
      listener(current);
    }
  }

  onChange(listener: UsageStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
