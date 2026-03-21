export interface User {
  id: string;
  name: string;
  email: string;
  role: 'therapist' | 'patient';
  createdAt: string;
}

export interface PoseTemplate {
  id: string;
  therapistId: string;
  poseName: string;
  expectedPoseClass: number;
  instructions: string;
  referenceVideoUrl?: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  therapistId: string;
  patientId: string;
  poseTemplateId: string;
  assignedAt: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  pose?: PoseTemplate;
  therapist?: User;
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
  id: string;
  sessionId: string;
  overallCorrectness: number;
  totalFrames: number;
  correctFrames: number;
  areasOfConcern: AreaOfConcern[];
  timeline: TimelineEntry[];
}

export interface Session {
  id: string;
  assignmentId: string;
  patientId: string;
  videoUrl?: string;
  recordedAt: string;
  processed: boolean;
  analysis?: SessionAnalysis;
  poseName?: string;
}

// Mock users
export const mockUsers: User[] = [
  { id: 'therapist-1', name: 'Dr. Sarah Chen', email: 'sarah@clinic.com', role: 'therapist', createdAt: '2024-01-15' },
  { id: 'patient-1', name: 'Alex Johnson', email: 'alex@email.com', role: 'patient', createdAt: '2024-02-01' },
  { id: 'patient-2', name: 'Maria Garcia', email: 'maria@email.com', role: 'patient', createdAt: '2024-02-10' },
  { id: 'patient-3', name: 'James Wright', email: 'james@email.com', role: 'patient', createdAt: '2024-03-01' },
];

export const mockPoseTemplates: PoseTemplate[] = [
  { id: 'pose-1', therapistId: 'therapist-1', poseName: 'Standing Forward Bend', expectedPoseClass: 0, instructions: 'Stand with feet hip-width apart. Slowly bend forward from your hips, keeping your back straight. Reach toward your toes. Hold for 15 seconds.', createdAt: '2024-02-15' },
  { id: 'pose-2', therapistId: 'therapist-1', poseName: 'Warrior II Pose', expectedPoseClass: 1, instructions: 'Step feet wide apart. Turn right foot out 90°. Bend right knee over ankle. Extend arms parallel to floor. Gaze over right hand. Hold for 20 seconds.', createdAt: '2024-02-20' },
  { id: 'pose-3', therapistId: 'therapist-1', poseName: 'Tree Pose', expectedPoseClass: 2, instructions: 'Stand on left leg. Place right foot on inner left thigh. Bring hands to prayer position at chest. Hold for 15 seconds. Switch sides.', createdAt: '2024-03-01' },
  { id: 'pose-4', therapistId: 'therapist-1', poseName: 'Bridge Pose', expectedPoseClass: 3, instructions: 'Lie on your back with knees bent. Feet flat on floor, hip-width apart. Press feet into floor and lift hips. Hold for 10 seconds.', createdAt: '2024-03-05' },
];

export const mockAssignments: Assignment[] = [
  { id: 'assign-1', therapistId: 'therapist-1', patientId: 'patient-1', poseTemplateId: 'pose-1', assignedAt: '2024-03-10', dueDate: '2024-03-20', status: 'completed', pose: mockPoseTemplates[0], therapist: mockUsers[0] },
  { id: 'assign-2', therapistId: 'therapist-1', patientId: 'patient-1', poseTemplateId: 'pose-2', assignedAt: '2024-03-12', dueDate: '2024-03-25', status: 'pending', pose: mockPoseTemplates[1], therapist: mockUsers[0] },
  { id: 'assign-3', therapistId: 'therapist-1', patientId: 'patient-1', poseTemplateId: 'pose-3', assignedAt: '2024-03-15', dueDate: '2024-03-28', status: 'pending', pose: mockPoseTemplates[2], therapist: mockUsers[0] },
  { id: 'assign-4', therapistId: 'therapist-1', patientId: 'patient-2', poseTemplateId: 'pose-1', assignedAt: '2024-03-10', dueDate: '2024-03-20', status: 'completed', pose: mockPoseTemplates[0], therapist: mockUsers[0] },
  { id: 'assign-5', therapistId: 'therapist-1', patientId: 'patient-2', poseTemplateId: 'pose-4', assignedAt: '2024-03-14', dueDate: '2024-03-26', status: 'pending', pose: mockPoseTemplates[3], therapist: mockUsers[0] },
  { id: 'assign-6', therapistId: 'therapist-1', patientId: 'patient-3', poseTemplateId: 'pose-2', assignedAt: '2024-03-16', dueDate: '2024-03-30', status: 'pending', pose: mockPoseTemplates[1], therapist: mockUsers[0] },
];

const generateTimeline = (duration: number, correctness: number): TimelineEntry[] => {
  const entries: TimelineEntry[] = [];
  for (let t = 0; t < duration; t += 0.5) {
    entries.push({ timestamp: t, isCorrect: Math.random() < correctness });
  }
  return entries;
};

export const mockSessions: Session[] = [
  {
    id: 'session-1', assignmentId: 'assign-1', patientId: 'patient-1', recordedAt: '2024-03-18T10:30:00', processed: true, poseName: 'Standing Forward Bend',
    analysis: {
      id: 'analysis-1', sessionId: 'session-1', overallCorrectness: 0.78, totalFrames: 300, correctFrames: 234,
      areasOfConcern: [
        { bodyPart: 'Lower Back', issue: 'Rounding detected — keep spine neutral', severity: 'moderate', timestamps: [5.2, 12.8, 18.3] },
        { bodyPart: 'Right Knee', issue: 'Slight hyperextension observed', severity: 'low', timestamps: [8.0, 15.5] },
      ],
      timeline: generateTimeline(30, 0.78),
    },
  },
  {
    id: 'session-2', assignmentId: 'assign-4', patientId: 'patient-2', recordedAt: '2024-03-19T14:15:00', processed: true, poseName: 'Standing Forward Bend',
    analysis: {
      id: 'analysis-2', sessionId: 'session-2', overallCorrectness: 0.92, totalFrames: 280, correctFrames: 258,
      areasOfConcern: [
        { bodyPart: 'Left Shoulder', issue: 'Slight elevation — relax shoulders', severity: 'low', timestamps: [3.1, 20.0] },
      ],
      timeline: generateTimeline(28, 0.92),
    },
  },
  {
    id: 'session-3', assignmentId: 'assign-1', patientId: 'patient-1', recordedAt: '2024-03-15T09:00:00', processed: true, poseName: 'Standing Forward Bend',
    analysis: {
      id: 'analysis-3', sessionId: 'session-3', overallCorrectness: 0.62, totalFrames: 320, correctFrames: 198,
      areasOfConcern: [
        { bodyPart: 'Lower Back', issue: 'Excessive rounding', severity: 'high', timestamps: [2.0, 6.5, 10.2, 14.8, 22.1] },
        { bodyPart: 'Right Knee', issue: 'Not fully extended', severity: 'moderate', timestamps: [4.0, 11.0, 18.5] },
        { bodyPart: 'Neck', issue: 'Head not aligned with spine', severity: 'low', timestamps: [7.2, 16.0] },
      ],
      timeline: generateTimeline(32, 0.62),
    },
  },
];

// Simulated API
let poseTemplates = [...mockPoseTemplates];
let assignments = [...mockAssignments];
let sessions = [...mockSessions];

export const api = {
  login: (email: string, _password: string): User | null => {
    return mockUsers.find(u => u.email === email) || null;
  },
  register: (name: string, email: string, role: 'therapist' | 'patient'): User => {
    const user: User = { id: `user-${Date.now()}`, name, email, role, createdAt: new Date().toISOString() };
    mockUsers.push(user);
    return user;
  },
  // Therapist
  getTherapistPoses: (therapistId: string) => poseTemplates.filter(p => p.therapistId === therapistId),
  createPose: (pose: Omit<PoseTemplate, 'id' | 'createdAt'>) => {
    const newPose: PoseTemplate = { ...pose, id: `pose-${Date.now()}`, createdAt: new Date().toISOString() };
    poseTemplates.push(newPose);
    return newPose;
  },
  getPatients: () => mockUsers.filter(u => u.role === 'patient'),
  assignPose: (therapistId: string, patientId: string, poseTemplateId: string, dueDate: string) => {
    const pose = poseTemplates.find(p => p.id === poseTemplateId);
    const therapist = mockUsers.find(u => u.id === therapistId);
    const a: Assignment = { id: `assign-${Date.now()}`, therapistId, patientId, poseTemplateId, assignedAt: new Date().toISOString(), dueDate, status: 'pending', pose, therapist };
    assignments.push(a);
    return a;
  },
  getPatientSessions: (patientId: string) => sessions.filter(s => s.patientId === patientId),
  getSessionAnalysis: (sessionId: string) => sessions.find(s => s.id === sessionId),
  // Patient
  getAssignments: (patientId: string) => assignments.filter(a => a.patientId === patientId),
  uploadSession: (patientId: string, assignmentId: string): Session => {
    const assignment = assignments.find(a => a.id === assignmentId);
    const correctness = 0.5 + Math.random() * 0.45;
    const totalFrames = 250 + Math.floor(Math.random() * 100);
    const session: Session = {
      id: `session-${Date.now()}`, assignmentId, patientId, recordedAt: new Date().toISOString(), processed: true,
      poseName: assignment?.pose?.poseName || 'Unknown Pose',
      analysis: {
        id: `analysis-${Date.now()}`, sessionId: `session-${Date.now()}`,
        overallCorrectness: correctness, totalFrames, correctFrames: Math.floor(totalFrames * correctness),
        areasOfConcern: [
          { bodyPart: 'Right Elbow', issue: 'Not fully extended', severity: 'moderate', timestamps: [3.5, 8.2] },
        ],
        timeline: generateTimeline(25, correctness),
      },
    };
    sessions.push(session);
    if (assignment) assignment.status = 'completed';
    return session;
  },
  getSessions: (patientId: string) => sessions.filter(s => s.patientId === patientId),
};
