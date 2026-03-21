from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

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

    # ML thresholds
    CORRECTNESS_THRESHOLD: float = 0.5
    ANGLE_DEVIATION_THRESHOLD: float = 15.0
    MIN_INCORRECT_SEQUENCE_SECONDS: float = 2.0
    SNIPPET_BUFFER_SECONDS: float = 1.0

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
