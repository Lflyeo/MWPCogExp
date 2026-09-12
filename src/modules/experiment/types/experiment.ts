export type ExperimentStatus = 'idle' | 'running' | 'paused' | 'ended';

export type EventType =
  | 'experiment_start'
  | 'experiment_pause'
  | 'experiment_resume'
  | 'experiment_end'
  | 'question_start'
  | 'question_end'
  | 'question_snapshot'
  | 'rest_start'
  | 'rest_end'
  | 'stroke_start'
  | 'stroke_point'
  | 'stroke_end'
  | 'undo'
  | 'clear';

export type EventRecord = {
  timestamp: number;
  type: EventType;
  data?: Record<string, unknown>;
};

/** 单题实验数据（核心结构） */
export type ExperimentData = {
  questionId: string;
  mwpId?: number | null;
  level5?: string | null;
  events: EventRecord[];
  screenSnapshot?: string;
  answerDurationMs?: number;
};

export type StrokePoint = {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
};

export type DrawingTool = 'pen' | 'eraser';

export type DrawingStroke = {
  id: string;
  points: StrokePoint[];
  color: string;
  strokeWidth: number;
  tool?: DrawingTool;
};

export type QuestionItem = {
  id: string;
  title?: string;
  content: string;
  mwp_id?: number | null;
  level5?: string | null;
};

export type ExperimentFlow = {
  id: string;
  name: string;
  description?: string;
  question_count?: number;
  rest_break_enabled?: boolean;
  rest_break_seconds?: number;
  rest_break_every?: number;
};

export type ExperimentSession = {
  sessionId: string;
  flowId: string;
  startedAt: number | null;
  endedAt: number | null;
  status: ExperimentStatus;
  currentQuestionIndex: number;
  questions: ExperimentData[];
  strokes: Record<string, DrawingStroke[]>;
  /** 题目区标注笔迹（与作答区 strokes 分离） */
  questionAnnotations: Record<string, DrawingStroke[]>;
};

export type QuestionAnswerStat = {
  questionId: string;
  title?: string;
  index: number;
  durationMs: number;
};

export type ExperimentResultSummary = {
  sessionId: string;
  flowId: string;
  flowName: string;
  perQuestion: QuestionAnswerStat[];
  totalAnswerMs: number;
  averageAnswerMs: number;
};
