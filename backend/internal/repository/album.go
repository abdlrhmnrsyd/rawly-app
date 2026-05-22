package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"gorm.io/gorm"
)

type AlbumRepository interface {
	CreateAlbum(album *model.Album) error
	GetAlbumByID(id uuid.UUID) (*model.Album, error)
	GetAlbumsByUserID(userID uuid.UUID, isOwnerOrFollower bool) ([]model.Album, error)
	UpdateAlbum(album *model.Album) error
	DeleteAlbum(id uuid.UUID) error
	GetAlbumPosts(albumID uuid.UUID, viewerID uuid.UUID, isOwnerOrFollower bool) ([]model.Post, error)
}

type albumRepository struct {
	db *gorm.DB
}

func NewAlbumRepository(db *gorm.DB) AlbumRepository {
	return &albumRepository{db: db}
}

func (r *albumRepository) CreateAlbum(album *model.Album) error {
	return r.db.Create(album).Error
}

func (r *albumRepository) GetAlbumByID(id uuid.UUID) (*model.Album, error) {
	var album model.Album
	err := r.db.First(&album, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &album, nil
}

func (r *albumRepository) GetAlbumsByUserID(userID uuid.UUID, isOwnerOrFollower bool) ([]model.Album, error) {
	var albums []model.Album
	query := r.db.Model(&model.Album{}).Preload("Posts.Media").Where("user_id = ?", userID)
	if !isOwnerOrFollower {
		query = query.Where("visibility = 'public'")
	}
	err := query.Order("created_at desc").Find(&albums).Error
	return albums, err
}

func (r *albumRepository) UpdateAlbum(album *model.Album) error {
	return r.db.Save(album).Error
}

func (r *albumRepository) DeleteAlbum(id uuid.UUID) error {
	return r.db.Delete(&model.Album{}, "id = ?", id).Error
}

func (r *albumRepository) GetAlbumPosts(albumID uuid.UUID, viewerID uuid.UUID, isOwnerOrFollower bool) ([]model.Post, error) {
	var posts []model.Post
	query := r.db.Model(&model.Post{}).
		Preload("Media").
		Preload("User").
		Where("album_id = ?", albumID)

	if !isOwnerOrFollower {
		query = query.Where("visibility = 'public'")
	}

	err := query.Order("created_at desc").Find(&posts).Error
	return posts, err
}
