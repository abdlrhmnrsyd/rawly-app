package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"gorm.io/gorm"
)

type PostRepository interface {
	CreatePost(post *model.Post) error
	DeletePost(id uuid.UUID) error
	GetPostByID(id uuid.UUID) (*model.Post, error)
	GetGlobalFeed(viewerID uuid.UUID, limit, offset int) ([]model.Post, error)
	GetPostsByUserID(userID, viewerID uuid.UUID, limit, offset int) ([]model.Post, error)
	GetPostStats(postID uuid.UUID) (likesCount int64, commentsCount int64, err error)
	IsPostLikedByUser(userID, postID uuid.UUID) (bool, error)
}

type postRepository struct {
	db *gorm.DB
}

func NewPostRepository(db *gorm.DB) PostRepository {
	return &postRepository{db: db}
}

func (r *postRepository) CreatePost(post *model.Post) error {
	return r.db.Create(post).Error
}

func (r *postRepository) DeletePost(id uuid.UUID) error {
	return r.db.Delete(&model.Post{}, "id = ?", id).Error
}

func (r *postRepository) GetPostByID(id uuid.UUID) (*model.Post, error) {
	var post model.Post
	err := r.db.Preload("User").Preload("Media").First(&post, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &post, nil
}

func (r *postRepository) GetGlobalFeed(viewerID uuid.UUID, limit, offset int) ([]model.Post, error) {
	var posts []model.Post
	
	// Query details
	query := r.db.Preload("Media").Preload("User").
		Joins("JOIN users ON users.id = posts.user_id").
		Where("users.is_banned = ?", false)
	
	if viewerID == uuid.Nil {
		// Anonymous viewers can only see public posts of public users
		query = query.Where("posts.visibility = 'public' AND users.is_private = ?", false)
	} else {
		// Authenticated viewer
		// They can see:
		// 1. Their own posts
		// 2. Public posts of public accounts
		// 3. Any posts (public/followers) of accounts they follow (accepted status)
		query = query.Where(
			"posts.user_id = ? OR "+
			"(posts.visibility = 'public' AND users.is_private = ?) OR "+
			"posts.user_id IN (SELECT following_id FROM follows WHERE follower_id = ? AND status = 'accepted')",
			viewerID, false, viewerID,
		)
	}

	err := query.Order("posts.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&posts).Error
	
	return posts, err
}

func (r *postRepository) GetPostsByUserID(userID, viewerID uuid.UUID, limit, offset int) ([]model.Post, error) {
	var posts []model.Post
	query := r.db.Preload("Media").Preload("User").Where("posts.user_id = ?", userID)

	if viewerID != userID {
		// Check follow status
		var followStatus string
		err := r.db.Model(&model.Follow{}).
			Select("status").
			Where("follower_id = ? AND following_id = ?", viewerID, userID).
			Scan(&followStatus).Error
		
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		var targetUser model.User
		if err := r.db.Select("is_private").First(&targetUser, "id = ?", userID).Error; err != nil {
			return nil, err
		}

		if targetUser.IsPrivate && followStatus != "accepted" {
			// Private account and not following -> return empty list
			return []model.Post{}, nil
		}

		if followStatus == "accepted" {
			// Following -> can see public and followers posts
			query = query.Where("posts.visibility IN ('public', 'followers')")
		} else {
			// Not following -> can only see public posts
			query = query.Where("posts.visibility = 'public'")
		}
	}

	err := query.Order("posts.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&posts).Error
	return posts, err
}

func (r *postRepository) GetPostStats(postID uuid.UUID) (likesCount int64, commentsCount int64, err error) {
	// Query likes count
	err = r.db.Model(&model.Like{}).Where("post_id = ?", postID).Count(&likesCount).Error
	if err != nil {
		return
	}

	// Query comments count
	err = r.db.Model(&model.Comment{}).Where("post_id = ?", postID).Count(&commentsCount).Error
	return
}

func (r *postRepository) IsPostLikedByUser(userID, postID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&model.Like{}).
		Where("user_id = ? AND post_id = ?", userID, postID).
		Count(&count).Error
	return count > 0, err
}
