import { Dropbox } from 'dropbox';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { convertImage, cleanupTempFile } from './imageProcessor';

/**
 * Retrieves the Dropbox Access Token from VS Code settings.
 * @returns Access Token or undefined
 */
function getAccessTokenFromConfig(): string | undefined {
    const config = vscode.workspace.getConfiguration('dropboxImageUploader');
    return config.get<string>('accessToken');
}

/**
 * Retrieves the upload path from VS Code settings.
 * @returns Upload path
 */
function getUploadPathFromConfig(): string {
    const config = vscode.workspace.getConfiguration('dropboxImageUploader');
    let uploadPath = config.get<string>('uploadPath', '/apps');
    
    // Normalize path: add leading / if missing
    if (!uploadPath.startsWith('/')) {
        uploadPath = '/' + uploadPath;
    }
    
    return uploadPath;
}

/**
 * Initializes a Dropbox client.
 * Retrieves the Access Token from VS Code settings.
 */
function getDropboxClient(): Dropbox {
    const token = getAccessTokenFromConfig();
    
    if (!token || token.trim() === '') {
        throw new Error(
            'Dropbox Access Token is not configured.\n\n' +
            'Go to VS Code Settings (Cmd + ,) → Search "Dropbox Image Uploader" → Enter Access Token\n\n' +
            'Generate a token at: https://www.dropbox.com/developers/apps'
        );
    }
    
    if (token.startsWith('sl.u.')) {
        vscode.window.showWarningMessage(
            '⚠️ You are using a short-lived token. It will expire in 4 hours.',
            'How to Refresh Token'
        ).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse('https://www.dropbox.com/developers/apps'));
            }
        });
    }
    
    return new Dropbox({ 
        accessToken: token,
        fetch: fetch
    });
}

/**
 * Uploads an image file to Dropbox and returns a shared link.
 * @param filePath Local path of the image file to upload
 * @param targetFolder Upload folder path in Dropbox (optional, uses configured or default path)
 * @returns Shared link URL
 */
export async function uploadImageToDropbox(filePath: string, targetFolder?: string): Promise<string> {
    const dbx = getDropboxClient();
    let processedFilePath = filePath;
    let isTempFile = false;
    
    try {
        // Get image conversion settings
        const config = vscode.workspace.getConfiguration('dropboxImageUploader');
        const imageFormat = config.get<string>('imageFormat', '');
        const maxImageSize = config.get<number>('maxImageSize', 0);

        // Convert image if needed
        if (imageFormat || maxImageSize > 0) {
            processedFilePath = await convertImage(filePath, imageFormat, maxImageSize);
            isTempFile = processedFilePath !== filePath;
        }

        const fileBuffer = fs.readFileSync(processedFilePath);
        const fileName = path.basename(processedFilePath);
        const folder = targetFolder || getUploadPathFromConfig();
        const dropboxPath = `${folder}/${fileName}`;

        // Upload file to Dropbox
        await dbx.filesUpload({
            path: dropboxPath,
            contents: fileBuffer,
            mode: { '.tag': 'add' },
            autorename: true,
            mute: false,
        });

        // Create shared link and convert to direct download link
        const sharedLink = await createSharedLink(dropboxPath);
        return sharedLink.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('&dl=0', '&raw=1');
    } catch (error: any) {
        if (error.status === 401) {
            throw new Error('Dropbox authentication failed: Access Token is invalid or expired. Please enter a new token in VS Code settings.');
        }
        if (error.status === 403) {
            throw new Error('Permission error: Change app permissions to Full Dropbox and generate a new token.');
        }
        throw new Error(`Failed to upload to Dropbox: ${error.message || error}`);
    } finally {
        // Clean up temporary file
        if (isTempFile) {
            cleanupTempFile(processedFilePath);
        }
    }
}

/**
 * Creates a shared link for a Dropbox file.
 * @param dropboxPath Path to the file in Dropbox
 * @returns Shared link URL
 */
async function createSharedLink(dropboxPath: string): Promise<string> {
    const dbx = getDropboxClient();
    
    try {
        // Check for existing shared links
        const existingLinks = await dbx.sharingListSharedLinks({ 
            path: dropboxPath,
            direct_only: true
        });
        
        if (existingLinks.result.links.length > 0) {
            return existingLinks.result.links[0].url;
        }

        // Create a new shared link
        try {
            const response = await dbx.sharingCreateSharedLinkWithSettings({
                path: dropboxPath,
                settings: {
                    requested_visibility: { '.tag': 'public' },
                },
            });
            return response.result.url;
        } catch (error: any) {
            // If link already exists, fetch it again
            if (error.error?.error?.['.tag'] === 'shared_link_already_exists') {
                const retryLinks = await dbx.sharingListSharedLinks({ path: dropboxPath });
                if (retryLinks.result.links.length > 0) {
                    return retryLinks.result.links[0].url;
                }
            }
            throw error;
        }
    } catch (error: any) {
        throw new Error(`Failed to create shared link: ${error.message || error}`);
    }
}