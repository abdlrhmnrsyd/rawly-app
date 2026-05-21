package repository

import (
	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"gorm.io/gorm"
)

type SocialRepository interface {
	LikePost(like *model.Like) error
	UnlikePost(userID, postID uuid.UUID) error
	AddComment(comment *model.Comment) error
	GetCommentsByPostID(postID uuid.UUID, limit, offset int) ([]model.Comment, error)
	CreateNotification(notif *model.Notification) error
	GetNotificationsByUserID(userID uuid.UUID, limit, offset int) ([]model.Notification, error)
	MarkNotificationsAsRead(userID uuid.UUID) error
}

type socialRepository struct {
	db *gorm.DB
}

func NewSocialRepository(db *gorm.DB) SocialRepository {
	return &socialRepository{db: db}
}

func (r *socialRepository) LikePost(like *model.Like) error {
	// Inserts a new like, unique constraint in DB handles duplication
	return r.db.Create(like).Error
}

func (r *socialRepository) UnlikePost(userID, postID uuid.UUID) error {
	return r.db.Where("user_id = ? AND post_id = ?", userID, postID).Delete(&model.Like{}).Error
}

func (r *socialRepository) AddComment(comment *model.Comment) error {
	return r.db.Create(comment).Error
}

func (r *socialRepository) GetCommentsByPostID(postID uuid.UUID, limit, offset int) ([]model.Comment, error) {
	var comments []model.Comment
	err := r.db.Preload("User").
		Where("post_id = ?", postID).
		Order("created_at ASC").
		Limit(limit).
		Offset(offset).
		Find(&comments).Error
	return comments, err
}

func (r *socialRepository) CreateNotification(notif *model.Notification) error {
	// Don't send notifications to self
	if notif.UserID == notif.ActorID {
		return nil
	}
	return r.db.Create(notif).Error
}

func (r *socialRepository) GetNotificationsByUserID(userID uuid.UUID, limit, offset int) ([]model.Notification, error) {
	var notifications []model.Notification
	err := r.db.Preload("Actor").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&notifications).Error
	return notifications, err
}

func (r *socialRepository) MarkNotificationsAsRead(userID uuid.UUID) error {
	return r.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error
}
