import * as vscode from 'vscode';
import { renderPanelHtml } from '../shared/panelHtml';
import { buildPanelModel } from '../shared/panelModel';
import { getSettings } from '../shared/settings';
import { UsageStore } from '../shared/usageStore';

// Provider icon ids that have a corresponding assets/icons/<name>.svg brand mark
// (see docs/icons.md). Add an entry here when a new provider ships one.
const ICON_IDS = ['ai-status-bar-claude', 'ai-status-bar-codex'];

/**
 * Hosts the sidebar webview. Deliberately thin: all presentation logic lives
 * in the vscode-free shared/panelModel.ts and shared/panelHtml.ts, which is
 * why there's nothing to unit-test here beyond what those modules already
 * cover (see docs/development.md on the vscode-import test boundary).
 */
export class UsageViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private icons: Record<string, string> | undefined;

  constructor(
    private readonly store: UsageStore,
    private readonly extensionUri: vscode.Uri,
  ) {
    store.onChange(() => void this.render());
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: false };
    webviewView.onDidDispose(() => {
      if (this.view === webviewView) this.view = undefined;
    });
    void this.render();
  }

  private async render(): Promise<void> {
    if (!this.view) return;
    const icons = await this.ensureIcons();
    if (!this.view) return; // disposed while the icon files were loading

    const model = buildPanelModel(this.store.snapshots(), getSettings());
    this.view.webview.html = renderPanelHtml(model, {
      cspSource: this.view.webview.cspSource,
      icons,
    });
  }

  /** Loads assets/icons/<name>.svg once and caches the raw markup, keyed by icon id. */
  private async ensureIcons(): Promise<Record<string, string>> {
    if (this.icons) return this.icons;

    const entries = await Promise.all(
      ICON_IDS.map(async (id): Promise<[string, string]> => {
        const file = `${id.replace(/^ai-status-bar-/, '')}.svg`;
        try {
          const uri = vscode.Uri.joinPath(this.extensionUri, 'assets', 'icons', file);
          const bytes = await vscode.workspace.fs.readFile(uri);
          return [id, Buffer.from(bytes).toString('utf8')];
        } catch {
          return [id, '']; // missing asset: render without a brand icon rather than fail
        }
      }),
    );

    this.icons = Object.fromEntries(entries.filter(([, svg]) => svg));
    return this.icons;
  }
}
