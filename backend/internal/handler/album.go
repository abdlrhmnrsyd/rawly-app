package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/service"
	"github.com/rawly-app/backend/internal/utils"
)

type AlbumHandler struct {
	cfg          *config.Config
	albumService service.AlbumService
}

func NewAlbumHandler(cfg *config.Config, albumService service.AlbumService) *AlbumHandler {
	return &AlbumHandler{cfg: cfg, albumService: albumService}
}

type CreateAlbumInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Visibility  string `json:"visibility"`
}

func (h *AlbumHandler) CreateAlbum(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	var input CreateAlbumInput
	if err := c.BodyParser(&input); err != nil {
		return utils.SendError(c, "Invalid input data format", fiber.StatusBadRequest)
	}

	album, err := h.albumService.CreateAlbum(userID, input.Title, input.Description, input.Visibility)
	if err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusBadRequest)
	}

	return utils.SendSuccess(c, "Album created successfully", album, fiber.StatusCreated)
}

func (h *AlbumHandler) GetUserAlbums(c *fiber.Ctx) error {
	targetUserIDStr := c.Params("userID")
	targetUserID, err := uuid.Parse(targetUserIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid user ID format", fiber.StatusBadRequest)
	}

	viewerID := getOptionalViewerID(c, h.cfg.JWTSecret)

	albums, err := h.albumService.GetAlbumsByUserID(targetUserID, viewerID)
	if err != nil {
		return utils.SendError(c, "Failed to retrieve albums", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Albums retrieved successfully", albums, fiber.StatusOK)
}

func (h *AlbumHandler) UpdateAlbum(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	albumIDStr := c.Params("id")
	albumID, err := uuid.Parse(albumIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid album ID format", fiber.StatusBadRequest)
	}

	var input CreateAlbumInput
	if err := c.BodyParser(&input); err != nil {
		return utils.SendError(c, "Invalid input data format", fiber.StatusBadRequest)
	}

	album, err := h.albumService.UpdateAlbum(userID, albumID, input.Title, input.Description, input.Visibility)
	if err != nil {
		if errors.Is(err, service.ErrAlbumNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		if errors.Is(err, service.ErrUnauthorizedAlbum) {
			return utils.SendError(c, err.Error(), fiber.StatusForbidden)
		}
		return utils.SendError(c, err.Error(), fiber.StatusBadRequest)
	}

	return utils.SendSuccess(c, "Album updated successfully", album, fiber.StatusOK)
}

func (h *AlbumHandler) DeleteAlbum(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	albumIDStr := c.Params("id")
	albumID, err := uuid.Parse(albumIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid album ID format", fiber.StatusBadRequest)
	}

	err = h.albumService.DeleteAlbum(userID, albumID)
	if err != nil {
		if errors.Is(err, service.ErrAlbumNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		if errors.Is(err, service.ErrUnauthorizedAlbum) {
			return utils.SendError(c, err.Error(), fiber.StatusForbidden)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Album deleted successfully", nil, fiber.StatusOK)
}

func (h *AlbumHandler) GetAlbumPosts(c *fiber.Ctx) error {
	albumIDStr := c.Params("id")
	albumID, err := uuid.Parse(albumIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid album ID format", fiber.StatusBadRequest)
	}

	viewerID := getOptionalViewerID(c, h.cfg.JWTSecret)

	posts, err := h.albumService.GetAlbumPosts(albumID, viewerID)
	if err != nil {
		if errors.Is(err, service.ErrAlbumNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		if errors.Is(err, service.ErrUnauthorizedAlbum) {
			return utils.SendError(c, err.Error(), fiber.StatusForbidden)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	// We can enrich posts as PostResponse, or since GetAlbumPosts returns model.Post directly,
	// let's wrap it in SendSuccess.
	return utils.SendSuccess(c, "Album posts retrieved successfully", posts, fiber.StatusOK)
}
