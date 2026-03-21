from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import auth, user, therapist

app = FastAPI(title="PosePal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(user.router, prefix="/api/user", tags=["user"])
app.include_router(therapist.router, prefix="/api/therapist", tags=["therapist"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/pose-classes")
async def pose_classes():
    try:
        import joblib
        clf = joblib.load(settings.MODEL_PATH)
        return {"classes": list(clf.classes_)}
    except Exception:
        return {"classes": []}
