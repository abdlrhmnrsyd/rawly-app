package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"gorm.io/gorm"
)

type UserRepository interface {
	GetUserByID(id uuid.UUID) (*model.User, error)
	GetUserByUsername(username string) (*model.User, error)
	UpdateUser(user *model.User) error
	FollowUser(followerID, followingID uuid.UUID) error
	UnfollowUser(followerID, followingID uuid.UUID) error
	IsFollowing(followerID, followingID uuid.UUID) (bool, error)
	GetFollowStatus(followerID, followingID uuid.UUID) (string, error)
	GetFollowStats(userID uuid.UUID) (followers int64, following int64, posts int64, err error)
	GetPendingFollowRequests(userID uuid.UUID) ([]model.Follow, error)
	AcceptFollowRequest(followerID, followingID uuid.UUID) error
	DeclineFollowRequest(followerID, followingID uuid.UUID) error
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) GetUserByID(id uuid.UUID) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetUserByUsername(username string) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, "username = ?", username).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) UpdateUser(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *userRepository) FollowUser(followerID, followingID uuid.UUID) error {
	var targetUser model.User
	if err := r.db.Select("is_private").First(&targetUser, "id = ?", followingID).Error; err != nil {
		return err
	}

	status := "accepted"
	if targetUser.IsPrivate {
		status = "pending"
	}

	follow := model.Follow{
		FollowerID:  followerID,
		FollowingID: followingID,
		Status:      status,
	}
	return r.db.Create(&follow).Error
}

func (r *userRepository) UnfollowUser(followerID, followingID uuid.UUID) error {
	return r.db.Where("follower_id = ? AND following_id = ?", followerID, followingID).Delete(&model.Follow{}).Error
}

func (r *userRepository) IsFollowing(followerID, followingID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&model.Follow{}).
		Where("follower_id = ? AND following_id = ? AND status = 'accepted'", followerID, followingID).
		Count(&count).Error
	return count > 0, err
}

func (r *userRepository) GetFollowStatus(followerID, followingID uuid.UUID) (string, error) {
	var follow model.Follow
	err := r.db.Where("follower_id = ? AND following_id = ?", followerID, followingID).First(&follow).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "none", nil
		}
		return "", err
	}
	return follow.Status, nil
}

func (r *userRepository) GetFollowStats(userID uuid.UUID) (followers int64, following int64, posts int64, err error) {
	// Query followers (only accepted ones)
	err = r.db.Model(&model.Follow{}).Where("following_id = ? AND status = 'accepted'", userID).Count(&followers).Error
	if err != nil {
		return
	}

	// Query following (only accepted ones)
	err = r.db.Model(&model.Follow{}).Where("follower_id = ? AND status = 'accepted'", userID).Count(&following).Error
	if err != nil {
		return
	}

	// Query posts count
	err = r.db.Model(&model.Post{}).Where("user_id = ?", userID).Count(&posts).Error
	return
}

func (r *userRepository) GetPendingFollowRequests(userID uuid.UUID) ([]model.Follow, error) {
	var requests []model.Follow
	err := r.db.Preload("Follower").Where("following_id = ? AND status = 'pending'", userID).Find(&requests).Error
	return requests, err
}

func (r *userRepository) AcceptFollowRequest(followerID, followingID uuid.UUID) error {
	return r.db.Model(&model.Follow{}).
		Where("follower_id = ? AND following_id = ? AND status = 'pending'", followerID, followingID).
		Update("status", "accepted").Error
}

func (r *userRepository) DeclineFollowRequest(followerID, followingID uuid.UUID) error {
	return r.db.Where("follower_id = ? AND following_id = ? AND status = 'pending'", followerID, followingID).Delete(&model.Follow{}).Error
}
