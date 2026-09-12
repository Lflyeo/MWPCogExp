/** 是否在点击开始实验时调用浏览器 Fullscreen API。
 * 开启后移到屏幕顶部可能唤出浏览器「退出全屏」提示；作答页会自动恢复全屏以降低干扰。
 * 正式机房更推荐用 Chrome kiosk / 系统全屏启动，再配合本开关。
 */
export const EXPERIMENT_USE_NATIVE_FULLSCREEN = true;
