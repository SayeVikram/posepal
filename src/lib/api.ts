// ---------------------------------------------------------------------------
// Types (match backend schema, compatible with existing component code)
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'therapist' | 'patient';
  createdAt: string;
}

export interface PoseTemplate {
  id: number;
  therapistId: number;
  poseName: string;       // backend: name
  expectedPoseClass: string; // backend: pose_class
  instructions: string;
  referenceVideoUrl?: string;
  createdAt: string;
}

export interface AssignmentSession {
  id: number;
  recordedAt: string;
  processed: boolean;
  overallCorrectness?: number;
}

export interface Assignment {
  id: number;
  therapistId: number;
  patientId: number;
  poseTemplateId: number;
  assignedAt: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  notes?: string;
  requiredDays?: number;
  pose?: PoseTemplate;
  sessions?: AssignmentSession[];
}

export interface AreaOfConcern {
  bodyPart: string;
  issue: string;
  severity: 'low' | 'moderate' | 'high';
  timestamps: number[];
  snippetUrl?: string;
}

export interface TimelineEntry {
  timestamp: number;
  isCorrect: boolean;
}

export interface SessionAnalysis {
  id: number;
  sessionId: number;
  overallCorrectness: number;
  totalFrames: number;
  correctFrames: number;
  areasOfConcern: AreaOfConcern[];
  timeline: TimelineEntry[];
}

export interface Session {
  id: number;
  assignmentId: number;
  patientId: number;
  videoUrl?: string;
  recordedAt: string;
  processed: boolean;
  processingError?: string;
  poseName?: string;
  analysis?: SessionAnalysis;
}

// ---------------------------------------------------------------------------
// Adapters — backend snake_case → frontend camelCase
// ---------------------------------------------------------------------------

function adaptUser(u: Record<string, unknown>): User {
  return {
    id: u.id as number,
    name: u.name as string,
    email: u.email as string,
    role: u.role as 'therapist' | 'patient',
    createdAt: (u.created_at as string) ?? '',
  };
}

function adaptPoseTemplate(p: Record<string, unknown>): PoseTemplate {
  return {
    id: p.id as number,
    therapistId: p.therapist_id as number,
    poseName: p.name as string,
    expectedPoseClass: (p.pose_class as string) ?? '',
    instructions: (p.instructions as string) ?? '',
    referenceVideoUrl: p.reference_video_url as string | undefined,
    createdAt: (p.created_at as string) ?? '',
  };
}

function adaptAssignment(a: Record<string, unknown>): Assignment {
  const pt = a.pose_templates as Record<string, unknown> | undefined;
  const rawSessions = (a.sessions as Array<Record<string, unknown>>) ?? [];
  const sessions: AssignmentSession[] = rawSessions.map(s => {
    const analyses = (s.session_analyses as Array<Record<string, unknown>>) ?? [];
    const correctness = analyses[0]?.overall_correctness as number | undefined;
    return {
      id: s.id as number,
      recordedAt: (s.recorded_at as string) ?? '',
      processed: (s.processed as boolean) ?? false,
      overallCorrectness: correctness,
    };
  });
  return {
    id: a.id as number,
    therapistId: a.therapist_id as number,
    patientId: a.patient_id as number,
    poseTemplateId: a.pose_template_id as number,
    assignedAt: (a.assigned_at as string) ?? '',
    dueDate: (a.due_date as string) ?? '',
    status: (a.status as 'pending' | 'completed' | 'overdue') ?? 'pending',
    notes: (a.notes as string) ?? undefined,
    requiredDays: (a.required_days as number) ?? undefined,
    pose: pt ? adaptPoseTemplate(pt) : undefined,
    sessions: sessions.length > 0 ? sessions : undefined,
  };
}

const CORRECTNESS_THRESHOLD = 0.5;
const ASSUMED_FPS = 5; // frame_interval=5, so sampled frame index / (native_fps/5)

function adaptAnalysis(a: Record<string, unknown>): SessionAnalysis {
  const frameAnalyses = (a.frame_analyses as Array<{ frame: number; score: number }>) ?? [];
  const timeline: TimelineEntry[] = frameAnalyses.map(f => ({
    timestamp: f.frame / ASSUMED_FPS,
    isCorrect: f.score >= CORRECTNESS_THRESHOLD,
  }));
  return {
    id: a.id as number,
    sessionId: a.session_id as number,
    overallCorrectness: (a.overall_correctness as number) ?? 0,
    totalFrames: (a.total_frames as number) ?? 0,
    correctFrames: (a.correct_frames as number) ?? 0,
    areasOfConcern: (a.areas_of_concern as AreaOfConcern[]) ?? [],
    timeline,
  };
}

function adaptSession(s: Record<string, unknown>): Session {
  // The backend joins assignments(pose_templates(name)) into sessions
  const assignment = s.assignments as Record<string, unknown> | undefined;
  const poseTemplates = assignment?.pose_templates as Record<string, unknown> | undefined;
  return {
    id: s.id as number,
    assignmentId: s.assignment_id as number,
    patientId: s.patient_id as number,
    videoUrl: s.video_url as string | undefined,
    recordedAt: (s.recorded_at as string) ?? '',
    processed: (s.processed as boolean) ?? false,
    processingError: s.processing_error as string | undefined,
    poseName: (poseTemplates?.name as string) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function req<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const api = {
  // --- Auth ---
  getMe: (token: string): Promise<User> =>
    req<Record<string, unknown>>('GET', '/api/auth/me', token).then(adaptUser),

  // --- Patient: assignments ---
  getAssignments: (token: string): Promise<Assignment[]> =>
    req<Record<string, unknown>[]>('GET', '/api/user/assignments', token).then(list =>
      list.map(adaptAssignment),
    ),

  getAssignment: (token: string, id: number): Promise<Assignment> =>
    req<Record<string, unknown>>('GET', `/api/user/assignments/${id}`, token).then(
      adaptAssignment,
    ),

  // --- Patient: sessions ---
  getSessions: (token: string): Promise<Session[]> =>
    req<Record<string, unknown>[]>('GET', '/api/user/sessions', token).then(list =>
      list.map(adaptSession),
    ),

  getSession: (token: string, id: number): Promise<Session> =>
    req<Record<string, unknown>>('GET', `/api/user/session/${id}`, token).then(adaptSession),

  getSessionAnalysis: (token: string, id: number): Promise<SessionAnalysis> =>
    req<Record<string, unknown>>('GET', `/api/user/session/${id}/analysis`, token).then(
      adaptAnalysis,
    ),

  uploadSession: async (
    token: string,
    assignmentId: number,
    videoBlob: Blob,
    filename = 'session.webm',
  ): Promise<Session> => {
    const form = new FormData();
    form.append('assignment_id', String(assignmentId));
    form.append('video', videoBlob, filename);
    const res = await fetch(`${BASE}/api/user/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json().then(adaptSession);
  },

  // --- Therapist: poses ---
  getPoses: (token: string): Promise<PoseTemplate[]> =>
    req<Record<string, unknown>[]>('GET', '/api/therapist/poses', token).then(list =>
      list.map(adaptPoseTemplate),
    ),

  createPose: (
    token: string,
    data: { name: string; pose_class: string; instructions: string },
  ): Promise<PoseTemplate> =>
    req<Record<string, unknown>>('POST', '/api/therapist/poses', token, data).then(
      adaptPoseTemplate,
    ),

  // --- Therapist: patients ---
  getPatients: (token: string): Promise<User[]> =>
    req<Record<string, unknown>[]>('GET', '/api/therapist/patients', token).then(list =>
      list.map(adaptUser),
    ),

  getAllPatients: (token: string): Promise<User[]> =>
    req<Record<string, unknown>[]>('GET', '/api/therapist/all-patients', token).then(list =>
      list.map(adaptUser),
    ),

  // --- Therapist: assignments ---
  assign: (
    token: string,
    data: { patient_id: number; pose_template_id: number; due_date?: string; notes?: string; required_days?: number },
  ): Promise<Assignment> =>
    req<Record<string, unknown>>('POST', '/api/therapist/assign', token, data).then(
      adaptAssignment,
    ),

  getPatientAssignments: (token: string, patientId: number): Promise<Assignment[]> =>
    req<Record<string, unknown>[]>('GET', `/api/therapist/patient/${patientId}/assignments`, token).then(
      list => list.map(adaptAssignment),
    ),

  updateAssignment: (
    token: string,
    assignmentId: number,
    data: { status?: string; notes?: string; due_date?: string; required_days?: number },
  ): Promise<Assignment> =>
    req<Record<string, unknown>>('PATCH', `/api/therapist/assignment/${assignmentId}`, token, data).then(
      adaptAssignment,
    ),

  // --- Therapist: sessions ---
  getPatientSessions: (token: string, patientId: number): Promise<Session[]> =>
    req<Record<string, unknown>[]>(
      'GET',
      `/api/therapist/sessions/${patientId}`,
      token,
    ).then(list => list.map(adaptSession)),

  getTherapistSessionAnalysis: (token: string, sessionId: number): Promise<SessionAnalysis> =>
    req<Record<string, unknown>>(
      'GET',
      `/api/therapist/session/${sessionId}/analysis`,
      token,
    ).then(adaptAnalysis),

  addFeedback: (token: string, sessionId: number, content: string): Promise<unknown> =>
    req('POST', `/api/therapist/session/${sessionId}/feedback`, token, { content }),

  markReviewed: (token: string, sessionId: number): Promise<unknown> =>
    req('POST', `/api/therapist/session/${sessionId}/mark-reviewed`, token),
};
