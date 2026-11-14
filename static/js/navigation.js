import { $, empty, esc, heading, icon, roles, toast } from './ui.js';
import { appState } from './state.js';
import { analyticsView, overview, rankingsView } from './reports.js';
import { casesView } from './cases.js';
import { evaluationDialog, evaluationsView } from './evaluations.js';
import { ticketsView } from './tickets.js';
import { guideView, messagesView } from './account.js';
import { api } from './api.js';

export function nav() {
  const items = [
    ["overview", "home", appState.user ? "我的工作台" : "服务总览"],
    ["cases", "case", appState.user?.role === "citizen" ? "我的办件" : "办件管理"],
    ["evaluations", "comment", "评价记录"],
    ["tickets", "ticket", "整改工单"],
    ["rankings", "chart", "公开榜单"],
    ["analytics", "survey", "交互评估"],
  ];
  if (appState.user) items.push(["public", "chart", "服务总览"]);
  if (appState.user?.role === "citizen") items.push(["messages", "mail", "模拟收件箱"]);
  items.push(["guide", "help", "实验指南"]);
  $("#sidebar").innerHTML =
    `<div class="brand"><div class="brand-mark">${icon("onsite")}</div><div><strong>民声有回应</strong><small>政务服务好差评</small></div></div><div class="nav-label">服务与监督</div>${items.map(([p, i, t]) => `<button class="nav ${appState.page === p ? "active" : ""}" data-page="${p}" aria-label="${t}" ${appState.page === p ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span></button>`).join("")}<div class="sidebar-bottom">${icon("shield")}<strong>让每一次评价都有回应</strong><span class="muted">评价 · 核实 · 整改 · 反馈</span><div style="margin-top:12px"><span class="badge">课程模拟 · 本地运行</span></div></div>`;
  $("#topbar").innerHTML =
    `<div class="breadcrumb">政务服务 <span style="margin:0 12px">/</span> <b>${items.find((i) => i[0] === appState.page)?.[2] || "工作台"}</b></div><div class="top-actions"><span class="mobile-brand">民声有回应</span><span class="environment"><i class="dot"></i>教学实验环境</span><button class="user-button" data-action="login"><span class="avatar">${appState.user ? esc(appState.user.name[0]) : "访"}</span><span>${appState.user ? esc(appState.user.name) : "登录体验"} <small>${appState.user ? roles[appState.user.role] : ""}</small></span></button>${appState.user ? `<button class="btn ghost small" data-action="logout" aria-label="退出登录">${icon("logout")}</button>` : ""}</div>`;
}

export async function render(next = appState.page) {
  appState.page = next;
  location.hash = appState.page;
  nav();
  appState.charts.forEach((c) => c.dispose());
  appState.charts = [];
  const token = ++appState.generation;
  $("#main").innerHTML =
    '<div class="skeleton"></div><div class="skeleton"></div>';
  try {
    if (!appState.user && !["overview", "public", "rankings", "guide"].includes(appState.page)) {
      $("#main").innerHTML =
        heading("登录后继续", "使用演示账号体验不同角色的完整流程") +
        empty(
          "请先登录",
          "办件、工单和问卷记录均按账号权限展示。",
          '<button class="btn primary" data-action="login">登录 / 注册</button>',
        );
      return;
    }
    const handlers = {
      overview: overview,
      public: overview,
      cases: casesView,
      evaluations: evaluationsView,
      tickets: ticketsView,
      rankings: rankingsView,
      analytics: analyticsView,
      messages: messagesView,
      guide: guideView,
    };
    await (handlers[appState.page] || overview)(token);
  } catch (e) {
    if (token === appState.generation)
      $("#main").innerHTML =
        heading("暂时无法加载", "请检查网络或本地服务状态") +
        empty(
          "连接未完成",
          esc(e.message),
          '<button class="btn primary" data-action="retry">重新加载</button>',
        );
  }
}

export async function handleInvite() {
  const token = new URLSearchParams(location.search).get("invite");
  if (token && appState.user?.role === "citizen") {
    try {
      const d = await api("/invite/" + encodeURIComponent(token));
      await evaluationDialog(d.case_id, "sms");
      history.replaceState(null, "", location.pathname + location.hash);
    } catch (e) {
      toast(e.message);
    }
  }
}
