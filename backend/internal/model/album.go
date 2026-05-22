package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Album struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Title       string         `gorm:"type:varchar(100);not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Visibility  string         `gorm:"type:varchar(20);default:'public';not null" json:"visibility"` // 'public', 'followers'
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	User  *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Posts []Post `gorm:"foreignKey:AlbumID;constraint:OnDelete:SET NULL" json:"posts,omitempty"`
}

// BeforeCreate hook to generate UUID before insertion
func (a *Album) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return
}
