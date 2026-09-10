import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DrawingStroke,
  EventRecord,
  EventType,
  ExperimentSession,
  ExperimentStatus,
  QuestionItem,
} from '../types/experiment';

function createSessionId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function initSession(flowId: string, questions: QuestionItem[]): ExperimentSession {
  return {
    sessionId: createSessionId(),
    flowId,
    startedAt: null,
    endedAt: null,
    status: 'idle',
    currentQuestionIndex: 0,
    questions: questions.map((q) => ({
      questionId: q.id,
      mwpId: q.mwp_id ?? null,
      level5: q.level5 ?? null,
      events: [],
    })),
    strokes: Object.fromEntries(questions.map((q) => [q.id, []])),
  };
}

function getQuestionStartTime(events: EventRecord[]): number | null {
  const starts = events.filter((e) => e.type === 'question_start');
  return starts.length > 0 ? starts[starts.length - 1].timestamp : null;
}

function isSessionSynced(session: ExperimentSession, flowId: string, questions: QuestionItem[]): boolean {
  if (session.flowId !== flowId || session.questions.length !== questions.length) return false;
  return session.questions.every((q, i) => q.questionId === questions[i]?.id);
}

export function useExperimentSession(flowId: string, questions: QuestionItem[]) {
  const [session, setSession] = useState<ExperimentSession>(() => initSession(flowId, questions));
  const sessionRef = useRef(session);
  const pauseStartedAtRef = useRef<number | null>(null);

  const commitSession = useCallback((updater: (prev: ExperimentSession) => ExperimentSession) => {
    const next = updater(sessionRef.current);
    sessionRef.current = next;
    setSession(next);
    return next;
  }, []);

  // 题目异步加载后重新初始化会话，避免 questions 为空导致事件无法记录
  useEffect(() => {
    if (questions.length === 0) return;
    if (isSessionSynced(sessionRef.current, flowId, questions)) return;
    const fresh = initSession(flowId, questions);
    sessionRef.current = fresh;
    setSession(fresh);
  }, [flowId, questions]);

  const currentQuestion = questions[session.currentQuestionIndex];
  const currentQuestionId = currentQuestion?.id ?? '';

  const recordEventForQuestion = useCallback(
    (questionId: string, type: EventType, data?: Record<string, unknown>) => {
      if (!questionId) return;
      const event: EventRecord = { timestamp: Date.now(), type, data };
      commitSession((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.questionId === questionId ? { ...q, events: [...q.events, event] } : q,
        ),
      }));
    },
    [commitSession],
  );

  const recordEvent = useCallback(
    (type: EventType, data?: Record<string, unknown>) => {
      recordEventForQuestion(currentQuestionId, type, data);
    },
    [currentQuestionId, recordEventForQuestion],
  );

  const setStatus = useCallback(
    (status: ExperimentStatus) => {
      commitSession((prev) => ({ ...prev, status }));
    },
    [commitSession],
  );

  const startExperiment = useCallback(() => {
    const now = Date.now();
    commitSession((prev) => {
      const qId = questions[prev.currentQuestionIndex]?.id ?? '';
      const qIndex = prev.currentQuestionIndex;
      const events: EventRecord[] = [
        { timestamp: now, type: 'experiment_start' },
        { timestamp: now, type: 'question_start', data: { questionId: qId, index: qIndex } },
      ];
      return {
        ...prev,
        status: 'running',
        startedAt: prev.startedAt ?? now,
        endedAt: null,
        questions: prev.questions.map((q) =>
          q.questionId === qId ? { ...q, events: [...q.events, ...events] } : q,
        ),
      };
    });
  }, [commitSession, questions]);

  const pauseExperiment = useCallback(() => {
    pauseStartedAtRef.current = Date.now();
    setStatus('paused');
    recordEvent('experiment_pause');
  }, [recordEvent, setStatus]);

  const resumeExperiment = useCallback(() => {
    pauseStartedAtRef.current = null;
    setStatus('running');
    recordEvent('experiment_resume');
  }, [recordEvent, setStatus]);

  const setQuestionSnapshot = useCallback(
    (questionId: string, url: string) => {
      const event: EventRecord = { timestamp: Date.now(), type: 'question_snapshot', data: { url } };
      commitSession((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.questionId === questionId
            ? { ...q, screenSnapshot: url, events: [...q.events, event] }
            : q,
        ),
      }));
    },
    [commitSession],
  );

  const isQuestionFinished = useCallback((questionId: string) => {
    const qData = sessionRef.current.questions.find((q) => q.questionId === questionId);
    return qData?.events.some((e) => e.type === 'question_end') ?? false;
  }, []);

  const finishCurrentQuestion = useCallback((): { durationMs: number; questionId: string } => {
    const now = Date.now();
    const qId = sessionRef.current.currentQuestionIndex >= 0
      ? questions[sessionRef.current.currentQuestionIndex]?.id ?? ''
      : currentQuestionId;
    let durationMs = 0;

    commitSession((prev) => {
      const activeQId = questions[prev.currentQuestionIndex]?.id ?? qId;
      const qData = prev.questions.find((q) => q.questionId === activeQId);
      if (!qData || qData.events.some((e) => e.type === 'question_end')) {
        durationMs = qData?.answerDurationMs ?? 0;
        return prev;
      }
      const startTime = getQuestionStartTime(qData.events);
      durationMs = startTime ? Math.max(0, now - startTime) : 0;
      return {
        ...prev,
        questions: prev.questions.map((q) =>
          q.questionId === activeQId
            ? {
                ...q,
                answerDurationMs: durationMs,
                events: [
                  ...q.events,
                  { timestamp: now, type: 'question_end', data: { questionId: activeQId, durationMs } },
                ],
              }
            : q,
        ),
      };
    });

    return { durationMs, questionId: qId };
  }, [commitSession, currentQuestionId, questions]);

  const advanceToNextQuestion = useCallback(() => {
    const prev = sessionRef.current;
    if (prev.currentQuestionIndex >= questions.length - 1) return false;

    const now = Date.now();
    const nextIndex = prev.currentQuestionIndex + 1;
    const nextId = questions[nextIndex].id;

    commitSession((current) => ({
      ...current,
      status: 'running',
      currentQuestionIndex: nextIndex,
      questions: current.questions.map((q) => {
        if (q.questionId !== nextId) return q;
        return {
          ...q,
          events: [
            ...q.events,
            { timestamp: now, type: 'question_start', data: { questionId: nextId, index: nextIndex } },
          ],
        };
      }),
    }));

    return true;
  }, [commitSession, questions]);

  const endExperiment = useCallback((): ExperimentSession => {
    const now = Date.now();
    return commitSession((prev) => {
      const qId = questions[prev.currentQuestionIndex]?.id ?? '';
      const nextQuestions = prev.questions.map((q) => {
        if (q.questionId !== qId) return q;
        const events = [...q.events];
        if (!events.some((e) => e.type === 'question_end')) {
          const startTime = getQuestionStartTime(events);
          const durationMs = startTime ? Math.max(0, now - startTime) : 0;
          events.push({ timestamp: now, type: 'question_end', data: { questionId: qId, durationMs } });
        }
        events.push({ timestamp: now, type: 'experiment_end' });
        const startTime = getQuestionStartTime(q.events);
        const durationMs = startTime ? Math.max(0, now - startTime) : q.answerDurationMs ?? 0;
        return {
          ...q,
          answerDurationMs: q.answerDurationMs ?? durationMs,
          events,
        };
      });

      return {
        ...prev,
        status: 'ended',
        endedAt: now,
        questions: nextQuestions,
      };
    });
  }, [commitSession, questions]);

  const updateStrokes = useCallback(
    (questionId: string, strokes: DrawingStroke[]) => {
      commitSession((prev) => ({
        ...prev,
        strokes: { ...prev.strokes, [questionId]: strokes },
      }));
    },
    [commitSession],
  );

  const getCurrentStrokes = useCallback((): DrawingStroke[] => {
    return sessionRef.current.strokes[currentQuestionId] ?? [];
  }, [currentQuestionId]);

  const getSessionSnapshot = useCallback((): ExperimentSession => {
    return sessionRef.current;
  }, []);

  const resetSession = useCallback(() => {
    const fresh = initSession(flowId, questions);
    sessionRef.current = fresh;
    setSession(fresh);
    pauseStartedAtRef.current = null;
  }, [flowId, questions]);

  const isLastQuestion = session.currentQuestionIndex >= questions.length - 1;
  const canDraw = session.status === 'running';

  return {
    session,
    currentQuestion,
    currentQuestionId,
    isLastQuestion,
    canDraw,
    startExperiment,
    pauseExperiment,
    resumeExperiment,
    endExperiment,
    finishCurrentQuestion,
    advanceToNextQuestion,
    setQuestionSnapshot,
    isQuestionFinished,
    recordEvent,
    recordEventForQuestion,
    updateStrokes,
    getCurrentStrokes,
    getSessionSnapshot,
    resetSession,
  };
}
