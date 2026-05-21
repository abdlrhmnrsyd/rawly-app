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
	GetGlobalFeed(limit, offset int) ([]model.Post, error)
	GetPostsByUserID(userID uuid.UUID, limit, offset int) ([]model.Post, error)
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
	err := r.db.Preload("User").First(&post, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &post, nil
}

func (r *postRepository) GetGlobalFeed(limit, offset int) ([]model.Post, error) {
	var posts []model.Post
	// Preload author details and join users to filter out banned user posts
	err := r.db.Preload("User").
		Joins("User").
		Where("\"User\".is_banned = ?", false).
		Order("posts.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&posts).Error
	return posts, err
}

func (r *postRepository) GetPostsByUserID(userID uuid.UUID, limit, offset int) ([]model.Post, error) {
	var posts []model.Post
	err := r.db.Preload("User").
		Where("user_id = ?", userID).
		Order("created_at DESC").
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
