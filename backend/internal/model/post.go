package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Post struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Caption   string         `gorm:"type:text" json:"caption"`
	MediaURL  string         `gorm:"type:varchar(255);not null" json:"media_url"`
	MediaType string         `gorm:"type:varchar(20);not null" json:"media_type"` // 'image', 'video'
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Comments []Comment `gorm:"foreignKey:PostID;constraint:OnDelete:CASCADE" json:"-"`
	Likes    []Like    `gorm:"foreignKey:PostID;constraint:OnDelete:CASCADE" json:"-"`
	Reports  []Report  `gorm:"foreignKey:PostID;constraint:OnDelete:CASCADE" json:"-"`
}

// BeforeCreate hook to generate UUID before insertion
func (p *Post) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return
}
