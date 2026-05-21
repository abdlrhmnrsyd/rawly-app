# ==========================================
# STAGE 1: Build statically compiled binary
# ==========================================
FROM golang:1.21-alpine AS builder

# Install certificates for secure outbound API calls
RUN apk update && apk add --no-cache git ca-certificates && update-ca-certificates

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source files
COPY . .

# Compile optimized binary for Linux x86_64
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o main cmd/api/main.go

# ==========================================
# STAGE 2: Lightweight runner container
# ==========================================
FROM alpine:3.19

# Import timezone logs and ssl certs
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from build context
COPY --from=builder /app/main .
COPY --from=builder /app/.env.example ./

# Expose Fiber port
EXPOSE 8080

# Execute binary
ENTRYPOINT ["./main"]
