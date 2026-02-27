import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

/**
 * Checks whether ffmpeg is installed on the system.
 * @returns Whether ffmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
    try {
        await execAsync('ffmpeg -version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Retrieves the dimensions (width, height) of an image file.
 * @param filePath Path to the image file
 * @returns { width: number, height: number }
 */
async function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
    try {
        const { stdout } = await execAsync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${filePath}"`
        );
        const [width, height] = stdout.trim().split(',').map(Number);
        return { width, height };
    } catch (error) {
        throw new Error(`Failed to get image dimensions: ${error}`);
    }
}

/**
 * Determines whether the image needs to be converted.
 * @param filePath Path to the source image file
 * @param targetFormat Target format (e.g. 'webp')
 * @param maxSize Maximum dimension in pixels (0 to skip check)
 * @returns Whether conversion is needed
 */
async function needsConversion(
    filePath: string,
    targetFormat: string,
    maxSize: number
): Promise<boolean> {
    // Check if format conversion is needed
    const currentExt = path.extname(filePath).toLowerCase().replace('.', '');
    const targetExt = targetFormat.toLowerCase();
    
    const formatNeedsChange = Boolean(targetFormat && currentExt !== targetExt);
    
    // Check if resizing is needed
    if (maxSize > 0) {
        try {
            const { width, height } = await getImageDimensions(filePath);
            const maxDimension = Math.max(width, height);
            if (maxDimension > maxSize) {
                return true;
            }
        } catch (error) {
            console.error('Failed to get image dimensions:', error);
        }
    }
    
    return formatNeedsChange;
}

/**
 * Converts an image using ffmpeg.
 * @param inputPath Path to the input image
 * @param targetFormat Target format (empty string to keep original)
 * @param maxSize Maximum dimension in pixels (0 to skip resizing)
 * @returns Path to the converted image, or the original path if no conversion was needed
 */
export async function convertImage(
    inputPath: string,
    targetFormat: string,
    maxSize: number
): Promise<string> {
    // Check ffmpeg availability
    const hasFfmpeg = await checkFfmpegAvailable();
    if (!hasFfmpeg) {
        vscode.window.showWarningMessage(
            '⚠️ ffmpeg is not installed. Image conversion will be skipped.'
        );
        return inputPath;
    }

    // Check whether conversion is needed
    const needs = await needsConversion(inputPath, targetFormat, maxSize);
    if (!needs) {
        return inputPath;
    }

    try {
        // Build output file path
        const inputExt = path.extname(inputPath);
        const inputBasename = path.basename(inputPath, inputExt);
        const outputExt = targetFormat ? `.${targetFormat}` : inputExt;
        const outputPath = path.join(os.tmpdir(), `${inputBasename}${outputExt}`);

        // Build ffmpeg command
        let ffmpegCmd = `ffmpeg -y -i "${inputPath}"`;

        // Apply resizing
        if (maxSize > 0) {
            const { width, height } = await getImageDimensions(inputPath);
            const maxDimension = Math.max(width, height);
            
            if (maxDimension > maxSize) {
                // Scale by width if landscape, by height if portrait
                if (width > height) {
                    ffmpegCmd += ` -vf "scale=${maxSize}:-1"`;
                } else {
                    ffmpegCmd += ` -vf "scale=-1:${maxSize}"`;
                }
            }
        }

        // Apply format-specific encoding options
        if (targetFormat) {
            const format = targetFormat.toLowerCase();
            if (format === 'webp') {
                ffmpegCmd += ` -c:v libwebp -q:v 90`;
            } else if (format === 'jpg') {
                ffmpegCmd += ` -q:v 2`;
            } else if (format === 'png') {
                ffmpegCmd += ` -c:v png`;
            }
        }

        ffmpegCmd += ` "${outputPath}"`;

        // Run conversion
        await execAsync(ffmpegCmd);

        // Verify output file was created
        if (!fs.existsSync(outputPath)) {
            throw new Error('Converted file was not created');
        }

        return outputPath;
    } catch (error: any) {
        vscode.window.showWarningMessage(
            `⚠️ Image conversion failed: ${error.message}. Uploading the original file instead.`
        );
        return inputPath;
    }
}

/**
 * Deletes a temporary file.
 * @param filePath Path to the file to delete
 */
export function cleanupTempFile(filePath: string): void {
    try {
        if (filePath.includes(os.tmpdir()) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Failed to delete temporary file:', error);
    }
}
