# PosePal Assist

AI-powered physiotherapy platform where therapists assign pose exercises and patients record sessions for real-time accuracy feedback.
![IMG_0012](https://github.com/user-attachments/assets/b0f259a0-4690-4447-9ae2-1322ddeea80a)

#  [DEMO VIDEO](https://youtu.be/FhDISOhTMoE)

---

## Tech Stack

### Frontend
| Framework / Library | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Utility-first styling |
| **TensorFlow.js** | In-browser ML inference |
| **@tensorflow-models/pose-detection** | MoveNet pose landmark detection |
| **@tensorflow/tfjs-backend-webgl** | WebGL GPU acceleration for TF.js |
| **React Hook Form** | Form state management |

### Backend
| Framework / Library | Purpose |
|---|---|
| **FastAPI** | Python web framework |
| **Uvicorn** | ASGI server |
| **Pydantic + pydantic-settings** | Data validation and settings management |
| **python-jose** | JWT creation and verification |
| **passlib + bcrypt** | Password hashing |
| **python-multipart** | Multipart form / file upload parsing |
| **python-dotenv** | Environment variable loading |
| **scikit-learn** | Pose classification ML model |
| **joblib** | ML model serialization |
| **NumPy** | Numerical computation |
| **OpenCV (headless)** | Video frame processing |
| **Ultralytics (YOLOv8)** | Pose detection (training pipeline) |
| **requests** | HTTP client |
| **pytest + pytest-asyncio + httpx** | Testing |

### Infrastructure & Services
| Service | Purpose |
|---|---|
| **Supabase** | PostgreSQL database + Auth + Storage |
| **AWS S3** | Video file storage |
| **AWS CloudFront** | Signed URL CDN for video delivery |
| **Vercel** | Frontend hosting |
| **Render** | Backend hosting |

---

## Local Development

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn app.main:app --reload
```

### Database
Run `backend/migrations/001_pairing_system.sql` in the Supabase SQL Editor before starting the backend.
