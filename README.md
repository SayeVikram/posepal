# PosePal Assist

AI-powered physiotherapy platform where therapists assign pose exercises and patients record sessions for real-time accuracy feedback.

---

## Tech Stack

### Frontend
| Framework / Library | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Component library (built on Radix UI) |
| **Radix UI** | Headless accessible primitives (dialog, select, alert-dialog, avatar, etc.) |
| **Framer Motion** | Animations and transitions |
| **React Router DOM** | Client-side routing |
| **TanStack React Query** | Server state management and data fetching |
| **TensorFlow.js** | In-browser ML inference |
| **@tensorflow-models/pose-detection** | MoveNet pose landmark detection |
| **@tensorflow/tfjs-backend-webgl** | WebGL GPU acceleration for TF.js |
| **React Hook Form** | Form state management |
| **Zod** | Schema validation |
| **Recharts** | Data visualization / charts |
| **Sonner** | Toast notifications |
| **Lucide React** | Icon library |
| **date-fns** | Date formatting and manipulation |
| **next-themes** | Dark/light theme management |
| **clsx + tailwind-merge** | Conditional class name utilities |
| **class-variance-authority** | Component variant management |

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
| **boto3** | AWS S3 video storage |
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

## Project Structure

```
posepal-assist/
├── src/                  # React frontend
│   ├── components/       # Shared UI components
│   ├── contexts/         # Auth context
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # API client, Supabase client
│   └── pages/            # Route pages (patient/, therapist/, auth/)
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app entry point
│   │   ├── config.py     # Settings via pydantic-settings
│   │   ├── models/       # Pydantic schemas
│   │   ├── routes/       # API routers (auth, user, therapist, pairing)
│   │   └── utils/        # DB helpers, storage, auth, pairing codes
│   ├── migrations/       # SQL migration files
│   ├── ml_training/      # Model training scripts and saved model
│   └── requirements.txt
└── README.md
```

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
