package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PostMedia struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	PostID    uuid.UUID `gorm:"type:uuid;not null;index" json:"post_id"`
	MediaURL  string    `gorm:"type:varchar(255);not null" json:"media_url"`
	MediaType string    `gorm:"type:varchar(20);not null" json:"media_type"` // 'image', 'video'
	CreatedAt time.Time `json:"created_at"`
}

// BeforeCreate hook to generate UUID before insertion
func (pm *PostMedia) BeforeCreate(tx *gorm.DB) (err error) {
	if pm.ID == uuid.Nil {
		pm.ID = uuid.New()
	}
	return
}
