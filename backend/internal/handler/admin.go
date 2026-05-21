package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/service"
	"github.com/rawly-app/backend/internal/utils"
)

type AdminHandler struct {
	adminService service.AdminService
}

func NewAdminHandler(adminService service.AdminService) *AdminHandler {
	return &AdminHandler{adminService: adminService}
}

type banReq struct {
	IsBanned bool `json:"is_banned"`
}

type reportReq struct {
	Reason string `json:"reason"`
}

func (h *AdminHandler) BanUser(c *fiber.Ctx) error {
	// 1. Verify administrator role
	if err := verifyAdminRole(c); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusForbidden)
	}

	targetIDStr := c.Params("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid user ID format", fiber.StatusBadRequest)
	}

	var req banReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid request body", fiber.StatusBadRequest)
	}

	if err := h.adminService.BanUser(targetID, req.IsBanned); err != nil {
		return utils.SendError(c, "Failed to update user ban status", fiber.StatusInternalServerError)
	}

	message := "User account has been successfully banned"
	if !req.IsBanned {
		message = "User account has been successfully unbanned"
	}

	return utils.SendSuccess(c, message, nil, fiber.StatusOK)
}

func (h *AdminHandler) ReportPost(c *fiber.Ctx) error {
	// User authentication is checked by global JWT middleware
	reporterID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	var req reportReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid request payload", fiber.StatusBadRequest)
	}

	report, err := h.adminService.ReportPost(reporterID, postID, req.Reason)
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		return utils.SendError(c, err.Error(), fiber.StatusBadRequest)
	}

	return utils.SendSuccess(c, "Post reported successfully for administrative review", report, fiber.StatusCreated)
}

func (h *AdminHandler) GetReports(c *fiber.Ctx) error {
	// 1. Verify administrator role
	if err := verifyAdminRole(c); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusForbidden)
	}

	limit, offset := getPaginationParams(c)

	reports, err := h.adminService.GetReports(limit, offset)
	if err != nil {
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Flagged reports retrieved successfully", reports, fiber.StatusOK)
}

func (h *AdminHandler) DeletePostOverride(c *fiber.Ctx) error {
	// 1. Verify administrator role
	if err := verifyAdminRole(c); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusForbidden)
	}

	postIDStr := c.Params("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid post ID format", fiber.StatusBadRequest)
	}

	if err := h.adminService.DeletePost(postID); err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Post removed by administrative action", nil, fiber.StatusOK)
}

// Helper to assert admin authorization status
func verifyAdminRole(c *fiber.Ctx) error {
	roleVal := c.Locals("userRole")
	if roleVal == nil || roleVal.(string) != "admin" {
		return errors.New("forbidden: administrator privileges required")
	}
	return nil
}
