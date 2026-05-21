package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Report struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ReporterID uuid.UUID `gorm:"type:uuid;not null;index" json:"reporter_id"`
	PostID     uuid.UUID `gorm:"type:uuid;not null;index" json:"post_id"`
	Reason     string    `gorm:"type:text;not null" json:"reason"`
	CreatedAt  time.Time `json:"created_at"`

	// Relationships
	Reporter *User `gorm:"foreignKey:ReporterID" json:"reporter,omitempty"`
	Post     *Post `gorm:"foreignKey:PostID" json:"post,omitempty"`
}

// BeforeCreate hook to generate UUID before insertion
func (r *Report) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return
}
