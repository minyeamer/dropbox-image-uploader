# Testing Guide

## Prerequisites

### 1. Verify ffmpeg Installation

```bash
ffmpeg -version
```

If not installed:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg

# Windows (winget)
winget install ffmpeg
```

### 2. Setup Dropbox Access Token

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app → **Settings** tab
3. Generate an access token
4. Open VS Code Settings (`Cmd/Ctrl + ,`)
5. Search for **"Dropbox Image Uploader"**
6. Paste token into **Access Token** field

### 3. Compile and Run

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch Extension Development Host.

---

## Test Scenarios

### Test 1: Basic Upload

**Steps:**
1. Open a Markdown file (`.md`)
2. Press `Cmd + Shift + P` → "Upload Image to Dropbox"
3. Select an image file
4. Verify Markdown link is inserted: `![image-name](https://dl.dropboxusercontent.com/...)`

**Expected:** Image uploads successfully and link is inserted at cursor position.

---

### Test 2: Multiple Images Upload

**Steps:**
1. Open a Markdown file
2. Press `Cmd + Alt + U` (Mac) or `Ctrl + Alt + U` (Windows/Linux)
3. Select multiple images (Cmd/Ctrl + click)
4. Wait for upload to complete

**Expected:** 
- Progress notification shows "Uploading N images to Dropbox..."
- All images are uploaded
- Multiple Markdown links are inserted, one per line
- Success message: "✅ Successfully uploaded N images!"

---

### Test 3: Format Conversion (WebP)

**Setup:**
1. Open Settings (`Cmd/Ctrl + ,`)
2. Search "Dropbox Image Uploader"
3. Set **Image Format** to `webp`
4. Set **Max Image Size** to `1920`

**Steps:**
1. Upload a PNG or JPEG image
2. Check the uploaded file on Dropbox

**Expected:**
- Image is converted to WebP format
- If larger than 1920px, it's resized (aspect ratio preserved)
- Filename ends with `.webp`

---

### Test 4: Resize Only (No Format Conversion)

**Setup:**
1. Set **Image Format** to empty (no format)
2. Set **Max Image Size** to `1280`

**Steps:**
1. Upload a large image (e.g., 4K resolution)
2. Upload a small image (e.g., 500x500)

**Expected:**
- Large image: Resized to max 1280px on longest dimension
- Small image: No resizing (uploaded as-is)
- Original format is preserved

---

### Test 5: Format Conversion Only

**Setup:**
1. Set **Image Format** to `jpg`
2. Set **Max Image Size** to `0` (disable resizing)

**Steps:**
1. Upload a PNG image

**Expected:**
- Image is converted to JPEG
- Original dimensions are preserved

---

### Test 6: Skip Conversion

**Setup:**
1. Set **Image Format** to `png`
2. Set **Max Image Size** to `5000`

**Steps:**
1. Upload a small PNG image (e.g., 800x600)

**Expected:**
- Conversion is skipped (already PNG and smaller than 5000px)
- Original file is uploaded directly (faster)

---

### Test 7: No ffmpeg Warning

**Setup:**
1. Temporarily rename ffmpeg (or remove from PATH)
2. Set **Image Format** to `webp`

**Steps:**
1. Try to upload an image

**Expected:**
- Warning appears: "⚠️ ffmpeg is not installed. Image conversion will be skipped."
- Original image is uploaded successfully
- Upload completes without errors

---

### Test 8: Mixed Format Upload

**Steps:**
1. Select multiple images of different formats (PNG, JPEG, WebP)
2. Upload them together

**Expected:**
- All images upload successfully
- Each image is processed according to settings
- Progress shows current image being uploaded

---

### Test 9: Custom Upload Path

**Setup:**
1. Disable **Use Custom Path** (uncheck)

**Steps:**
1. Upload an image
2. Enter custom path: `/blog-images`
3. Complete upload

**Expected:**
- Input dialog appears asking for path
- Path validation works (must start with `/`)
- Image is uploaded to specified folder

---

### Test 10: Context Menu Upload

**Steps:**
1. Open a Markdown file
2. Right-click in the editor
3. Select **"Upload Image to Dropbox"**

**Expected:** File picker opens, upload works normally.

---

## Debugging

### Check Developer Console

```
Cmd/Ctrl + Shift + I → Console tab
```

Look for:
- `"Image conversion will be skipped"` - ffmpeg not available
- `"Image conversion failed"` - conversion error
- Error messages from Dropbox API

### Check Temporary Files

Converted images are stored in `/tmp/` (macOS/Linux) or `%TEMP%` (Windows) and automatically deleted after upload.

```bash
# macOS/Linux
ls /tmp/*.webp /tmp/*.jpg

# Windows PowerShell
Get-ChildItem $env:TEMP\*.webp
```

---

## Troubleshooting

### "ffmpeg is not installed"

**Cause:** ffmpeg is not in system PATH

**Solution:**
```bash
# Verify installation
which ffmpeg  # macOS/Linux
where ffmpeg  # Windows

# Install if missing (see Prerequisites)

# Restart VS Code after installation
```

### "Image conversion failed"

**Cause:** Invalid image file or unsupported format

**Solution:**
- Verify the image file isn't corrupted
- Try a different image
- Conversion will be skipped and original file uploaded

### "Dropbox authentication failed"

**Cause:** Invalid or expired access token

**Solution:**
- Generate a new token at [Dropbox App Console](https://www.dropbox.com/developers/apps)
- Update token in VS Code settings
- Reload VS Code

### "This command is only available in Markdown files"

**Cause:** Trying to use the extension in a non-Markdown file

**Solution:** Open a `.md` file before uploading images

---

## Performance Benchmarks

### Conversion Time (Approximate)
- 1MB PNG → WebP: ~1 second
- 10MB PNG → WebP + resize: ~3 seconds
- 100KB PNG → WebP: ~0.5 seconds

### WebP Compression
- vs PNG: 70-80% size reduction
- vs JPEG: 25-35% size reduction
- Quality: 90 (near-lossless)

### Network Upload Speed
Depends on your internet connection and Dropbox API throttling.

---

## Supported Formats

### Input Formats
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- BMP (`.bmp`)
- WebP (`.webp`)
- SVG (`.svg`)

### Output Formats (Conversion)
- WebP (recommended for web)
- JPEG (good compatibility)
- PNG (lossless)

---

## Advanced Testing

### Edge Cases

1. **Very large images** (8K, 16K)
2. **Very small images** (10x10 pixels)
3. **Extreme aspect ratios** (21:9, 9:21)
4. **Animated GIFs** (may lose animation in conversion)
5. **Images with transparency** (PNG → JPEG may add white background)
6. **Special characters in filenames** (spaces, unicode)

### Stress Testing

1. Upload 10+ images simultaneously
2. Upload while offline (should show error)
3. Upload with slow internet connection
4. Cancel VS Code during upload (cleanup should work)

---

## Expected Behavior Summary

| Scenario | Input | Settings | Expected Output |
|----------|-------|----------|----------------|
| No conversion | PNG 800x600 | Format: empty, Size: 0 | PNG 800x600 |
| Format only | PNG 800x600 | Format: webp, Size: 0 | WebP 800x600 |
| Resize only | PNG 2560x1440 | Format: empty, Size: 1920 | PNG 1920x1080 |
| Both | PNG 2560x1440 | Format: webp, Size: 1920 | WebP 1920x1080 |
| Skip (same format) | WebP 800x600 | Format: webp, Size: 0 | WebP 800x600 (no conversion) |
| Skip (small size) | PNG 800x600 | Format: png, Size: 1920 | PNG 800x600 (no conversion) |
