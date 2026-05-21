package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                   string
	Env                    string
	APIURL                 string
	DBHost                 string
	DBPort                 string
	DBUser                 string
	DBPassword             string
	DBName                 string
	DBSSLMode              string
	JWTSecret              string
	JWTAccessExpiryMinutes int
	JWTRefreshExpiryDays   int
	MaxAvatarSizeMB        int64
	MaxMediaSizeMB         int64
	RateLimitMax           int
	RateLimitDurationSec   int
}

// LoadConfig loads variables from .env file or system environment variables
func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("Info: No .env file found, using system environment variables instead")
	}

	return &Config{
		Port:                   getEnv("PORT", "8080"),
		Env:                    getEnv("ENV", "development"),
		APIURL:                 getEnv("API_URL", "http://localhost:8080"),
		DBHost:                 getEnv("DB_HOST", "localhost"),
		DBPort:                 getEnv("DB_PORT", "5432"),
		DBUser:                 getEnv("DB_USER", "postgres"),
		DBPassword:             getEnv("DB_PASSWORD", "postgres"),
		DBName:                 getEnv("DB_NAME", "rawly_db"),
		DBSSLMode:              getEnv("DB_SSLMODE", "disable"),
		JWTSecret:              getEnv("JWT_SECRET", "rawly_secret_key_change_me_in_production_1234567890"),
		JWTAccessExpiryMinutes: getEnvAsInt("JWT_ACCESS_EXPIRY_MINUTES", 15),
		JWTRefreshExpiryDays:   getEnvAsInt("JWT_REFRESH_EXPIRY_DAYS", 7),
		MaxAvatarSizeMB:        getEnvAsInt64("MAX_AVATAR_SIZE_MB", 5),
		MaxMediaSizeMB:         getEnvAsInt64("MAX_MEDIA_SIZE_MB", 50),
		RateLimitMax:           getEnvAsInt("RATE_LIMIT_MAX", 100),
		RateLimitDurationSec:   getEnvAsInt("RATE_LIMIT_DURATION_SECONDS", 60),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	str := getEnv(key, "")
	if value, err := strconv.Atoi(str); err == nil {
		return value
	}
	return fallback
}

func getEnvAsInt64(key string, fallback int64) int64 {
	str := getEnv(key, "")
	if value, err := strconv.ParseInt(str, 10, 64); err == nil {
		return value
	}
	return fallback
}
