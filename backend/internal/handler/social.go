package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/service"
	"github.com/rawly-app/backend/internal/utils"
)

type SocialHandler struct {
	socialService service.SocialService
}

func NewSocialHandler(socialService service.SocialService) *SocialHandler {
	return &SocialHandler{socialService: socialService}
}

type commentReq struct {
	Content string `json:"content"`
}

func (h *SocialHandler) LikePost(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	if err := h.socialService.LikePost(userID, postID); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Post liked successfully", nil, fiber.StatusOK)
}

func (h *SocialHandler) UnlikePost(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	if err := h.socialService.UnlikePost(userID, postID); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Post unliked successfully", nil, fiber.StatusOK)
}

func (h *SocialHandler) AddComment(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	var req commentReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid comment payload", fiber.StatusBadRequest)
	}

	comment, err := h.socialService.CommentPost(userID, postID, req.Content)
	if err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusBadRequest)
	}

	return utils.SendSuccess(c, "Comment added successfully", comment, fiber.StatusCreated)
}

func (h *SocialHandler) GetComments(c *fiber.Ctx) error {
	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	limit, offset := getPaginationParams(c)

	comments, err := h.socialService.GetComments(postID, limit, offset)
	if err != nil {
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Comments retrieved successfully", comments, fiber.StatusOK)
}

func (h *SocialHandler) GetNotifications(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	limit, offset := getPaginationParams(c)

	notifications, err := h.socialService.GetNotifications(userID, limit, offset)
	if err != nil {
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Notifications retrieved successfully", notifications, fiber.StatusOK)
}

func (h *SocialHandler) MarkNotificationsRead(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	if err := h.socialService.ReadNotifications(userID); err != nil {
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Notifications marked as read", nil, fiber.StatusOK)
}
