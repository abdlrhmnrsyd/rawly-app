package repository

import (
	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"gorm.io/gorm"
)

type AdminRepository interface {
	BanUser(userID uuid.UUID, isBanned bool) error
	CreateReport(report *model.Report) error
	GetReports(limit, offset int) ([]model.Report, error)
	DeletePost(postID uuid.UUID) error
}

type adminRepository struct {
	db *gorm.DB
}

func NewAdminRepository(db *gorm.DB) AdminRepository {
	return &adminRepository{db: db}
}

func (r *adminRepository) BanUser(userID uuid.UUID, isBanned bool) error {
	// Start a transaction: ban the user and drop all their active sessions
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.User{}).Where("id = ?", userID).Update("is_banned", isBanned).Error; err != nil {
			return err
		}

		if isBanned {
			// Invalidate all sessions immediately on ban
			if err := tx.Where("user_id = ?", userID).Delete(&model.RefreshToken{}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *adminRepository) CreateReport(report *model.Report) error {
	return r.db.Create(report).Error
}

func (r *adminRepository) GetReports(limit, offset int) ([]model.Report, error) {
	var reports []model.Report
	err := r.db.Preload("Reporter").
		Preload("Post").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&reports).Error
	return reports, err
}

func (r *adminRepository) DeletePost(postID uuid.UUID) error {
	// Delete override (cascades comment/likes via GORM config and Postgres foreign keys)
	return r.db.Delete(&model.Post{}, "id = ?", postID).Error
}
