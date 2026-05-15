import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
/**
 * Called when the extension is activated
 */
export function activate(context) {
    console.log('ExtensiAgent extension is now active!');
    // Register the command to start the agent
    const disposable = vscode.commands.registerCommand('extensionvalidatev1.start', () => {
        // Create and show a new webview panel
        const distDir = path.join(context.extensionPath, 'dist');
        const indexHtmlPath = path.join(distDir, 'index.html');
        const panel = vscode.window.createWebviewPanel('extensiAgent', 'ExtensiAgent', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            // Allow the bundled React build assets to be loaded into this webview
            localResourceRoots: [vscode.Uri.file(distDir)]
        });
        // Load the bundled React UI (built by Vite) from the extension's `dist/` folder.
        // Note: Vite uses absolute URLs like `/assets/...`, which we need to rewrite
        // to VS Code webview URIs.
        let html = `<!doctype html><html><body>Missing UI build: ${indexHtmlPath}</body></html>`;
        try {
            html = fs.readFileSync(indexHtmlPath, 'utf8');
            const referencedFiles = new Set();
            const attrRegex = /(href|src)="\/([^"]+)"/g;
            for (const match of html.matchAll(attrRegex)) {
                const rel = match[2];
                if (rel)
                    referencedFiles.add(rel);
            }
            for (const rel of referencedFiles) {
                const diskPath = path.join(distDir, rel);
                if (!fs.existsSync(diskPath))
                    continue;
                const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(diskPath));
                html = html.split(`/${rel}`).join(webviewUri.toString());
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            html = `<!doctype html><html><body>Failed to load UI from dist/: ${message}</body></html>`;
        }
        panel.webview.html = html;
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'getCurrentFile':
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const document = editor.document;
                        const content = document.getText();
                        panel.webview.postMessage({
                            command: 'currentFile',
                            data: {
                                content,
                                fileName: document.fileName,
                                language: document.languageId
                            }
                        });
                    }
                    break;
                case 'getSelectedText':
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        const selection = activeEditor.selection;
                        const text = activeEditor.document.getText(selection);
                        panel.webview.postMessage({
                            command: 'selectedText',
                            data: text
                        });
                    }
                    break;
                case 'showNotification':
                    vscode.window.showInformationMessage(message.text);
                    break;
                case 'getWorkspaceFiles':
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (workspaceFolders) {
                        const files = await vscode.workspace.findFiles('**/*.*', '**/node_modules/**');
                        panel.webview.postMessage({
                            command: 'workspaceFiles',
                            data: files.map(f => f.fsPath)
                        });
                    }
                    break;
                case 'openExternal':
                    // Use VS Code API to open URLs externally
                    try {
                        const uri = vscode.Uri.parse(message.url);
                        await vscode.env.openExternal(uri);
                        panel.webview.postMessage({
                            command: 'externalLinkOpened',
                            success: true
                        });
                    }
                    catch (error) {
                        panel.webview.postMessage({
                            command: 'externalLinkOpened',
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                    break;
            }
        });
    });
    context.subscriptions.push(disposable);
}
/**
 * Called when the extension is deactivated
 */
export function deactivate() {
    console.log('ExtensiAgent extension is now deactivated!');
}
//# sourceMappingURL=extension.js.map