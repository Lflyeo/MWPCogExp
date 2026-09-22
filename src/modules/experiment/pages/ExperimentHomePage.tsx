import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { AuthContext } from '@/contexts/authContext';
import { getProfile, type ProfileData } from '@/services/auth';
import { FlowSelection } from '../components/FlowSelection';
import { ExperimentGuideFlowCard } from '../components/ExperimentGuideFlowCard';
import { ExperimentGuideTour } from '../components/ExperimentGuideTour';
import { EnterToStartOverlay } from '../components/EnterToStartOverlay';
import { ExperimentUserConfirmOverlay } from '../components/ExperimentUserConfirmOverlay';
import { ExperimentResultModal } from '../components/ExperimentResultModal';
import { filterGuideTourSteps, GUIDE_FLOW_ID } from '../constants/guideFlow';
import {
  clearGuideTourSession,
  isGuideTourAutoShownForUser,
  isGuideTourDismissedPermanently,
  loadGuideTourSession,
  markGuideTourAutoShown,
  markGuideTourDismissedPermanently,
  saveGuideTourSession,
  ensureGuideTourLoginSession,
} from '../utils/experimentGuideTourSession';
import { experimentFlowsList } from '@/services/experiment';
import {
  enterExperimentFullscreen,
  exitExperimentFullscreen,
} from '../utils/experimentFullscreen';
import type { ExperimentFlow, ExperimentResultSummary } from '../types/experiment';

type StartPhase = 'idle' | 'confirm' | 'enter';

function ExperimentPageHeader() {
  const navigate = useNavigate();

  return (
    <div className="shrink-0 flex items-center gap-2 min-w-0 mb-4">
      <button
        type="button"
        className="p-2 rounded-full hover:bg-gray-100 shrink-0"
        onClick={() => navigate(-1)}
        aria-label="返回"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-800">面向认知实验的数学应用题求解模拟系统</h1>
        <p className="text-sm text-gray-500 truncate">建议先完成操作练习，再选择正式实验流</p>
      </div>
    </div>
  );
}

export default function ExperimentHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authReady, user } = useContext(AuthContext);
  const [flows, setFlows] = useState<ExperimentFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingFlow, setStartingFlow] = useState<ExperimentFlow | null>(null);
  const [startPhase, setStartPhase] = useState<StartPhase>('idle');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [result, setResult] = useState<ExperimentResultSummary | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [guideTourOpen, setGuideTourOpen] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);

  const guideCardRef = useRef<HTMLDivElement>(null);
  const guideStartRef = useRef<HTMLButtonElement>(null);
  const formalSectionRef = useRef<HTMLDivElement>(null);
  const formalStartRef = useRef<HTMLButtonElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const confirmProfileRef = useRef<HTMLDivElement>(null);
  const confirmContinueRef = useRef<HTMLButtonElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const enterPromptRef = useRef<HTMLDivElement>(null);

  const tourAnchorRefs = useMemo(
    () => ({
      'guide-card': guideCardRef,
      'guide-start': guideStartRef,
      'confirm-dialog': confirmDialogRef,
      'confirm-profile': confirmProfileRef,
      'confirm-continue': confirmContinueRef,
      'confirm-cancel': confirmCancelRef,
      'enter-prompt': enterPromptRef,
      'formal-section': formalSectionRef,
      'formal-start': formalStartRef,
    }),
    [],
  );

  const { guideFlow, formalFlows } = useMemo(() => {
    const guide = flows.find((f) => f.id === GUIDE_FLOW_ID) ?? null;
    const formal = flows.filter((f) => f.id !== GUIDE_FLOW_ID);
    return { guideFlow: guide, formalFlows: formal };
  }, [flows]);

  const tourSteps = useMemo(() => filterGuideTourSteps(formalFlows.length > 0), [formalFlows.length]);
  const currentTourStep = tourSteps[guideStepIndex];
  const showHomeTour = guideTourOpen && !!currentTourStep && currentTourStep.phase !== 'run';
  // 正式流列表渲染后再触发指引重测，确保 formal-start 锚点已挂载
  const tourAnchorRemeasureKey = formalFlows.length + (showHomeTour && currentTourStep?.phase === 'formal' ? guideStepIndex + 1 : 0);

  useEffect(() => {
    experimentFlowsList()
      .then((res) => setFlows(res.data || []))
      .catch(() => toast.error('加载实验流失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !guideFlow) return;

    const session = loadGuideTourSession();
    if (!session?.active) return;

    const step = tourSteps[session.stepIndex];
    if (!step || step.phase === 'run') {
      clearGuideTourSession();
      return;
    }

    setGuideStepIndex(session.stepIndex);
    setGuideTourOpen(true);
  }, [guideFlow, loading, location.key, tourSteps]);

  useEffect(() => {
    if (loading || !guideFlow || !authReady) return;
    if (!isAuthenticated || !user?.id) return;

    const session = loadGuideTourSession();
    if (session?.active) return;

    ensureGuideTourLoginSession(user.id);

    if (isGuideTourDismissedPermanently(user.id)) return;
    if (isGuideTourAutoShownForUser(user.id)) return;

    const timer = window.setTimeout(() => {
      setGuideStepIndex(0);
      setGuideTourOpen(true);
      saveGuideTourSession({ active: true, stepIndex: 0 });
      markGuideTourAutoShown(user.id);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [authReady, guideFlow, isAuthenticated, loading, user?.id]);

  useEffect(() => {
    const state = location.state as { experimentResult?: ExperimentResultSummary } | null;
    if (state?.experimentResult) {
      void exitExperimentFullscreen();
      setResult(state.experimentResult);
      setShowResult(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (startPhase !== 'confirm' || !startingFlow) return;
    if (!authReady) return;

    if (!isAuthenticated) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    getProfile()
      .then((data) => setProfile(data))
      .catch(() => {
        setProfile(null);
        toast.error('加载个人资料失败');
      })
      .finally(() => setProfileLoading(false));
  }, [authReady, isAuthenticated, startPhase, startingFlow]);

  const resetGuideFlowStart = useCallback(() => {
    setStartingFlow(null);
    setStartPhase('idle');
    setProfile(null);
  }, []);

  const cancelExperimentStart = useCallback(() => {
    resetGuideFlowStart();
    void exitExperimentFullscreen();
  }, [resetGuideFlowStart]);

  useEffect(() => {
    if (!showHomeTour || !currentTourStep || !guideFlow) return;

    if (currentTourStep.phase === 'confirm' || currentTourStep.phase === 'enter') {
      if (startingFlow?.id !== guideFlow.id) {
        setStartingFlow(guideFlow);
      }
      if (startPhase !== currentTourStep.phase) {
        setStartPhase(currentTourStep.phase);
      }
      return;
    }

    if (startingFlow?.id === GUIDE_FLOW_ID && startPhase !== 'idle') {
      cancelExperimentStart();
    }
  }, [cancelExperimentStart, currentTourStep, guideFlow, showHomeTour, startPhase, startingFlow?.id]);

  const closeGuideTour = useCallback(
    (dismissPermanently = false) => {
      setGuideTourOpen(false);
      clearGuideTourSession();
      if (user?.id) {
        markGuideTourAutoShown(user.id);
        if (dismissPermanently) {
          markGuideTourDismissedPermanently(user.id);
        }
      }
      if (startingFlow?.id === GUIDE_FLOW_ID) {
        cancelExperimentStart();
      } else {
        void exitExperimentFullscreen();
      }
    },
    [cancelExperimentStart, startingFlow?.id, user?.id],
  );

  const persistTourStep = useCallback((index: number) => {
    saveGuideTourSession({ active: true, stepIndex: index });
    setGuideStepIndex(index);
  }, []);

  const openGuideTour = useCallback(() => {
    setGuideStepIndex(0);
    setGuideTourOpen(true);
    saveGuideTourSession({ active: true, stepIndex: 0 });
  }, []);

  const handleTourNext = useCallback(() => {
    const step = tourSteps[guideStepIndex];
    if (!step) return;

    if (step.id === 'confirm-continue') {
      void enterExperimentFullscreen();
    }

    if (step.id === 'enter-start') {
      const runStepIndex = tourSteps.findIndex((s) => s.id === 'run-question');
      if (runStepIndex >= 0) {
        saveGuideTourSession({ active: true, stepIndex: runStepIndex });
        setGuideTourOpen(false);
        resetGuideFlowStart();
        navigate(`/experiment/${GUIDE_FLOW_ID}/run`);
      }
      return;
    }

    persistTourStep(Math.min(guideStepIndex + 1, tourSteps.length - 1));
  }, [guideStepIndex, navigate, persistTourStep, resetGuideFlowStart, tourSteps]);

  const handleTourPrev = useCallback(() => {
    const prevIndex = Math.max(guideStepIndex - 1, 0);
    const prevStep = tourSteps[prevIndex];
    if (!prevStep) return;

    if (prevStep.phase === 'home') {
      cancelExperimentStart();
    } else if (prevStep.phase === 'confirm') {
      if (guideFlow) setStartingFlow(guideFlow);
      setStartPhase('confirm');
    } else if (prevStep.phase === 'enter') {
      if (guideFlow) setStartingFlow(guideFlow);
      setStartPhase('enter');
    }

    persistTourStep(prevIndex);
  }, [cancelExperimentStart, guideFlow, guideStepIndex, persistTourStep, tourSteps]);

  const handleStart = (flow: ExperimentFlow) => {
    void enterExperimentFullscreen();
    setStartingFlow(flow);
    setStartPhase('confirm');
  };

  const handleConfirmProfile = () => {
    setStartPhase('enter');
  };

  const handleCancelStart = () => {
    cancelExperimentStart();
  };

  const handleEnterStart = useCallback(() => {
    if (!startingFlow) return;
    // 分步指引中的进入提示仅作演示，由用户点击「下一步」再进入作答页
    if (showHomeTour && currentTourStep?.id === 'enter-start') return;
    navigate(`/experiment/${startingFlow.id}/run`, { replace: true });
    resetGuideFlowStart();
  }, [currentTourStep?.id, navigate, resetGuideFlowStart, showHomeTour, startingFlow]);

  const handleCloseResult = () => {
    void exitExperimentFullscreen();
    setShowResult(false);
    setResult(null);
  };

  const showConfirmOverlay =
    startPhase === 'confirm' && startingFlow && (!showHomeTour || currentTourStep?.phase === 'confirm');
  const showEnterOverlay =
    startPhase === 'enter' && startingFlow && (!showHomeTour || currentTourStep?.phase === 'enter');
  const enterEnabled = !(showHomeTour && currentTourStep?.id === 'enter-start');
  const homeDimmed = showConfirmOverlay || showEnterOverlay;

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <ExperimentPageHeader />
        <div className="flex-1 flex items-center justify-center text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!guideFlow && formalFlows.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <ExperimentPageHeader />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          暂无可用实验流，请联系管理员配置
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`experiment-home-shell flex flex-col h-full min-h-0 ${
          homeDimmed ? 'experiment-home-shell--dimmed' : ''
        }`}
      >
        <ExperimentPageHeader />
        <div className="flex-1 min-h-0 overflow-y-auto">
          {guideFlow && (
            <ExperimentGuideFlowCard
              flow={guideFlow}
              cardRef={guideCardRef}
              startButtonRef={guideStartRef}
              onStart={handleStart}
              onShowGuide={openGuideTour}
            />
          )}
          {formalFlows.length > 0 ? (
            <FlowSelection
              flows={formalFlows}
              onStart={handleStart}
              sectionTitle="正式实验流"
              sectionRef={formalSectionRef}
              firstStartRef={formalStartRef}
            />
          ) : (
            <p className="text-sm text-gray-500 px-1">暂无其他正式实验流，请先完成上方操作练习。</p>
          )}
        </div>
      </div>

      <ExperimentGuideTour
        open={showHomeTour}
        stepIndex={guideStepIndex}
        steps={tourSteps}
        anchors={tourAnchorRefs}
        anchorRemeasureKey={tourAnchorRemeasureKey}
        onNext={handleTourNext}
        onPrev={handleTourPrev}
        onClose={closeGuideTour}
      />

      <ExperimentUserConfirmOverlay
        show={Boolean(showConfirmOverlay)}
        profile={profile}
        flowName={startingFlow?.name}
        loading={!authReady || profileLoading}
        onConfirm={handleConfirmProfile}
        onCancel={handleCancelStart}
        dialogRef={confirmDialogRef}
        profileRef={confirmProfileRef}
        confirmButtonRef={confirmContinueRef}
        cancelButtonRef={confirmCancelRef}
      />
      <EnterToStartOverlay
        show={Boolean(showEnterOverlay)}
        onStart={handleEnterStart}
        displayRef={enterPromptRef}
        enterEnabled={enterEnabled}
      />
      <ExperimentResultModal open={showResult} result={result} onClose={handleCloseResult} />
    </>
  );
}
