package handler

import (
	"errors"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/service"
	"github.com/rawly-app/backend/internal/utils"
)

type PostHandler struct {
	cfg         *config.Config
	postService service.PostService
}

func NewPostHandler(cfg *config.Config, postService service.PostService) *PostHandler {
	return &PostHandler{cfg: cfg, postService: postService}
}

func (h *PostHandler) CreatePost(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	caption := c.FormValue("caption")
	visibility := c.FormValue("visibility", "public")
	albumIDStr := c.FormValue("album_id")
	var albumID *uuid.UUID
	if albumIDStr != "" && albumIDStr != "null" && albumIDStr != "undefined" {
		parsedAlbumID, err := uuid.Parse(albumIDStr)
		if err == nil {
			albumID = &parsedAlbumID
		}
	}

	// Parse multiple files attachment
	form, err := c.MultipartForm()
	if err != nil {
		return utils.SendError(c, "Failed to parse multipart form-data", fiber.StatusBadRequest)
	}

	files := form.File["media"]
	if len(files) == 0 {
		return utils.SendError(c, "At least one media file is required under key 'media' in form-data", fiber.StatusBadRequest)
	}

	var mediaItems []model.PostMedia
	maxBytes := h.cfg.MaxMediaSizeMB * 1024 * 1024

	for _, fileHeader := range files {
		// Detect folder classification
		targetDir := "uploads/posts"
		if strings.HasPrefix(fileHeader.Header.Get("Content-Type"), "video/") || 
		   strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".mp4") ||
		   strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".mov") ||
		   strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".avi") ||
		   strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".mkv") {
			targetDir = "uploads/videos"
		}

		webPath, mediaType, err := utils.ValidateAndSaveUploadedFile(fileHeader, targetDir, maxBytes, false)
		if err != nil {
			return utils.SendError(c, err.Error(), fiber.StatusBadRequest)
		}

		mediaItems = append(mediaItems, model.PostMedia{
			MediaURL:  webPath,
			MediaType: mediaType,
		})
	}

	post, err := h.postService.CreatePost(userID, caption, mediaItems, visibility, albumID)
	if err != nil {
		return utils.SendError(c, "Failed to create post record: "+err.Error(), fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Post created successfully", post, fiber.StatusCreated)
}

func (h *PostHandler) GetPost(c *fiber.Ctx) error {
	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	viewerID := getOptionalViewerID(c, h.cfg.JWTSecret)

	post, err := h.postService.GetPost(postID, viewerID)
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Post retrieved successfully", post, fiber.StatusOK)
}

func (h *PostHandler) DeletePost(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	// Role is extracted from JWT Locals context
	roleVal := c.Locals("userRole")
	role := "user"
	if roleVal != nil {
		role = roleVal.(string)
	}

	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	err = h.postService.DeletePost(userID, role, postID)
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		if errors.Is(err, service.ErrUnauthorizedPost) {
			return utils.SendError(c, err.Error(), fiber.StatusForbidden)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Post deleted successfully", nil, fiber.StatusOK)
}

func (h *PostHandler) GetFeed(c *fiber.Ctx) error {
	limit, offset := getPaginationParams(c)
	viewerID := getOptionalViewerID(c, h.cfg.JWTSecret)

	posts, err := h.postService.GetFeed(viewerID, limit, offset)
	if err != nil {
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Homepage feed retrieved successfully", posts, fiber.StatusOK)
}

func (h *PostHandler) GetUserPosts(c *fiber.Ctx) error {
	username := c.Params("username")
	if username == "" {
		return utils.SendError(c, "Username parameter is required", fiber.StatusBadRequest)
	}

	limit, offset := getPaginationParams(c)
	viewerID := getOptionalViewerID(c, h.cfg.JWTSecret)

	posts, err := h.postService.GetUserPosts(username, viewerID, limit, offset)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "User posts retrieved successfully", posts, fiber.StatusOK)
}

// Helpers
func getPaginationParams(c *fiber.Ctx) (limit int, offset int) {
	pageStr := c.Query("page", "1")
	limitStr := c.Query("limit", "10")

	page := 1
	if parsedPage, err := strconv.Atoi(pageStr); err == nil && parsedPage > 0 {
		page = parsedPage
	}

	limit = 10
	if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 10000 {
		limit = parsedLimit
	}

	offset = (page - 1) * limit
	return limit, offset
}
