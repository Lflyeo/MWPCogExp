import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthContext } from '@/contexts/authContext';
import { useExperimentSession } from '../hooks/useExperimentSession';
import { useExperimentRunImmersive } from '../hooks/useExperimentRunFullscreen';
import { QuestionPanel } from '../components/QuestionPanel';
import { AnswerCanvas, type AnswerCanvasHandle } from '../components/AnswerCanvas';
import { ExperimentRestOverlay } from '../components/ExperimentRestOverlay';
import { ExperimentGuideTour } from '../components/ExperimentGuideTour';
import {
  captureAndUploadQuestionSnapshot,
  experimentFlowDetail,
  experimentFlowQuestionsList,
  experimentFlowsList,
  experimentSessionSubmit,
} from '@/services/experiment';
import { computeExperimentStats } from '../utils/computeExperimentStats';
import { filterGuideTourSteps, GUIDE_FLOW_ID, isGuideFlow } from '../constants/guideFlow';
import {
  clearGuideTourSession,
  loadGuideTourSession,
  markGuideTourAutoShown,
  markGuideTourDismissedPermanently,
  saveGuideTourSession,
} from '../utils/experimentGuideTourSession';
import { exitExperimentFullscreen } from '../utils/experimentFullscreen';
import type { ExperimentFlow, QuestionItem } from '../types/experiment';

type RestState = {
  seconds: number;
  nextQuestionIndex: number;
};

export default function ExperimentRunPage() {
  const { flowId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const shellRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const answerCanvasRef = useRef<AnswerCanvasHandle>(null);
  const processingRef = useRef(false);
  const restingRef = useRef(false);
  const questionPanelRef = useRef<HTMLDivElement>(null);
  const canvasSectionRef = useRef<HTMLElement>(null);
  const runKeysRef = useRef<HTMLDivElement>(null);

  const [flow, setFlow] = useState<ExperimentFlow | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restState, setRestState] = useState<RestState | null>(null);
  const [guideTourOpen, setGuideTourOpen] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [tourSteps, setTourSteps] = useState(() => filterGuideTourSteps(true));
  const [hasEntered, setHasEntered] = useState(false);

  const tourAnchorRefs = useMemo(
    () => ({
      'run-question': questionPanelRef,
      'run-canvas': canvasSectionRef,
      'run-keys': runKeysRef,
    }),
    [],
  );

  const currentTourStep = tourSteps[guideStepIndex];
  const isGuideTourRun = guideTourOpen && !!currentTourStep && currentTourStep.phase === 'run';
  const showRunKeysHint = isGuideTourRun && currentTourStep?.id === 'run-keys';

  const {
    session,
    currentQuestion,
    currentQuestionId,
    isLastQuestion,
    canDraw,
    startExperiment,
    endExperiment,
    finishCurrentQuestion,
    advanceToNextQuestion,
    setQuestionSnapshot,
    isQuestionFinished,
    recordEvent,
    updateStrokes,
    getCurrentStrokes,
    getSessionSnapshot,
  } = useExperimentSession(flowId, questions);

  const strokes = getCurrentStrokes();
  const isResting = restState !== null;
  const allowDraw = canDraw && !isResting && !isGuideTourRun;

  useExperimentRunImmersive(Boolean(flowId));

  useEffect(() => {
    if (!flowId) {
      navigate('/experiment', { replace: true });
      return;
    }
    setLoading(true);
    Promise.all([experimentFlowDetail(flowId), experimentFlowQuestionsList(flowId)])
      .then(([flowRes, qRes]) => {
        if (!flowRes.data) {
          navigate('/experiment', { replace: true });
          return;
        }
        setFlow(flowRes.data);
        setQuestions(qRes.data || []);
      })
      .catch(() => navigate('/experiment', { replace: true }))
      .finally(() => setLoading(false));
  }, [flowId, navigate]);

  useEffect(() => {
    if (!isGuideFlow(flowId) || loading) return;

    let cancelled = false;
    experimentFlowsList().then((res) => {
      if (cancelled) return;
      const hasFormal = (res.data || []).some((f) => f.id !== GUIDE_FLOW_ID);
      const steps = filterGuideTourSteps(hasFormal);
      setTourSteps(steps);

      const session = loadGuideTourSession();
      if (!session?.active) return;
      const step = steps[session.stepIndex];
      if (step?.phase === 'run') {
        setGuideStepIndex(session.stepIndex);
        setGuideTourOpen(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [flowId, loading]);

  useEffect(() => {
    if (loading || questions.length === 0) return;
    if (session.status !== 'idle') return;
    if (session.questions.length !== questions.length) return;
    startExperiment();
  }, [loading, questions.length, session.status, session.questions.length, startExperiment]);

  useEffect(() => {
    if (!loading && questions.length === 0) {
      navigate('/experiment', { replace: true });
    }
  }, [loading, navigate, questions.length]);

  const completeExperiment = useCallback(async () => {
    endExperiment();
    const finalSession = getSessionSnapshot();
    const stats = computeExperimentStats(finalSession, questions, flow?.name ?? '实验');
    if (!isGuideFlow(flowId)) {
      try {
        await experimentSessionSubmit(finalSession);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '实验数据提交失败');
      }
    }
    navigate('/experiment', { replace: true, state: { experimentResult: stats } });
  }, [endExperiment, flow?.name, flowId, getSessionSnapshot, navigate, questions]);

  const captureCurrentSnapshot = useCallback(async () => {
    if (!captureRef.current || !currentQuestionId || isQuestionFinished(currentQuestionId)) return;
    try {
      answerCanvasRef.current?.flushBeforeCapture();
      const url = await captureAndUploadQuestionSnapshot(
        captureRef.current,
        session.sessionId,
        flowId,
        currentQuestionId,
      );
      if (url) setQuestionSnapshot(currentQuestionId, url);
    } catch (err) {
      console.error('屏幕快照失败', err);
    }
  }, [currentQuestionId, flowId, isQuestionFinished, session.sessionId, setQuestionSnapshot]);

  const handleFinishQuestion = useCallback(async () => {
    if (processingRef.current || restingRef.current || isResting || !currentQuestionId || isGuideTourRun) return;
    processingRef.current = true;
    try {
      await captureCurrentSnapshot();
      finishCurrentQuestion();

      if (isLastQuestion) {
        await completeExperiment();
        return;
      }

      const restEnabled = flow?.rest_break_enabled !== false;
      const restSeconds = flow?.rest_break_seconds ?? 5;
      const restEvery = Math.max(1, flow?.rest_break_every ?? 1);
      const finishedCount = session.currentQuestionIndex + 1;
      if (restEnabled && restSeconds > 0 && finishedCount % restEvery === 0) {
        restingRef.current = true;
        recordEvent('rest_start', { seconds: restSeconds, nextIndex: session.currentQuestionIndex + 1 });
        setRestState({
          seconds: restSeconds,
          nextQuestionIndex: session.currentQuestionIndex + 2,
        });
      } else {
        advanceToNextQuestion();
      }
    } finally {
      processingRef.current = false;
    }
  }, [
    advanceToNextQuestion,
    captureCurrentSnapshot,
    completeExperiment,
    currentQuestionId,
    finishCurrentQuestion,
    flow?.rest_break_enabled,
    flow?.rest_break_seconds,
    flow?.rest_break_every,
    isGuideTourRun,
    isLastQuestion,
    isResting,
    recordEvent,
    session.currentQuestionIndex,
  ]);

  const handleEndExperiment = useCallback(async () => {
    if (processingRef.current || isGuideTourRun) return;
    processingRef.current = true;
    try {
      if (currentQuestionId && !isQuestionFinished(currentQuestionId)) {
        await captureCurrentSnapshot();
        finishCurrentQuestion();
      }
      await completeExperiment();
    } finally {
      processingRef.current = false;
    }
  }, [captureCurrentSnapshot, completeExperiment, currentQuestionId, finishCurrentQuestion, isGuideTourRun, isQuestionFinished]);

  const handleRestComplete = useCallback(() => {
    if (!restingRef.current) return;
    restingRef.current = false;
    recordEvent('rest_end');
    setRestState(null);
    advanceToNextQuestion();
  }, [advanceToNextQuestion, recordEvent]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isGuideTourRun && currentTourStep?.id !== 'run-keys') return;
      if (e.key === 'F9') {
        e.preventDefault();
        if (e.repeat || restingRef.current) return;
        void handleFinishQuestion();
      }
      if (e.key === 'F10') {
        e.preventDefault();
        void handleEndExperiment();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentTourStep?.id, handleEndExperiment, handleFinishQuestion, isGuideTourRun]);

  const handleStrokesChange = useCallback(
    (next: typeof strokes) => {
      updateStrokes(currentQuestionId, next);
    },
    [currentQuestionId, updateStrokes],
  );

  const closeGuideTour = useCallback(
    (dismissPermanently = false) => {
      setGuideTourOpen(false);
      clearGuideTourSession();
      void exitExperimentFullscreen();
      if (user?.id) {
        markGuideTourAutoShown(user.id);
        if (dismissPermanently) {
          markGuideTourDismissedPermanently(user.id);
        }
      }
    },
    [user?.id],
  );

  const handleTourNext = useCallback(() => {
    const step = tourSteps[guideStepIndex];
    if (!step) return;

    if (step.id === 'run-keys') {
      void exitExperimentFullscreen();
      const formalIndex = tourSteps.findIndex((s) => s.id === 'formal-section');
      if (formalIndex >= 0) {
        saveGuideTourSession({ active: true, stepIndex: formalIndex });
        setGuideTourOpen(false);
        navigate('/experiment');
      } else {
        closeGuideTour(false);
        navigate('/experiment');
      }
      return;
    }

    const nextIndex = Math.min(guideStepIndex + 1, tourSteps.length - 1);
    saveGuideTourSession({ active: true, stepIndex: nextIndex });
    setGuideStepIndex(nextIndex);
  }, [closeGuideTour, guideStepIndex, navigate, tourSteps]);

  const handleTourPrev = useCallback(() => {
    const prevIndex = Math.max(guideStepIndex - 1, 0);
    const prevStep = tourSteps[prevIndex];
    if (!prevStep) return;

    if (prevStep.phase !== 'run') {
      if (prevStep.phase === 'home' || prevStep.phase === 'formal') {
        void exitExperimentFullscreen();
      }
      saveGuideTourSession({ active: true, stepIndex: prevIndex });
      setGuideTourOpen(false);
      navigate('/experiment');
      return;
    }

    saveGuideTourSession({ active: true, stepIndex: prevIndex });
    setGuideStepIndex(prevIndex);
  }, [guideStepIndex, navigate, tourSteps]);

  const showLoading = loading || questions.length === 0;
  const showContent = !showLoading && !!currentQuestion;

  useEffect(() => {
    if (!showContent) {
      setHasEntered(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setHasEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [showContent]);

  return (
    <div
      ref={shellRef}
      className="experiment-page experiment-run-shell fixed inset-0 flex flex-col bg-[#f0f0ef] text-neutral-900"
    >
      <div className="experiment-run-shell-inner">
        <div className={`experiment-run-state ${showLoading ? 'is-active' : ''}`}>
          <div className="flex flex-1 items-center justify-center text-neutral-500">加载中...</div>
        </div>

        <div
          className={`experiment-run-state ${showContent ? 'is-active' : ''} ${
            hasEntered ? 'experiment-run-enter' : ''
          }`}
        >
          {showContent && (
            <>
              <main ref={captureRef} className="flex flex-1 min-h-0 flex-col gap-0 px-6 py-2">
                <div
                  key={currentQuestionId}
                  ref={questionPanelRef}
                  className="experiment-question-swap w-full shrink-0 self-start h-max min-h-0 max-h-[52vh] overflow-y-auto"
                >
                  <QuestionPanel content={currentQuestion.content} minimal />
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                  <AnswerCanvas
                    ref={answerCanvasRef}
                    strokes={strokes}
                    onStrokesChange={handleStrokesChange}
                    onRecordEvent={recordEvent}
                    disabled={!allowDraw}
                    minimal
                    sectionRef={canvasSectionRef}
                  />
                </div>
              </main>

              <div
                ref={runKeysRef}
                className={`experiment-run-keys-hint fixed bottom-4 left-1/2 z-10 rounded-lg border border-neutral-300 bg-white/95 px-4 py-2 text-xs text-neutral-600 shadow-sm ${
                  showRunKeysHint ? 'is-visible' : 'is-hidden'
                }`}
                aria-hidden={!showRunKeysHint}
              >
                F9 结束当前题 · F10 结束实验
              </div>

              <ExperimentGuideTour
                open={isGuideTourRun}
                stepIndex={guideStepIndex}
                steps={tourSteps}
                anchors={tourAnchorRefs}
                onNext={handleTourNext}
                onPrev={handleTourPrev}
                onClose={closeGuideTour}
              />

              <ExperimentRestOverlay
                show={restState !== null}
                seconds={restState?.seconds ?? 0}
                nextQuestionIndex={restState?.nextQuestionIndex ?? 1}
                totalQuestions={questions.length}
                onComplete={handleRestComplete}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
