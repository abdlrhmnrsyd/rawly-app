package utils

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// Allowed MIME types maps for security filtering
var AllowedAvatarTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

var AllowedPostMediaTypes = map[string]string{
	"image/jpeg":       "image",
	"image/png":        "image",
	"image/webp":       "image",
	"image/gif":        "image",
	"video/mp4":        "video",
	"video/quicktime":  "video", // .mov
	"video/x-msvideo":  "video", // .avi
	"video/x-matroska": "video", // .mkv
}

// ValidateAndSaveUploadedFile checks file constraints, detects real content MIME, and saves it locally
func ValidateAndSaveUploadedFile(fileHeader *multipart.FileHeader, targetDir string, maxSizeBytes int64, isAvatar bool) (string, string, error) {
	// 1. Validate File Size
	if fileHeader.Size > maxSizeBytes {
		return "", "", fmt.Errorf("file size exceeds maximum limit of %d MB", maxSizeBytes/(1024*1024))
	}

	// 2. Open File to verify actual MIME Type (prevent spoofing)
	file, err := fileHeader.Open()
	if err != nil {
		return "", "", fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer file.Close()

	// Sniff first 512 bytes
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", "", fmt.Errorf("failed to inspect file bytes: %w", err)
	}
	contentType := http.DetectContentType(buffer[:n])

	// Seek back to start for copying
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", "", fmt.Errorf("failed to seek file beginning: %w", err)
	}

	// 3. Check Extension and MIME type
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	var mediaType string

	if isAvatar {
		if !AllowedAvatarTypes[contentType] {
			return "", "", errors.New("invalid content type: avatar must be jpeg, png, webp, or gif")
		}
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
			return "", "", errors.New("invalid file extension for avatar")
		}
		mediaType = "avatar"
	} else {
		resolvedType, ok := AllowedPostMediaTypes[contentType]
		if !ok {
			return "", "", errors.New("invalid content type: post must be jpeg, png, webp, gif, mp4, mov, avi, or mkv")
		}
		if resolvedType == "image" {
			if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
				return "", "", errors.New("invalid image extension")
			}
		} else if resolvedType == "video" {
			if ext != ".mp4" && ext != ".mov" && ext != ".avi" && ext != ".mkv" {
				return "", "", errors.New("invalid video extension")
			}
		}
		mediaType = resolvedType
	}

	// 4. Generate unique UUID filename
	newFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	savePath := filepath.Join(targetDir, newFilename)

	// Ensure the parent directory exists
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create upload path: %w", err)
	}

	// 5. Create local file and copy contents
	out, err := os.Create(savePath)
	if err != nil {
		return "", "", fmt.Errorf("failed to create local file: %w", err)
	}
	defer out.Close()

	if _, err = io.Copy(out, file); err != nil {
		return "", "", fmt.Errorf("failed to write uploaded content: %w", err)
	}

	// Create web accessible absolute url path (relative to app host)
	webPath := filepath.ToSlash(filepath.Join("uploads", filepath.Base(targetDir), newFilename))
	if !strings.HasPrefix(webPath, "/") {
		webPath = "/" + webPath
	}

	return webPath, mediaType, nil
}
