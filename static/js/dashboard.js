import { $, date, empty, esc, heading, icon, isManager, levels, roles, statuses, targets } from './ui.js';
import { appState } from './state.js';
import { api } from './api.js';

export function ticketStage(t) {
  if (t.status === "feedback")
    return t.disposition === "invalid" ? "说明待确认" : "整改结果待确认";
  if (t.status === "closed")
    return t.disposition === "invalid" ? "解释已归档" : "整改已办结";
  return statuses[t.status]?.[0] || "处理中";
}

export function ticketActionTitle(e) {
  return (
    {
      create: "提交评价",
      dispatch: "派发工单",
      valid: "核实为有效差评",
      invalid: "提交核实说明",
      plan: "保存整改方案",
      feedback: "提交整改结果",
      accept: "评价人接受结果",
      reopen: "评价人退回处理",
      remind: "监督催办",
    }[e.action] ||
    statuses[e.to_status]?.[0] ||
    "更新记录"
  );
}

export function ticketNext(t) {
  const staff = t.assignee || "责任部门工作人员";
  if (t.status === "pending")
    return {
      owner: "管理 / 监督人员",
      title: "等待受理与派发",
      detail: "下一步将指定整改专员核实您的反馈。",
      mine: isManager(),
    };
  if (t.status === "dispatched")
    return {
      owner: staff,
      title: "正在核实问题",
      detail: "工作人员将结合服务记录形成核实依据；必要时会补充说明。",
      mine: isManager() || appState.user.role === "rectifier",
    };
  if (t.status === "rectifying")
    return {
      owner: staff,
      title: t.plan ? "正在落实整改方案" : "正在制定整改方案",
      detail: t.plan
        ? "整改完成后将提交结果，等待评价人确认。"
        : "保存具体方案并落实后，再提交整改结果。",
      mine: isManager() || appState.user.role === "rectifier",
    };
  if (t.status === "feedback")
    return {
      owner: "评价人",
      title: t.disposition === "invalid" ? "请阅读核实说明" : "请查看整改结果",
      detail: "您可以接受结果，也可以说明不接受的原因并退回处理。",
      mine: appState.user.role === "citizen" && appState.user.id === t.user_id,
    };
  return {
    owner: "无需继续操作",
    title:
      t.disposition === "invalid" ? "说明已获确认并归档" : "整改结果已获确认",
    detail:
      t.disposition === "invalid"
        ? "此记录为说明解释归档，不计入有效差评整改完成数。"
        : "评价人已确认接受整改结果，完整记录仍可查阅。",
    mine: false,
  };
}

export function ticketProgress(t) {
  const next = ticketNext(t),
    index = {
      pending: 0,
      dispatched: 1,
      rectifying: 2,
      feedback: 3,
      closed: 4,
    }[t.status];
  const labels =
    t.disposition === "invalid"
      ? ["已提交", "核实问题", "形成说明", "群众确认", "解释归档"]
      : ["已提交", "核实问题", "落实整改", "群众确认", "整改办结"];
  return `<section class="progress-summary"><div class="progress-heading"><span class="badge ${statuses[t.status][1]}">${ticketStage(t)}</span><small>最近更新 ${date(t.updated_at)}</small></div><h3>${next.title}</h3><p>${next.detail}</p><div class="progress-owner"><span>当前由 <b>${esc(next.owner)}</b> 处理</span><strong>${next.mine ? "需要您操作，请查看下方处理区" : t.status === "closed" ? "已完成" : "您可稍后再查看进展"}</strong></div><ol class="process-track">${labels.map((x, i) => `<li class="${i < index ? "done" : i === index ? "current" : ""}" ${i === index ? 'aria-current="step"' : ""}><span>${i < index ? "✓" : i + 1}</span>${x}</li>`).join("")}</ol></section>`;
}

export function taskCard(
  label,
  count,
  detail,
  destination,
  filterId,
  filter,
  accent = "",
) {
  return `<button class="task-card ${accent}" data-action="task-route" data-destination="${destination}" data-filter-id="${filterId}" data-filter="${filter}"><span>${label}${icon("arrow")}</span><strong>${count}<small>件</small></strong><p>${detail}</p></button>`;
}

export async function dashboard(token) {
  const [c, t, e] = await Promise.all([
    api("/cases"),
    api("/tickets"),
    api("/evaluations"),
  ]);
  if (token !== appState.generation) return;
  appState.cache.cases = c.items;
  const tickets = t.items,
    citizen = appState.user.role === "citizen";
  const pending = c.items.filter((x) => !x.evaluated),
    confirm = tickets.filter((x) => x.status === "feedback");
  const near = tickets.filter(
    (x) =>
      x.status !== "closed" &&
      new Date(x.due_at) - Date.now() >= 0 &&
      new Date(x.due_at) - Date.now() <= 86400000,
  );
  let cards = citizen
    ? taskCard(
        "待评价的办件",
        pending.length,
        "评价本次办理体验",
        "cases",
        "case-filter",
        "pending",
        "blue",
      ) +
      taskCard(
        "待您确认的反馈",
        confirm.length,
        "阅读说明或整改结果",
        "tickets",
        "ticket-filter",
        "feedback",
        "amber",
      ) +
      taskCard(
        "正在处理的反馈",
        tickets.filter((x) => !["closed", "feedback"].includes(x.status))
          .length,
        "查看责任人和最新进度",
        "tickets",
        "ticket-filter",
        "processing",
      )
    : taskCard(
        "待受理 / 待核实",
        tickets.filter((x) => ["pending", "dispatched"].includes(x.status))
          .length,
        "先查看需要推进的工单",
        "tickets",
        "ticket-filter",
        "review",
        "blue",
      ) +
      taskCard(
        "正在整改",
        tickets.filter((x) => x.status === "rectifying").length,
        "方案与处理结果分步保存",
        "tickets",
        "ticket-filter",
        "rectifying",
      ) +
      taskCard(
        "24 小时内到期",
        near.length,
        "以下方时间为教学处理期限",
        "tickets",
        "ticket-filter",
        "due-soon",
        "amber",
      );
  const active = citizen
    ? [
        ...confirm,
        ...tickets.filter((x) => !["closed", "feedback"].includes(x.status)),
      ]
    : tickets
        .filter((x) => x.status !== "closed")
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  $("#main").innerHTML =
    heading(
      citizen ? "我的服务工作台" : roles[appState.user.role] + "工作台",
      citizen
        ? "先完成眼前的待办，再查看每一次反馈的进展。"
        : "按权限展示当前待办，让核实与反馈有序推进。",
      `<button class="btn" data-page="public">${icon("chart")}服务总览</button>`,
    ) +
    `<div class="welcome-strip"><span class="avatar">${esc(appState.user.name[0])}</span><div><b>${esc(appState.user.name)}，您好</b><p>${citizen ? "您的评价、处理进度和确认事项集中在这里。" : appState.user.role === "window" ? "您可查看本部门进展，核实与整改由有权限的专员处理。" : "以下仅包含您有权查看的工单。"}</p></div><span class="badge">${roles[appState.user.role]}</span></div><section class="task-grid">${cards}</section>
  <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>${citizen ? "需要关注的处理进展" : "优先处理"}</h2><p>${citizen ? "待您确认的反馈优先显示" : "未办结工单按处理期限排序"}</p></div><button class="btn ghost small" data-page="tickets">全部工单</button></div><div class="task-list">${
    active
      .slice(0, 5)
      .map((x) => {
        const n = ticketNext(x);
        return `<article class="task-row"><div><span class="badge ${statuses[x.status][1]}">${ticketStage(x)}</span><h3>${esc(x.title)}</h3><p>${esc(n.owner)} · ${esc(n.title)}</p><small>最近更新 ${date(x.updated_at)}</small></div><button class="btn ${n.mine ? "primary" : ""} small" data-action="ticket" data-id="${x.id}">${n.mine ? "去处理" : "查看进展"}</button></article>`;
      })
      .join("") ||
    empty(
      "目前没有待处理工单",
      citizen
        ? "有新的反馈时，可在这里查看进度。"
        : "当前权限范围内暂无未办结工单。",
    )
  }</div></section>
  <section class="panel"><div class="panel-head"><div><h2>${citizen ? "待评价服务" : "工作提示"}</h2><p>${citizen ? "从实际办件进入评价" : "下一步操作与角色职责"}</p></div></div><div class="panel-body">${
    citizen
      ? pending
          .slice(0, 3)
          .map(
            (x) =>
              `<article class="pending-service"><h3>${esc(x.title)}</h3><p>${esc(x.department)}</p><button class="btn primary small" data-action="evaluate" data-id="${x.id}">去评价</button></article>`,
          )
          .join("") ||
        '<p class="muted">当前办件服务均已评价。可到我的办件查看其他评价对象。</p>'
      : `<ol class="work-notes"><li>先核实具体经过，再形成处理意见。</li><li>有效差评先保存整改方案，再反馈结果。</li><li>说明解释与完成整改分别标记，均由群众确认。</li></ol><button class="btn" data-page="guide">查看角色操作指南</button>`
  }</div></section></div>
  <section class="panel"><div class="panel-head"><div><h2>最近评价</h2><p>服务评价已独立保存，体验问卷可自愿填写</p></div><button class="btn ghost small" data-page="evaluations">全部记录</button></div>${
    e.items
      .slice(0, 3)
      .map(
        (x) =>
          `<article class="recent-evaluation"><div><h3>${esc(x.title)} <span class="badge">${targets[x.target]}</span></h3><p>${levels[x.rating - 1]} · ${date(x.created_at)}</p></div>${x.ticket_id ? `<button class="btn small" data-action="ticket" data-id="${x.ticket_id}">查看进度</button>` : '<span class="badge green">已保存</span>'}</article>`,
      )
      .join("") || empty("还没有评价记录", "提交评价后，可随时返回查看。")
  }</section>`;
}
