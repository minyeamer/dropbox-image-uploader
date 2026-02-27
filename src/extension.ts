import * as vscode from 'vscode';
import * as path from 'path';
import { uploadImageToDropbox } from './dropboxService';

export function activate(context: vscode.ExtensionContext) {
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dropboxImageUploader.uploadImage', uploadImagesViaDialog),
        vscode.commands.registerCommand('dropboxImageUploader.pasteImage', pasteImageFromClipboard)
    );
}

async function uploadImagesViaDialog() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showWarningMessage('This command is only available in Markdown files.');
        return;
    }

    // Check upload path setting
    const config = vscode.workspace.getConfiguration('dropboxImageUploader');
    const useCustomPath = config.get<boolean>('useCustomPath', false);
    
    let targetFolder: string | undefined;
    if (!useCustomPath) {
        targetFolder = await vscode.window.showInputBox({
            prompt: 'Enter the Dropbox upload path',
            placeHolder: '/apps',
            value: '/apps',
            validateInput: (value) => {
                if (!value?.trim()) return 'Please enter a path';
                if (!value.startsWith('/')) return 'Path must start with /';
                return null;
            }
        });
        
        if (!targetFolder) return;
    }

    // Select image files
    const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] },
        openLabel: 'Upload to Dropbox'
    });

    if (fileUris?.length) {
        await uploadAndInsertImages(fileUris.map(uri => uri.fsPath), editor, targetFolder);
    }
}

async function pasteImageFromClipboard() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showWarningMessage('This command is only available in Markdown files.');
        return;
    }

    vscode.window.showInformationMessage(
        'Clipboard paste is not yet supported. Please use the "Upload Image to Dropbox" command instead.'
    );
}

async function uploadAndInsertImages(filePaths: string[], editor: vscode.TextEditor, targetFolder?: string) {
    const config = vscode.workspace.getConfiguration('dropboxImageUploader');
    const displayPath = targetFolder || config.get<string>('uploadPath', '/apps');

    const count = filePaths.length;
    const imageWord = count === 1 ? 'image' : 'images';

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Uploading ${count} ${imageWord} to Dropbox... (${displayPath})`,
            cancellable: false
        },
        async (progress) => {
            const markdownLinks: string[] = [];

            for (let i = 0; i < filePaths.length; i++) {
                const filePath = filePaths[i];
                progress.report({
                    message: `${i + 1}/${filePaths.length} - ${path.basename(filePath)}`,
                    increment: (100 / filePaths.length)
                });

                try {
                    const sharedLink = await uploadImageToDropbox(filePath, targetFolder);
                    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
                    markdownLinks.push(`![${fileNameWithoutExt}](${sharedLink})`);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to upload image (${path.basename(filePath)}): ${error.message}`);
                }
            }

            if (markdownLinks.length > 0) {
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, markdownLinks.join('\n') + '\n');
                });
                const uploadedCount = markdownLinks.length;
                const uploadedWord = uploadedCount === 1 ? 'image' : 'images';
                vscode.window.showInformationMessage(`✅ Successfully uploaded ${uploadedCount} ${uploadedWord}!`);
            }
        }
    );
}

export function deactivate() {
    console.log('Dropbox Image Uploader is now deactivated.');
}