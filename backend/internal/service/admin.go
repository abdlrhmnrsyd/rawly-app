package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/repository"
)

type AdminService interface {
	BanUser(userID uuid.UUID, isBanned bool) error
	ReportPost(reporterID, postID uuid.UUID, reason string) (*model.Report, error)
	GetReports(limit, offset int) ([]model.Report, error)
	DeletePost(postID uuid.UUID) error
}

type adminService struct {
	adminRepo repository.AdminRepository
	postRepo  repository.PostRepository
}

func NewAdminService(adminRepo repository.AdminRepository, postRepo repository.PostRepository) AdminService {
	return &adminService{
		adminRepo: adminRepo,
		postRepo:  postRepo,
	}
}

func (s *adminService) BanUser(userID uuid.UUID, isBanned bool) error {
	return s.adminRepo.BanUser(userID, isBanned)
}

func (s *adminService) ReportPost(reporterID, postID uuid.UUID, reason string) (*model.Report, error) {
	if reason == "" {
		return nil, errors.New("report reason cannot be empty")
	}

	// Verify post exists
	post, err := s.postRepo.GetPostByID(postID)
	if err != nil {
		return nil, err
	}
	if post == nil {
		return nil, ErrPostNotFound
	}

	report := &model.Report{
		ReporterID: reporterID,
		PostID:     postID,
		Reason:     reason,
	}

	if err := s.adminRepo.CreateReport(report); err != nil {
		return nil, err
	}

	return report, nil
}

func (s *adminService) GetReports(limit, offset int) ([]model.Report, error) {
	return s.adminRepo.GetReports(limit, offset)
}

func (s *adminService) DeletePost(postID uuid.UUID) error {
	post, err := s.postRepo.GetPostByID(postID)
	if err != nil {
		return err
	}
	if post == nil {
		return ErrPostNotFound
	}

	return s.adminRepo.DeletePost(postID)
}
