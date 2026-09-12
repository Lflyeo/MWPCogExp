/** 与后端 flow-guide 一致，用于首页置顶的操作练习流 */
export const GUIDE_FLOW_ID = 'flow-guide';

export type GuideTourPhase = 'home' | 'confirm' | 'enter' | 'run' | 'formal';

export type GuideTourAnchor =
  | 'guide-card'
  | 'guide-start'
  | 'confirm-dialog'
  | 'confirm-profile'
  | 'confirm-continue'
  | 'confirm-cancel'
  | 'enter-prompt'
  | 'run-question'
  | 'run-canvas'
  | 'run-keys'
  | 'formal-section'
  | 'formal-start';

export type ExperimentGuideTourStep = {
  id: string;
  title: string;
  content: string;
  phase: GuideTourPhase;
  anchor?: GuideTourAnchor;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

export const EXPERIMENT_GUIDE_TOUR_STEPS: ExperimentGuideTourStep[] = [
  {
    id: 'guide-card',
    phase: 'home',
    title: '操作练习入口',
    content: '建议先从这里进入「实验操作练习」，用 2 道练习题熟悉完整流程，数据不会计入正式实验。',
    anchor: 'guide-card',
    placement: 'bottom',
  },
  {
    id: 'guide-start',
    phase: 'home',
    title: '开始练习',
    content: '点击此按钮后，将先弹出个人信息确认窗口。下一步将打开该窗口并继续说明。',
    anchor: 'guide-start',
    placement: 'left',
  },
  {
    id: 'confirm-dialog',
    phase: 'confirm',
    title: '确认个人信息',
    content: '开始实验前会弹出此窗口，请核对即将参与实验的个人信息是否正确。',
    anchor: 'confirm-dialog',
    placement: 'right',
  },
  {
    id: 'confirm-profile',
    phase: 'confirm',
    title: '核对资料',
    content: '请逐项核对姓名、学号、学院等信息。若有误请先取消，到「我的」页面修改后再开始。',
    anchor: 'confirm-profile',
    placement: 'right',
  },
  {
    id: 'confirm-continue',
    phase: 'confirm',
    title: '确认并继续',
    content: '信息无误时点击「确认无误，继续」，将进入准备界面；有误则点击「取消」返回。',
    anchor: 'confirm-continue',
    placement: 'top',
  },
  {
    id: 'enter-start',
    phase: 'enter',
    title: '进入实验',
    content: '确认后将全屏显示准备界面，按 F9 键进入作答页面。',
    anchor: 'enter-prompt',
    placement: 'bottom',
  },
  {
    id: 'run-question',
    phase: 'run',
    title: '题目区域',
    content: '作答页上方为题目区域，请在此阅读题目内容后再开始书写。',
    anchor: 'run-question',
    placement: 'bottom',
  },
  {
    id: 'run-canvas',
    phase: 'run',
    title: '手写作答区',
    content: '下方为手写作答区，可使用鼠标、触控笔或数位板在此书写解题过程。',
    anchor: 'run-canvas',
    placement: 'top',
  },
  {
    id: 'run-keys',
    phase: 'run',
    title: '快捷键',
    content: '按 F9 完成本题并保存屏幕快照；题间休息倒计时结束后需再按 F9 进入下一题。最后一题请按 F10 结束整场实验。',
    anchor: 'run-keys',
    placement: 'top',
  },
  {
    id: 'formal-section',
    phase: 'formal',
    title: '正式实验流',
    content: '熟悉操作流程后，在下方选择正式实验流参加测试。正式实验的数据会被记录。',
    anchor: 'formal-section',
    placement: 'top',
  },
  {
    id: 'formal-start',
    phase: 'formal',
    title: '开始正式实验',
    content: '选择实验流后点击「开始」，流程与练习相同：确认信息 → 按 F9 进入 → 作答。',
    anchor: 'formal-start',
    placement: 'left',
  },
];

export function filterGuideTourSteps(hasFormalFlows: boolean): ExperimentGuideTourStep[] {
  if (hasFormalFlows) return EXPERIMENT_GUIDE_TOUR_STEPS;
  return EXPERIMENT_GUIDE_TOUR_STEPS.filter(
    (s) => s.phase !== 'formal' && s.anchor !== 'formal-section' && s.anchor !== 'formal-start',
  );
}

export function isGuideFlow(flowId: string | null | undefined): boolean {
  return flowId === GUIDE_FLOW_ID;
}

/** @deprecated 使用 EXPERIMENT_GUIDE_DISMISSED_KEY */
export const EXPERIMENT_GUIDE_SEEN_KEY = 'experiment_guide_tour_seen';
