import { appState } from './state.js';

export const $ = (s) => document.querySelector(s);

export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const paths = {
  home: "M3 10 12 3l9 7M5 9v12h5v-6h4v6h5V9",
  case: "M4 6h16v15H4zM8 6V3h8v3M4 11h16",
  comment: "M4 4h16v13H8l-4 4zM8 8h8M8 12h5",
  ticket: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4",
  chart: "M4 3v18h17M8 17v-6M13 17V6M18 17v-9",
  survey: "M5 4h14v17H5zM9 3h6v3H9zM8 11l2 2 5-5M8 17h7",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  arrow: "M5 12h14M14 7l5 5-5 5",
  plus: "M12 5v14M5 12h14",
  web: "M3 4h18v13H3zM8 21h8M12 17v4",
  mobile: "M7 2h10v20H7zM11 18h2",
  onsite: "M3 10h18M5 10v10M10 10v10M15 10v10M20 10v10M3 21h18M12 3l9 6H3z",
  sms: "M4 4h16v13H8l-4 4zM8 9h8",
  check: "M5 12l4 4L19 6",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  download: "M12 3v12M7 10l5 5 5-5M4 16v5h16v-5",
  logout: "M9 4H4v16h5M9 12h12M16 7l5 5-5 5",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6",
};

export const icon = (n) =>
  `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[n] || paths.case}"/></svg>`;

export const channel = {
  web: "网页评价",
  mobile: "移动评价",
  onsite: "大厅扫码",
  sms: "短信补评",
};

export const roles = {
  citizen: "办事群众",
  window: "窗口工作人员",
  admin: "系统管理员",
  rectifier: "整改专员",
  supervisor: "考核监督",
};

export const statuses = {
  pending: ["待受理", "amber"],
  dispatched: ["已派发", "purple"],
  rectifying: ["整改中", "amber"],
  feedback: ["待群众确认", ""],
  closed: ["已办结", "green"],
};

export const levels = ["非常不满意", "不满意", "基本满意", "满意", "非常满意"];

export const targets = { service: "办件服务", guide: "办事指南", window: "大厅窗口" };

export const courseQuestions = [
  "我觉得这个系统容易使用。",
  "我觉得系统的功能衔接顺畅。",
  "我觉得大多数人能很快学会使用。",
  "我在使用这个系统时很有信心。",
  "我愿意在有需要时再次使用这个系统。",
];

export const susQuestions = [
  "我愿意经常使用这个系统。",
  "我觉得这个系统不必要地复杂。",
  "我觉得这个系统容易使用。",
  "我觉得需要技术人员帮助才能使用这个系统。",
  "我觉得系统的各项功能整合得很好。",
  "我觉得系统存在太多不一致的地方。",
  "我觉得大多数人能很快学会使用这个系统。",
  "我觉得这个系统使用起来很繁琐。",
  "我在使用这个系统时感到很有信心。",
  "我需要学习很多东西才能开始使用这个系统。",
];

export const dimensions = [
  "心理需求",
  "身体需求",
  "时间压力",
  "表现不佳程度",
  "努力程度",
  "挫败感",
];

export const fmt = (v) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("zh-CN");

export const date = (v) => (v ? String(v).slice(0, 16).replace("T", " ") : "—");

export const badge = (s) =>
  `<span class="badge ${statuses[s]?.[1] || ""}">${statuses[s]?.[0] || esc(s)}</span>`;

export const isManager = () => ["admin", "supervisor"].includes(appState.user?.role);

export function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $("#toast").classList.remove("show"),
    4200,
  );
}

export function modal(title, subtitle, content, narrow = false) {
  const d = $("#dialog");
  d.className = narrow ? "narrow" : "";
  d.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${title}</h2><p class="dialog-subtitle">${subtitle}</p></div><button class="close" data-action="close" aria-label="关闭">×</button></div>${content}`;
  if (!d.open) d.showModal();
}

export function errorInDialog(err) {
  const el = $("#dialog .inline-error");
  if (el) {
    el.textContent = err.message;
    el.scrollIntoView({ block: "nearest" });
  } else toast(err.message);
}

export function empty(title, detail, button = "") {
  return `<div class="empty">${icon("case")}<h3>${title}</h3><p>${detail}</p>${button}</div>`;
}

export function heading(title, desc, button = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${desc}</p></div>${button}</div>`;
}

export function metric(label, value, unit, note, ico) {
  return `<article class="metric"><div class="metric-top">${label}<span class="metric-icon">${icon(ico)}</span></div><div class="metric-value">${fmt(value)}<small>${unit}</small></div><div class="metric-foot">${note}</div></article>`;
}
