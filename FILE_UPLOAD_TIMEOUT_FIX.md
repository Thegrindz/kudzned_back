# File Upload Timeout Fix

## Issue Identified
The Cloudinary uploads were failing due to **Request Timeout** errors, not configuration issues. The specific problem was:

- **71MB video file** being uploaded (`Movie on 14-01-2026 at 01.24.mov`)
- Cloudinary timing out during the upload process
- Poor error handling masking the real timeout error

## Root Cause
1. **Large file sizes**: 71MB video files are too large for reliable upload
2. **No timeout configuration**: Default Cloudinary timeout was too short
3. **No file size validation**: No limits to prevent oversized uploads
4. **Poor error handling**: Timeout errors were showing as "undefined"

## Fixes Applied

### 1. Enhanced Error Handling
- Added specific handling for `TimeoutError`
- Better error messages showing file size
- Improved error detection for various Cloudinary errors

### 2. File Size Limits
- **Videos**: Maximum 100MB
- **Images**: Maximum 10MB
- Early validation prevents upload attempts of oversized files

### 3. Timeout Configuration
- Added 2-minute timeout for Cloudinary uploads
- Allows more time for large file uploads

### 4. Better User Feedback
- Clear error messages about file size limits
- Specific timeout error messages with file size info

## File Size Recommendations

### For Cashout Clips (Videos):
- **Recommended**: 10-50MB
- **Maximum**: 100MB
- **Format**: MP4, MOV, AVI
- **Duration**: 30 seconds to 5 minutes

### For Vouches (Images):
- **Recommended**: 1-5MB
- **Maximum**: 10MB
- **Format**: JPG, PNG, WEBP

## Testing Your Upload

Your 71MB video file should now either:
1. **Upload successfully** (if under 100MB limit)
2. **Show clear error** about file size if over limit

## Next Steps

1. **Try uploading a smaller video** (under 50MB) first
2. **If still timing out**, consider:
   - Compressing the video
   - Using a shorter clip
   - Better internet connection

## Temporary Hardcoded Credentials

**IMPORTANT**: I temporarily hardcoded your Cloudinary credentials to fix the configuration issue. After testing, we should:

1. **Remove hardcoded credentials** from the service
2. **Fix environment variable loading** properly
3. **Use proper configuration management**

The hardcoded credentials are in `src/common/services/cloudinary.service.ts` lines 15-17 and should be removed once we confirm everything works.

## Error Messages You Should See Now

### File Too Large:
```
File too large. Maximum size is 100MB, but file is 71.13MB
```

### Timeout:
```
Upload timeout - file too large or slow connection. File size: 71131771 bytes
```

### Success:
```
Upload successful: { public_id: '...', secure_url: '...' }
```

Try uploading a smaller video file (under 50MB) and it should work properly now!