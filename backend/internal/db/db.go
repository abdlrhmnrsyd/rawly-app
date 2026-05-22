package db

import (
	"fmt"
	"log"
	"time"

	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB initializes PostgreSQL connection using GORM
func InitDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s dbname=%s port=%s sslmode=%s",
		cfg.DBHost, cfg.DBUser, cfg.DBName, cfg.DBPort, cfg.DBSSLMode,
	)
	if cfg.DBPassword != "" {
		// Escape single quotes in password if any, but simple quoting works for most passwords
		dsn += fmt.Sprintf(" password='%s'", cfg.DBPassword)
	}

	gormConfig := &gorm.Config{}
	if cfg.Env == "production" {
		gormConfig.Logger = logger.Default.LogMode(logger.Error)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve sql.DB instance: %w", err)
	}

	// Connection Pool Settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("Database connection established successfully")

	// Execute migrations
	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("migration failure: %w", err)
	}

	return db, nil
}

func runMigrations(db *gorm.DB) error {
	log.Println("Running database migrations...")

	// Enable UUID-OSSP extension in Postgres for safe UUID functions if needed
	db.Exec("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

	err := db.AutoMigrate(
		&model.User{},
		&model.Album{},
		&model.Post{},
		&model.PostMedia{},
		&model.Comment{},
		&model.Like{},
		&model.Follow{},
		&model.Notification{},
		&model.RefreshToken{},
		&model.Report{},
	)
	if err != nil {
		return err
	}

	log.Println("Database migrations completed successfully")
	return nil
}
