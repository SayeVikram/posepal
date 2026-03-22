from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # Pairing codes — HMAC key for code hashing; change before first deploy
    PAIRING_CODE_SECRET: str = "change-me-pairing-secret"

    # Legacy JWT (kept for local sign routes)
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:8080", "http://localhost:3000"]

    # ML model
    MODEL_PATH: str = "ml_training/models/pose_classifier.joblib"

    # Storage limits
    MAX_VIDEO_SIZE_MB: int = 100

    # AWS / CloudFront storage
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET: str = ""
    S3_VIDEOS_PREFIX: str = "videos"
    S3_SNIPPETS_PREFIX: str = "snippets"
    CLOUDFRONT_DOMAIN: str = ""
    CLOUDFRONT_KEY_PAIR_ID: str = ""
    CLOUDFRONT_PRIVATE_KEY: str = ""
    CLOUDFRONT_PRIVATE_KEY_PATH: str = ""
    SIGNED_URL_EXPIRES_SECONDS: int = 3600

    # ML thresholds
    CORRECTNESS_THRESHOLD: float = 0.5
    ANGLE_DEVIATION_THRESHOLD: float = 15.0
    MIN_INCORRECT_SEQUENCE_SECONDS: float = 2.0
    SNIPPET_BUFFER_SECONDS: float = 1.0

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
