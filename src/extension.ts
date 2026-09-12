import * as vscode from 'vscode';
import { ClaudeProvider } from './agents/claude';
import { CodexProvider } from './agents/codex';
import { AgentStatusController } from './shared/statusController';

const INITIAL_POLL_DELAY_MS = 3_000;
const PROVIDER_POLL_STAGGER_MS = 1_500;

export function activate(context: vscode.ExtensionContext): void {
  const providers = [
    new CodexProvider(),
    new ClaudeProvider(),
  ];

  const controllers = providers.map((provider, index) => {
    const controller = new AgentStatusController(context, provider, 100 - index);
    context.subscriptions.push(controller);
    controller.start(INITIAL_POLL_DELAY_MS + index * PROVIDER_POLL_STAGGER_MS);
    return controller;
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('aiStatusBar.refresh', () => {
      controllers.forEach((controller) => controller.refresh());
    }),
  );
}

export function deactivate(): void {}
