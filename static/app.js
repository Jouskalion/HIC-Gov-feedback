const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
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
const icon = (n) =>
  `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[n] || paths.case}"/></svg>`;
const channel = {
  web: "网页评价",
  mobile: "移动评价",
  onsite: "大厅扫码",
  sms: "短信补评",
};
const roles = {
  citizen: "办事群众",
  window: "窗口工作人员",
  admin: "系统管理员",
  rectifier: "整改专员",
  supervisor: "考核监督",
};
const statuses = {
  pending: ["待受理", "amber"],
  dispatched: ["已派发", "purple"],
  rectifying: ["整改中", "amber"],
  feedback: ["待群众确认", ""],
  closed: ["已办结", "green"],
};
const levels = ["非常不满意", "不满意", "基本满意", "满意", "非常满意"];
const targets = { service: "办件服务", guide: "办事指南", window: "大厅窗口" };
const courseQuestions = [
  "我觉得这个系统容易使用。",
  "我觉得系统的功能衔接顺畅。",
  "我觉得大多数人能很快学会使用。",
  "我在使用这个系统时很有信心。",
  "我愿意在有需要时再次使用这个系统。",
];
const susQuestions = [
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
const dimensions = [
  "心理需求",
  "身体需求",
  "时间压力",
  "表现不佳程度",
  "努力程度",
  "挫败感",
];
let user = null,
  csrf = "",
  meta = { departments: [], staff: [] },
  page = "overview",
  charts = [],
  cache = {},
  generation = 0,
  surveyStart = 0;
const fmt = (v) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("zh-CN");
const date = (v) => (v ? String(v).slice(0, 16).replace("T", " ") : "—");
const badge = (s) =>
  `<span class="badge ${statuses[s]?.[1] || ""}">${statuses[s]?.[0] || esc(s)}</span>`;
const isManager = () => ["admin", "supervisor"].includes(user?.role);
async function api(path, method = "GET", data) {
  let r;
  try {
    r = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw Error("网络连接中断，请检查连接后重试。已保存的记录不会丢失。");
  }
  let out;
  try {
    out = await r.json();
  } catch {
    throw Error("服务暂时不可用，请稍后重试。");
  }
  if (!r.ok) throw Error(out.error || "请求未完成");
  return out;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $("#toast").classList.remove("show"),
    4200,
  );
}
function modal(title, subtitle, content, narrow = false) {
  const d = $("#dialog");
  d.className = narrow ? "narrow" : "";
  d.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${title}</h2><p class="dialog-subtitle">${subtitle}</p></div><button class="close" data-action="close" aria-label="关闭">×</button></div>${content}`;
  if (!d.open) d.showModal();
}
function errorInDialog(err) {
  const el = $("#dialog .inline-error");
  if (el) {
    el.textContent = err.message;
    el.scrollIntoView({ block: "nearest" });
  } else toast(err.message);
}
function empty(title, detail, button = "") {
  return `<div class="empty">${icon("case")}<h3>${title}</h3><p>${detail}</p>${button}</div>`;
}
function heading(title, desc, button = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${desc}</p></div>${button}</div>`;
}
function metric(label, value, unit, note, ico) {
  return `<article class="metric"><div class="metric-top">${label}<span class="metric-icon">${icon(ico)}</span></div><div class="metric-value">${fmt(value)}<small>${unit}</small></div><div class="metric-foot">${note}</div></article>`;
}
function nav() {
  const items = [
    ["overview", "home", user ? "我的工作台" : "服务总览"],
    ["cases", "case", user?.role === "citizen" ? "我的办件" : "办件管理"],
    ["evaluations", "comment", "评价记录"],
    ["tickets", "ticket", "整改工单"],
    ["rankings", "chart", "公开榜单"],
    ["analytics", "survey", "交互评估"],
  ];
  if (user) items.push(["public", "chart", "服务总览"]);
  if (user?.role === "citizen") items.push(["messages", "mail", "模拟收件箱"]);
  items.push(["guide", "help", "实验指南"]);
  $("#sidebar").innerHTML =
    `<div class="brand"><div class="brand-mark">${icon("onsite")}</div><div><strong>民声有回应</strong><small>政务服务好差评</small></div></div><div class="nav-label">服务与监督</div>${items.map(([p, i, t]) => `<button class="nav ${page === p ? "active" : ""}" data-page="${p}" aria-label="${t}" ${page === p ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span></button>`).join("")}<div class="sidebar-bottom">${icon("shield")}<strong>让每一次评价都有回应</strong><span class="muted">评价 · 核实 · 整改 · 反馈</span><div style="margin-top:12px"><span class="badge">课程模拟 · 本地运行</span></div></div>`;
  $("#topbar").innerHTML =
    `<div class="breadcrumb">政务服务 <span style="margin:0 12px">/</span> <b>${items.find((i) => i[0] === page)?.[2] || "工作台"}</b></div><div class="top-actions"><span class="mobile-brand">民声有回应</span><span class="environment"><i class="dot"></i>教学实验环境</span><button class="user-button" data-action="login"><span class="avatar">${user ? esc(user.name[0]) : "访"}</span><span>${user ? esc(user.name) : "登录体验"} <small>${user ? roles[user.role] : ""}</small></span></button>${user ? `<button class="btn ghost small" data-action="logout" aria-label="退出登录">${icon("logout")}</button>` : ""}</div>`;
}
function draw(id, option) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!window.echarts) {
    el.innerHTML = empty("图表暂不可用", "数据仍可通过下方表格查看");
    return;
  }
  const c = echarts.init(el);
  c.setOption({
    animation: false,
    textStyle: { fontFamily: "Microsoft YaHei, sans-serif" },
    color: ["#4b7de0", "#83b7ed", "#76bea7", "#b1a4da"],
    ...option,
  });
  charts.push(c);
}
function lineChart(id, trend) {
  draw(id, {
    tooltip: { trigger: "axis" },
    grid: { left: 35, right: 20, top: 22, bottom: 28 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: trend.map((x) => x.date.slice(5)),
      axisLine: { lineStyle: { color: "#e4eaf4" } },
      axisLabel: { color: "#8c9cb3", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: "#9aa7b9", fontSize: 10 },
      splitLine: { lineStyle: { color: "#f0f3f8", type: "dashed" } },
    },
    series: [
      {
        name: "评价数",
        type: "line",
        smooth: true,
        symbolSize: 5,
        data: trend.map((x) => x.count),
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#dce8ff" },
            { offset: 1, color: "#fff" },
          ]),
        },
      },
    ],
  });
}
function donut(id, channels) {
  draw(id, {
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      icon: "circle",
      itemWidth: 7,
      itemHeight: 7,
      textStyle: { color: "#7d8ca2", fontSize: 10 },
    },
    series: [
      {
        type: "pie",
        radius: ["48%", "68%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: "#fff", borderWidth: 4, borderRadius: 5 },
        data: Object.entries(channels).map(([k, v]) => ({
          name: channel[k],
          value: v,
        })),
      },
    ],
  });
}
async function render(next = page) {
  page = next;
  location.hash = page;
  nav();
  charts.forEach((c) => c.dispose());
  charts = [];
  const token = ++generation;
  $("#main").innerHTML =
    '<div class="skeleton"></div><div class="skeleton"></div>';
  try {
    if (!user && !["overview", "public", "rankings", "guide"].includes(page)) {
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
    await (handlers[page] || overview)(token);
  } catch (e) {
    if (token === generation)
      $("#main").innerHTML =
        heading("暂时无法加载", "请检查网络或本地服务状态") +
        empty(
          "连接未完成",
          esc(e.message),
          '<button class="btn primary" data-action="retry">重新加载</button>',
        );
  }
}
async function overview(token) {
  if (user && page !== "public") return dashboard(token);
  const s = await api("/public/stats");
  if (token !== generation) return;
  $("#main").innerHTML =
    heading(
      "服务有温度，评价有回声",
      "从一次评价开始，让服务改进看得见。",
      `<button class="btn" data-page="guide">${icon("help")}实验操作指南</button>`,
    ) +
    `<section class="hero"><span class="hero-note">四类渠道 · 全流程可追溯</span><div class="hero-eyebrow">PUBLIC SERVICE FEEDBACK</div><h2>您的每一条建议，都值得被认真对待</h2><p>便捷评价办理体验，随时查看整改进展。让真实的反馈，成为下一次更好服务的起点。</p><button class="btn primary" data-action="start">开始评价 ${icon("arrow")}</button> <button class="btn ghost" data-page="tickets">查看处理进度</button></section><section class="metrics">${metric("累计评价", s.total, "条", "各渠道评价统一归集", "comment")}${metric("满意与非常满意", s.positive, "条", "五级评价中的 4 星与 5 星", "check")}${metric("收到差评", s.negative, "条", "不满意与非常不满意", "ticket")}${metric("有效差评整改率", s.rectification_rate, "%", "已确认办结 / 已核实有效差评", "chart")}</section><section class="grid-two"><article class="panel"><div class="panel-head"><div><h2>评价趋势</h2><p>最近实验记录的每日评价量</p></div><span class="badge">模拟数据 ${s.simulated} 条</span></div><div class="panel-body"><div id="trend" class="chart" role="img" aria-label="每日评价数量趋势"></div></div></article><article class="panel"><div class="panel-head"><div><h2>评价渠道分布</h2><p>覆盖线上与线下服务场景</p></div></div><div class="panel-body"><div id="channels" class="chart" role="img" aria-label="评价渠道数量分布"></div></div></article></section><section class="grid-two"><article class="panel"><div class="panel-head"><div><h2>选择适合您的评价方式</h2><p>入口不同，评价与整改记录统一保存</p></div></div><div class="panel-body"><div class="channel-list">${Object.entries(
      channel,
    )
      .map(
        ([k, v]) =>
          `<button class="channel" data-action="channel" data-channel="${k}">${icon(k)}<strong>${v}</strong><small>${{ web: "办结事项，一键评价", mobile: "手机访问，随时参与", onsite: "扫描回执，现场评价", sms: "查看邀请，便捷补评" }[k]}</small></button>`,
      )
      .join(
        "",
      )}</div></div></article><article class="panel"><div class="panel-head"><div><h2>一条差评的处理旅程</h2><p>核实有依据，整改有反馈</p></div></div><div class="panel-body"><div class="steps">${["提交评价", "核实整改", "反馈确认"].map((x, i) => `<div class="step ${i === 0 ? "current" : ""}"><b>0${i + 1}</b>${x}</div>`).join("")}</div><button class="btn ghost small" data-page="tickets">查看我的工单 ${icon("arrow")}</button></div></article></section>`;
  lineChart("trend", s.trend);
  donut("channels", s.channels);
}
async function casesView(token) {
  const { items } = await api("/cases");
  if (token !== generation) return;
  cache.cases = items;
  $("#main").innerHTML =
    heading(
      user.role === "citizen" ? "我的办件" : "办件管理",
      "从办件进入评价，服务对象和评价渠道清晰可见。",
      ["citizen", "window", "admin"].includes(user.role)
        ? `<button class="btn primary" data-action="new-case">${icon("plus")}创建模拟办件</button>`
        : "",
    ) +
    `<div class="notice">模拟场景 A：线上办理与补评 · B：材料告知不清 · C：争议差评。创建后可实际完成评价、工单和问卷流程。</div><section class="panel"><div class="toolbar"><input id="case-search" placeholder="搜索事项名称或办件编号" aria-label="搜索办件"><select id="case-filter" aria-label="评价状态"><option value="all">全部办件</option><option value="pending">待评价</option><option value="done">已评价</option></select><span class="muted">共 ${items.length} 件</span></div><div id="case-table"></div></section>`;
  caseTable();
}
function caseTable() {
  const q = ($("#case-search")?.value || "").toLowerCase(),
    filter = $("#case-filter")?.value;
  const rows = cache.cases.filter(
    (c) =>
      (c.title + c.number).toLowerCase().includes(q) &&
      (filter === "pending"
        ? !c.evaluated
        : filter === "done"
          ? c.evaluated
          : true),
  );
  $("#case-table").innerHTML = rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>办件事项</th><th>办理部门</th><th>评价渠道</th><th>评价状态</th><th>操作</th></tr></thead><tbody>${rows.map((c) => `<tr><td><strong>${esc(c.title)}</strong><small>${esc(c.number)} · 场景 ${esc(c.scenario)} · 模拟</small></td><td>${esc(c.department)}<small>${esc(c.region)}</small></td><td>${channel[c.channel]}</td><td><span class="badge ${c.evaluated ? "green" : "amber"}">${c.evaluated ? "服务已评价" : "服务待评价"}</span></td><td>${user.role === "citizen" ? `<button class="btn primary small" data-action="evaluate" data-id="${c.id}">${c.evaluated ? "评价其他对象" : "去评价"}</button> ` : ""}${["citizen", "window", "admin"].includes(user.role) ? `<button class="btn small" data-action="invite" data-id="${c.id}">补评 / 扫码</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
    : empty("暂无符合条件的办件", "可以调整筛选，或创建一个模拟办件。");
}
async function evaluationsView(token) {
  const { items } = await api("/evaluations");
  if (token !== generation) return;
  cache.evaluations = items;
  $("#main").innerHTML =
    heading(
      "评价记录",
      "每一次表达都有记录，服务评价与系统可用性问卷分别保存。",
      isManager()
        ? '<a class="btn" href="/api/export/evaluations">导出记录</a>'
        : "",
    ) +
    `<section class="panel"><div class="toolbar"><input id="evaluation-search" aria-label="搜索评价" placeholder="搜索事项或评价内容"><select id="rating-filter" aria-label="满意度"><option value="all">全部满意度</option><option value="negative">仅差评</option><option value="positive">仅好评</option><option value="survey">待填问卷</option></select></div><div id="evaluation-list"></div></section>`;
  evaluationList();
}
function evaluationList() {
  const q = $("#evaluation-search").value,
    f = $("#rating-filter").value;
  const rows = cache.evaluations.filter(
    (e) =>
      (e.title + e.comment).includes(q) &&
      (f === "negative"
        ? e.rating <= 2
        : f === "positive"
          ? e.rating >= 4
          : f === "survey"
            ? !e.survey_id
            : true),
  );
  $("#evaluation-list").innerHTML = rows.length
    ? rows
        .map(
          (e) =>
            `<article class="list-item"><div style="display:flex;justify-content:space-between;gap:15px"><div><h3>${esc(e.title)} <span class="badge">${targets[e.target]}</span></h3><span class="stars" aria-label="${e.rating}星">${"★".repeat(e.rating)}${"☆".repeat(5 - e.rating)}</span> <small>${levels[e.rating - 1]}</small></div><small>${date(e.created_at)}</small></div><p style="margin-top:10px">${esc(e.comment || "未补充文字评价")}</p>${JSON.parse(
              e.tags,
            )
              .map((t) => `<span class="tag">${esc(t)}</span>`)
              .join(
                "",
              )}<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><small>${esc(e.department)} · ${channel[e.channel]} · ${e.anonymous ? "对外匿名" : "对外姓名脱敏"}</small><div>${e.ticket_id ? `<button class="btn ghost small" data-action="ticket" data-id="${e.ticket_id}">${badge(e.ticket_status)} 查看进度</button>` : ""}${user.role === "citizen" && !e.survey_id ? `<button class="btn small" data-action="survey" data-id="${e.id}">填写体验问卷</button>` : e.survey_id ? '<span class="badge green">问卷已完成</span>' : ""}</div></div></article>`,
        )
        .join("")
    : empty("暂无评价记录", "完成办件评价后，记录会出现在这里。");
}
async function ticketsView(token) {
  const { items } = await api("/tickets");
  if (token !== generation) return;
  cache.tickets = items;
  $("#main").innerHTML =
    heading(
      "整改工单",
      "从核实到反馈，保留每一个处理节点。",
      isManager()
        ? '<a class="btn" href="/api/export/tickets">导出工单</a>'
        : "",
    ) +
    `<section class="metrics">${metric("待受理", items.filter((t) => t.status === "pending").length, "件", "等待管理员派发", "ticket")}${metric("整改中", items.filter((t) => t.status === "rectifying").length, "件", "完善方案并实施整改", "case")}${metric("待群众确认", items.filter((t) => t.status === "feedback").length, "件", "核实说明或整改结果已送达", "comment")}${metric("已办结", items.filter((t) => t.status === "closed").length, "件", "已获评价人确认", "check")}</section><section class="panel"><div class="toolbar"><input id="ticket-search" aria-label="搜索工单" placeholder="搜索事项、部门或问题内容"><select id="ticket-filter" aria-label="工单状态"><option value="all">全部状态</option>${Object.entries(
      statuses,
    )
      .map(([k, v]) => `<option value="${k}">${v[0]}</option>`)
      .join(
        "",
      )}<option value="review">待受理或待核实</option><option value="processing">处理中且未反馈</option><option value="due-soon">24 小时内到期</option><option value="overdue">已超期</option></select></div><div id="ticket-table"></div></section>`;
  ticketTable();
}
function ticketTable() {
  const q = $("#ticket-search").value,
    f = $("#ticket-filter").value;
  const rows = cache.tickets.filter(
    (t) =>
      (t.title + t.comment + t.department).includes(q) &&
      (f === "all" ||
        (f === "review"
          ? ["pending", "dispatched"].includes(t.status)
          : f === "processing"
            ? !["closed", "feedback"].includes(t.status)
            : f === "due-soon"
              ? t.status !== "closed" &&
                new Date(t.due_at) - Date.now() >= 0 &&
                new Date(t.due_at) - Date.now() <= 86400000
              : f === "overdue"
                ? new Date(t.due_at) < new Date() && t.status !== "closed"
                : t.status === f)),
  );
  $("#ticket-table").innerHTML = rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>工单与事项</th><th>责任部门</th><th>核实结论</th><th>处理状态</th><th>实验处理期限</th><th>操作</th></tr></thead><tbody>${rows.map((t) => `<tr><td><strong>${esc(t.title)}</strong><small>GD-${String(t.id).padStart(5, "0")} · ${esc(t.comment.slice(0, 22))}</small></td><td>${esc(t.department)}<small>${esc(t.assignee || "尚未指定专员")}</small></td><td>${{ valid: "有效差评", invalid: "说明解释", unreviewed: "待核实" }[t.disposition]}</td><td><span class="badge ${statuses[t.status][1]}">${ticketStage(t)}</span></td><td>${date(t.due_at)}${new Date(t.due_at) < new Date() && t.status !== "closed" ? '<small style="color:#b35c55">已超期，需跟进</small>' : ""}</td><td><button class="btn small" data-action="ticket" data-id="${t.id}">查看 / 处理</button></td></tr>`).join("")}</tbody></table></div>`
    : empty("暂无符合条件的工单", "差评提交后将自动生成工单。");
}
async function rankingsView(token, query = "") {
  const s = await api("/public/stats" + query);
  if (token !== generation) return;
  $("#main").innerHTML =
    heading("好差评公开榜单", "评价与整改公开可见，统计口径清晰可查。") +
    `<section class="panel" style="margin-bottom:22px"><div class="toolbar"><label>区域 <select id="region-filter"><option value="">全部区域</option>${meta.departments.map((d) => `<option ${new URLSearchParams(query).get("region") === d.region ? "selected" : ""}>${esc(d.region)}</option>`).join("")}</select></label><label>开始 <input id="start-filter" type="date" value="${esc(new URLSearchParams(query).get("start") || "")}"></label><label>结束 <input id="end-filter" type="date" value="${esc(new URLSearchParams(query).get("end") || "")}"></label><button class="btn primary small" data-action="filter-rank">应用筛选</button><button class="btn ghost small" data-page="rankings">重置</button></div></section><section class="metrics">${metric("评价总量", s.total, "条", "当前筛选范围", "comment")}${metric("收到差评", s.negative, "条", "原始差评均保留", "ticket")}${metric("有效差评整改率", s.rectification_rate, "%", "无有效差评时显示 —", "check")}${metric("五级评价平均分", s.average_score, "/ 10", "课程分值：10 / 8 / 6 / 3 / 0", "chart")}</section><div class="notice">好评率 = 满意及非常满意 / 全部评价；整改率 = 已确认办结的有效差评 / 已核实有效差评。解释归档的无效差评不计作整改完成。当前包含 ${s.simulated} 条模拟评价。</div><section class="grid-equal"><article class="panel"><div class="panel-head"><h2>部门评价数量</h2></div><div class="panel-body"><div id="ranking-chart" class="chart"></div></div></article><article class="panel"><div class="panel-head"><h2>满意度分布</h2></div><div class="panel-body"><div id="rating-chart" class="chart"></div></div></article></section><article class="panel"><div class="panel-head"><div><h2>区域与部门排行</h2><p>按评价数量排序，不将小样本高分直接视为服务优劣结论</p></div></div><div class="table-wrap"><table><thead><tr><th>部门</th><th>区域</th><th>评价数</th><th>好评率</th><th>差评数</th><th>有效差评整改率</th></tr></thead><tbody>${s.departments.map((d, i) => `<tr><td><span class="numbered">${String(i + 1).padStart(2, "0")}</span><strong>${esc(d.name)}</strong></td><td>${esc(d.region)}</td><td>${d.total}</td><td>${fmt(d.positive_rate)}${d.positive_rate === null ? "" : "%"}</td><td>${d.negative}</td><td>${fmt(d.rectification_rate)}${d.rectification_rate === null ? "" : "%"}</td></tr>`).join("")}</tbody></table></div></article><article class="panel section-space"><div class="panel-head"><h2>最近评价</h2><span class="muted">对外展示不包含评价人身份信息</span></div>${s.recent.map((r) => `<div class="list-item"><h3>${esc(r.title)} <span class="stars">${"★".repeat(r.rating)}</span></h3><p>${esc(r.comment || "未补充文字")}</p><small>${esc(r.department)} · ${channel[r.channel]} · ${date(r.created_at)}</small></div>`).join("") || empty("暂无评价", "调整日期或区域后再试。")}</article>`;
  draw("ranking-chart", {
    tooltip: { trigger: "axis" },
    grid: { left: 145, right: 25, top: 10, bottom: 25 },
    xAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#f0f3f8" } },
      axisLabel: { color: "#8999af" },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: s.departments.map((x) => x.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: "#71839e" },
    },
    series: [
      {
        type: "bar",
        data: s.departments.map((x) => x.total),
        barWidth: 17,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  });
  draw("rating-chart", {
    tooltip: { trigger: "axis" },
    grid: { left: 30, right: 15, top: 15, bottom: 35 },
    xAxis: {
      type: "category",
      data: ["非常不满意", "不满意", "基本满意", "满意", "非常满意"],
      axisLabel: { fontSize: 10, color: "#8092aa", interval: 0 },
      axisLine: { lineStyle: { color: "#e5eaf3" } },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#f0f3f8" } },
    },
    series: [
      {
        type: "bar",
        data: s.ratings,
        barWidth: 25,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: "#77a8dd" },
      },
    ],
  });
}
async function analyticsView(token) {
  if (!isManager()) {
    $("#main").innerHTML =
      heading(
        "交互体验评估",
        "服务满意度、系统可用性和任务负荷是不同的评价维度。",
      ) +
      `<div class="notice">完成办件评价后，可自愿填写体验问卷。课程五题版与标准 SUS 十题版分别计算，NASA-TLX 用来描述完成任务时的负荷。</div><section class="panel"><div class="panel-body" style="padding-top:25px"><h2>从一次完整任务开始</h2><p class="muted">先尝试找到办件、提交评价、查看处理反馈，再填写问卷。暂不填写问卷不会影响已经提交的服务评价。</p><button class="btn primary" data-page="evaluations">前往评价记录填写问卷</button></div></section>`;
    return;
  }
  const a = await api("/analytics");
  if (token !== generation) return;
  $("#main").innerHTML =
    heading(
      "交互体验评估",
      "量化可用性与任务负荷，为界面改进提供线索。",
      '<a class="btn" href="/api/export/surveys">导出问卷数据</a>',
    ) +
    `<div class="notice warning">${a.total} 份问卷中，${a.simulated} 份关联模拟办件。预置问卷是教学模拟数据，不能解释为真实群众调查或因果结论。课程五题版不套用标准 SUS 的行业分级。</div><section class="grid-equal"><article class="panel"><div class="panel-head"><div><h2>可用性与任务负荷</h2><p>同一版本内对比各满意度组</p></div></div><div class="panel-body"><div id="survey-chart" class="chart"></div></div></article><article class="panel"><div class="panel-head"><div><h2>NASA-TLX 六维度</h2><p>分值越高表示负荷越大，表现项已统一方向</p></div></div><div class="panel-body"><div id="tlx-chart" class="chart"></div></div></article></section><section class="panel"><div class="panel-head"><h2>分组统计</h2><span class="badge">Raw TLX · 六项均值</span></div><div class="table-wrap"><table><thead><tr><th>问卷版本</th><th>评价组</th><th>样本数</th><th>可用性均值</th><th>任务负荷均值</th></tr></thead><tbody>${a.summaries.map((s) => `<tr><td>${s.instrument === "course5" ? "课程改编五题" : "标准 SUS 十题"}</td><td>${s.group}</td><td>${s.n}</td><td>${s.usability}</td><td>${s.workload}</td></tr>`).join("")}</tbody></table></div></section><section class="panel section-space"><div class="panel-head"><h2>如何理解这些分数</h2></div><div class="panel-body"><p class="muted">课程五题均为正向陈述，计分为（五题原始总和 − 5）× 5。标准 SUS 十题按奇数题减 1、偶数题用 5 减去原始值，合计乘 2.5。Raw TLX 为六个 0–100 分量表的算术平均。</p><p class="muted">好评组为 4–5 星，差评组为 1–2 星，3 星单独报告。分析应结合任务是否完成、错误和访谈内容；不能用服务满意度代替网站可用性。</p></div></section>`;
  const x = a.summaries.filter((s) => s.instrument === "course5");
  draw("survey-chart", {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: "#8291a7" } },
    grid: { left: 35, right: 20, top: 15, bottom: 55 },
    xAxis: {
      type: "category",
      data: x.map((s) => s.group),
      axisLine: { lineStyle: { color: "#e5eaf3" } },
    },
    yAxis: {
      type: "value",
      max: 100,
      splitLine: { lineStyle: { color: "#f0f3f8" } },
    },
    series: [
      {
        name: "课程可用性分",
        type: "bar",
        data: x.map((s) => s.usability),
        barMaxWidth: 22,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: "Raw TLX",
        type: "bar",
        data: x.map((s) => s.workload),
        barMaxWidth: 22,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  });
  draw("tlx-chart", {
    tooltip: {},
    legend: { bottom: 0, textStyle: { color: "#8291a7" } },
    radar: {
      indicator: dimensions.map((name) => ({ name, max: 100 })),
      radius: "60%",
      center: ["50%", "44%"],
      axisName: { fontSize: 10, color: "#7a8da8" },
      splitArea: { areaStyle: { color: ["#fff", "#f7f9fe"] } },
    },
    series: [
      {
        type: "radar",
        data: x.map((s) => ({
          name: s.group,
          value: s.tlx,
          areaStyle: { opacity: 0.08 },
          lineStyle: { width: 1.5 },
        })),
      },
    ],
  });
}
async function messagesView(token) {
  const { items } = await api("/messages");
  if (token !== generation) return;
  $("#main").innerHTML =
    heading(
      "模拟短信收件箱",
      "所有邀请仅在本平台展示，不会向真实手机发送短信。",
    ) +
    `<section class="panel">${items.map((m) => `<div class="list-item"><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p><small>${date(m.created_at)} · 有效期至 ${date(m.expires_at)}</small><div style="margin-top:12px"><button class="btn primary small" data-action="open-invite" data-token="${esc(m.token)}">打开补评邀请</button></div></div>`).join("") || empty("暂无补评邀请", "在我的办件中创建补评链接后，消息会出现在这里。")}</section>`;
}
async function guideView() {
  $("#main").innerHTML =
    heading("实验操作指南", "一个人也可以切换角色，完整走完三个教学场景。") +
    `<section class="grid-equal"><article class="panel"><div class="panel-head"><h2>三个实验场景</h2></div><div class="panel-body"><ol class="instructions"><li><b>场景 A · 线上评价</b><br>群众登录，创建线上模拟办件，提交评价；也可生成补评链接，从模拟收件箱完成补评。</li><li><b>场景 B · 差评整改</b><br>群众填写材料告知不清的差评；管理员派单；整改专员核实、保存方案、反馈；群众确认接受后办结。</li><li><b>场景 C · 争议核实</b><br>核对材料告知及服务过程，填写具体依据。确无服务问题时说明解释；群众不接受可退回重新核实。</li></ol></div></article><article class="panel"><div class="panel-head"><h2>演示账号与角色</h2></div><div class="panel-body"><p class="muted">以下为公开教学账号，统一密码 <b>Demo2026!</b>。请勿在此保存真实身份材料。注册可创建独立群众账号。</p><table><tbody>${Object.entries(
      {
        citizen: "群众",
        window: "窗口",
        admin: "管理员",
        rectifier: "天河区整改专员",
        rectifier2: "越秀区整改专员",
        rectifier3: "海珠区整改专员",
        rectifier4: "白云区整改专员",
        supervisor: "监督",
      },
    )
      .map(([u, r]) => `<tr><td>${r}</td><td>${u}</td></tr>`)
      .join(
        "",
      )}</tbody></table></div></article></section><article class="panel"><div class="panel-head"><h2>评价规则与数据说明</h2></div><div class="panel-body"><ol class="instructions"><li>同一办件的同一评价对象只能提交一次，重复提交不会生成重复工单。指南、窗口与办件服务可分别评价。</li><li>不满意及非常不满意自动创建工单。派发、核实、反馈和群众确认按状态流转，并保留完整操作记录。</li><li>实验默认处理期限为 5 个自然日，仅用于演示，并非对任何真实部门期限的承诺。无有效差评时，整改率显示“—”。</li><li>对外匿名仅影响公开展示，系统仍关联评价人账号，以支持查询和处理反馈。公开榜单不展示姓名、账号、联系方式。</li><li>问卷可稍后填写。五题版为课程改编，不能视作经过验证的标准短版 SUS。预置问卷为模拟数据。</li><li>扫码请在同一局域网中访问本机的局域网地址生成二维码；localhost 生成的二维码仅对本机有效。</li></ol></div></article>`;
}
function loginDialog(register = false) {
  modal(
    register ? "创建群众账号" : "欢迎使用实验平台",
    register
      ? "注册后拥有独立的办件和评价记录"
      : "选择演示角色，或使用自己的账号登录",
    `<form id="login-form" data-register="${register}">${
      !register
        ? `<div class="login-tabs">${Object.entries({
            citizen: "群众",
            window: "窗口",
            admin: "管理",
            rectifier: "整改",
            supervisor: "监督",
          })
            .map(
              ([u, t]) =>
                `<button type="button" class="btn small" data-action="fill-account" data-user="${u}">${t}</button>`,
            )
            .join("")}</div>`
        : ""
    }<label class="field">账号<input name="username" autocomplete="username" required ${register ? 'minlength="3"' : 'value="citizen"'}></label>${register ? '<label class="field">显示姓名<input name="name" required maxlength="30" autocomplete="name"></label>' : ""}<label class="field">密码<input type="password" name="password" autocomplete="${register ? "new-password" : "current-password"}" required minlength="8" ${register ? "" : 'value="Demo2026!"'}></label><p class="inline-error" role="alert"></p><button class="btn primary full" type="submit">${register ? "注册" : "登录"}</button><div style="text-align:center;margin-top:15px"><button type="button" class="btn ghost small" data-action="${register ? "login" : "register"}">${register ? "返回登录" : "创建独立群众账号"}</button></div>${!register ? '<p class="muted" style="font-size:11px;text-align:center;margin:15px 0 0">演示账号仅供课程模拟 · 密码 Demo2026!</p>' : ""}</form>`,
    true,
  );
}
async function evaluationDialog(cid, preferred) {
  cache.cases = (await api("/cases")).items;
  const c = cache.cases.find((x) => x.id === Number(cid));
  if (!c) throw Error("办件不存在或不属于当前账号");
  const completed = (c.evaluated_targets || "").split(",");
  const available = Object.keys(targets).filter((t) => !completed.includes(t));
  if (!available.length) {
    toast("该办件的三个对象均已评价，可在评价记录中查看。");
    return;
  }
  const selected = available.includes("service") ? "service" : available[0];
  const source = preferred || c.channel;
  modal(
    "评价办理体验",
    "选择满意度，再补充影响体验的原因。",
    `<form id="evaluation-form" data-id="${c.id}">
    <div class="evaluation-context"><span class="eyebrow">本次服务</span><h3>${esc(c.title)}</h3><p>${esc(c.department)} · ${esc(c.number)}</p><span class="badge">${channel[source]} · 已自动带入</span><input type="hidden" name="channel" value="${esc(source)}"></div>
    <fieldset class="target-picker"><legend>1. 您要评价什么？</legend>${Object.entries(
      targets,
    )
      .map(
        ([key, label]) =>
          `<label class="target-option ${completed.includes(key) ? "completed" : ""}"><input type="radio" name="target" value="${key}" ${key === selected ? "checked" : ""} ${completed.includes(key) ? "disabled" : ""}><span>${label}<small>${completed.includes(key) ? "已评价" : { service: "本次办理整体体验", guide: "材料清单与办事说明", window: "窗口接待与服务态度" }[key]}</small></span></label>`,
      )
      .join("")}</fieldset>
    <fieldset class="satisfaction-picker"><legend>2. 您的满意程度是？</legend><div class="rating-options">${[5, 4, 3, 2, 1].map((n) => `<label class="rating-option"><input type="radio" name="rating" value="${n}" required><span class="rating-number">${n}<span style="font-size:12px"> ★</span></span>${levels[n - 1]}</label>`).join("")}</div></fieldset>
    <fieldset class="reason-picker"><legend>3. 哪些方面影响了您的体验？</legend><p class="muted" id="reason-help">选择满意度后显示相关原因，也可以直接补充文字。</p><div class="tags-select" id="evaluation-tags"></div></fieldset>
    <label class="field">补充意见 <span class="muted">选填；差评需有原因标签或具体说明</span><textarea name="comment" maxlength="1000" placeholder="例如：清单未说明需要原件，我为此往返两次。"></textarea></label>
    <label class="check"><input name="anonymous" type="checkbox" checked>对外匿名展示，仍可在个人中心查询处理进度</label><p class="inline-error" role="alert"></p><div class="dialog-footer"><button type="button" class="btn" data-action="close">暂不评价</button><button type="submit" class="btn primary">提交评价</button></div></form>`,
  );
  updateEvaluationReasons();
}
function updateEvaluationReasons() {
  const f = $("#evaluation-form");
  if (!f) return;
  const rating = Number(f.elements.rating.value),
    target = f.elements.target.value;
  const sets = {
    service: [
      ["办理高效", "流程清晰", "结果告知及时"],
      ["等待时间过长", "重复补交材料", "办理进度不清晰"],
    ],
    guide: [
      ["材料清单完整", "说明通俗易懂", "样本清晰可用"],
      ["材料告知不清", "材料样本缺失", "指南信息不准确"],
    ],
    window: [
      ["服务耐心", "解释充分", "一次告知清楚"],
      ["解释不充分", "排队时间过长", "服务态度生硬"],
    ],
  };
  const positive = sets[target][0],
    negative = sets[target][1];
  const options =
    rating >= 4
      ? [...positive, "其他"]
      : rating > 0 && rating <= 2
        ? [...negative, "其他"]
        : rating === 3
          ? [positive[0], ...negative, "其他"]
          : ["其他"];
  const selected = new Set(
    [...f.querySelectorAll('[name="tags"]:checked')].map((x) => x.value),
  );
  $("#evaluation-tags").innerHTML = options
    .map(
      (t) =>
        `<label><input name="tags" type="checkbox" value="${t}" ${selected.has(t) ? "checked" : ""}> ${t}</label>`,
    )
    .join("");
  $("#reason-help").textContent =
    rating > 0
      ? `正在评价${targets[target]} · 可多选。切换对象或满意度时，仅保留仍适用的标签，补充意见不会清空。`
      : "请先选择满意度；补充意见始终可填写。";
}
function evaluationReceipt(result, data) {
  modal(
    "评价已提交",
    "您的服务评价已经完成。",
    `<section class="receipt"><div class="receipt-icon">${icon("check")}</div><h3>谢谢，您的反馈已保存</h3><p>评价编号 <strong>PJ-${String(result.evaluation_id).padStart(5, "0")}</strong></p><p>${targets[data.target]} · ${levels[Number(data.rating) - 1]} · ${channel[data.channel]}</p></section>
  <div class="next-step"><span class="eyebrow">接下来</span><h3>${result.ticket_id ? "已创建处理工单 GD-" + String(result.ticket_id).padStart(5, "0") : "可随时查看本次评价"}</h3><p>${result.ticket_id ? "工作人员将受理、核实并反馈处理结果。反馈送达后，由您确认是否接受。" : "本次评价未触发差评工单。您的评价记录已保存，可返回查看。"}</p></div>
  <div class="optional-survey"><div><b>愿意再分享网站使用感受吗？</b><p>体验问卷为自愿填写，稍后填写或不填写都不影响评价和处理。</p></div><button class="btn small" data-action="survey" data-id="${result.evaluation_id}">自愿填写问卷</button></div>
  <div class="dialog-footer"><button class="btn" data-page="overview">返回工作台</button>${result.ticket_id ? `<button class="btn primary" data-action="ticket" data-id="${result.ticket_id}">查看处理进度</button>` : '<button class="btn primary" data-page="evaluations">查看评价记录</button>'}</div>`,
  );
}
function surveyDialog(eid, instrument = "course5") {
  surveyStart = performance.now();
  const qs = instrument === "sus10" ? susQuestions : courseQuestions;
  modal(
    "您的使用感受很重要",
    "评价已保存。问卷可稍后填写，不影响差评处理。",
    `<form id="survey-form" data-id="${eid}"><label class="field">问卷版本<select name="instrument" id="survey-version" data-id="${eid}"><option value="course5" ${instrument === "course5" ? "selected" : ""}>课程改编五题版</option><option value="sus10" ${instrument === "sus10" ? "selected" : ""}>标准 SUS 十题版</option></select></label><div class="notice">${instrument === "course5" ? "本问卷为课程改编版，使用原量表正向概念，不等同于标准 SUS，不使用行业基准分级。" : "标准 SUS：注意正反向陈述，按自己的真实体验选择。"}</div><h3>系统可用性</h3>${qs.map((q, i) => `<div class="likert"><p>${i + 1}. ${q}</p><div class="likert-options">${["非常不同意", "不同意", "中立", "同意", "非常同意"].map((t, n) => `<label><input type="radio" name="q${i}" value="${n + 1}" required>${t}</label>`).join("")}</div></div>`).join("")}<h3 style="margin-top:24px">NASA-TLX 任务负荷</h3><p class="muted">对刚刚完成的操作任务评分，不评价整个政务办理过程。0 为最低负荷，100 为最高负荷。</p>${dimensions.map((t, i) => `<div class="tlx-row"><label for="tlx${i}">${t}<output id="out${i}">未评分</output></label><input id="tlx${i}" name="t${i}" type="range" min="0" max="100" step="5" value="50" data-tlx="${i}"><small><span>${i === 3 ? "完美完成" : "非常低"}</span><span>${i === 3 ? "完全失败" : "非常高"}</span></small><label class="check"><input type="checkbox" name="confirmed${i}" required>已确认本项评分</label></div>`).join("")}<p class="inline-error" role="alert"></p><div class="dialog-footer"><button type="button" class="btn" data-action="close">稍后填写</button><button class="btn primary" type="submit">提交问卷</button></div></form>`,
  );
}
async function ticketDialog(tid) {
  const { ticket: t, events } = await api("/tickets/" + tid);
  cache.ticket = t;
  const manager = isManager(),
    staff =
      manager ||
      (user.role === "rectifier" && user.department_id === t.department_id);
  let actions = "";
  if (manager && t.status === "pending")
    actions = `<label class="field">整改专员<select name="assignee_id">${meta.staff
      .filter((s) => s.department_id === t.department_id)
      .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
      .join(
        "",
      )}</select></label><button class="btn primary" name="action" value="dispatch">派发工单</button>`;
  if (staff && t.status === "dispatched")
    actions =
      '<button class="btn primary" name="action" value="valid">确认有效 · 进入整改</button> <button class="btn" name="action" value="invalid">说明解释 · 反馈群众</button>';
  if (staff && t.status === "rectifying")
    actions =
      '<button class="btn" name="action" value="plan">保存整改方案</button> <button class="btn primary" name="action" value="feedback">提交整改反馈</button>';
  if (
    user.role === "citizen" &&
    t.user_id === user.id &&
    t.status === "feedback"
  )
    actions =
      '<button class="btn primary" name="action" value="accept">接受结果 · 确认办结</button> <button class="btn" name="action" value="reopen">不接受 · 退回处理</button>';
  if (manager && t.status !== "closed")
    actions +=
      ' <button class="btn ghost" name="action" value="remind">发起催办</button>';
  modal(
    "工单 GD-" + String(t.id).padStart(5, "0"),
    esc(t.title),
    `${ticketProgress(t)}<span class="tag">${targets[t.target]}</span><div class="detail-grid"><div><small>责任部门 / 整改专员</small>${esc(t.department)} / ${esc(t.assignee || (t.status === "pending" ? "待派发" : "由责任部门跟进"))}</div><div><small>实验处理期限</small>${date(t.due_at)}</div></div><div class="notice">${esc(t.comment || "群众未补充文字，请结合原因标签核实。")}</div><div class="ticket-columns"><div><h3>处理记录</h3><div class="timeline">${events.map((e) => `<div class="timeline-item"><b style="font-size:12px">${esc(e.actor || "系统")} · ${esc(ticketActionTitle(e))}</b><p>${esc(e.detail)}</p><small>${date(e.created_at)}</small></div>`).join("")}</div></div><div><h3>核实与反馈</h3>${
      [
        ["核实依据", t.evidence],
        ["整改方案", t.plan],
        ["处理反馈", t.feedback],
        ["群众意见", t.citizen_response],
      ]
        .filter((x) => x[1])
        .map(
          ([title, v]) =>
            `<div class="list-item" style="padding:12px 0"><b style="font-size:12px">${title}</b><p>${esc(v)}</p></div>`,
        )
        .join("") || '<p class="muted">暂未形成核实结论</p>'
    }</div></div>${actions ? `<form id="ticket-form" data-id="${t.id}" data-version="${t.version}"><label class="field">本次处理说明<textarea name="detail" maxlength="2000" placeholder="填写核实依据、整改方案、反馈结果或退回原因。请勿仅凭‘材料不全’认定差评无效。"></textarea></label><p class="inline-error" role="alert"></p><div class="dialog-footer" style="flex-wrap:wrap">${actions}</div></form>` : '<div class="dialog-footer"><button class="btn" data-action="close">关闭</button></div>'}`,
  );
}
function newCaseDialog() {
  modal(
    "创建模拟办件",
    "创建新的教学案例，原有记录会保留。",
    `<form id="case-form"><label class="field">实验场景<select name="scenario"><option value="A">A · 线上办理顺畅</option><option value="B">B · 材料告知不清</option><option value="C">C · 材料不全引发争议</option></select></label><label class="field">办理部门<select name="department_id">${meta.departments.map((d) => `<option value="${d.id}">${esc(d.region + " · " + d.name)}</option>`).join("")}</select></label><label class="field">办理渠道<select name="channel">${Object.entries(
      channel,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select></label><p class="inline-error" role="alert"></p><div class="dialog-footer"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">创建办件</button></div></form>`,
    true,
  );
}
async function inviteDialog(cid) {
  const d = await api("/messages", "POST", { case_id: Number(cid) });
  const url =
    location.origin + "/?invite=" + encodeURIComponent(d.token) + "#cases";
  modal(
    "补评链接与现场扫码",
    "教学模拟消息已保存到对应群众账号的收件箱。",
    `<div class="notice">手机需与本机连接同一局域网。请用本机局域网地址打开网站后生成二维码；localhost 地址不能在其他设备访问。</div><div style="text-align:center"><div id="qrcode" class="qr-box"></div></div><label class="field">补评链接<input id="invite-url" value="${esc(url)}" readonly></label><p class="muted">链接有效期 7 天，打开后需登录对应办件的群众账号。二维码不发送真实短信。</p><div class="dialog-footer"><button class="btn" data-action="copy-invite">复制链接</button><button class="btn primary" data-action="close">完成</button></div>`,
  );
  if (window.QRCode)
    new QRCode($("#qrcode"), {
      text: url,
      width: 185,
      height: 185,
      correctLevel: QRCode.CorrectLevel.M,
    });
}
document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-action],[data-page]");
  if (!el) return;
  try {
    if (el.dataset.action === "task-route") {
      await render(el.dataset.destination);
      const input = $("#" + el.dataset.filterId);
      if (input) {
        input.value = el.dataset.filter;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
    if (el.dataset.page) {
      $("#dialog").close();
      await render(el.dataset.page);
      return;
    }
    const a = el.dataset.action;
    if (a === "close") $("#dialog").close();
    else if (a === "login") loginDialog();
    else if (a === "register") loginDialog(true);
    else if (a === "fill-account") {
      const f = $("#login-form");
      f.elements.username.value = el.dataset.user;
      f.elements.password.value = "Demo2026!";
    } else if (a === "logout") {
      await api("/logout", "POST", {});
      user = null;
      cache = {};
      const s = await api("/session");
      csrf = s.csrf;
      await render("overview");
      toast("已退出登录");
    } else if (a === "start") {
      if (!user) loginDialog();
      else await render("cases");
    } else if (a === "channel") {
      if (!user) loginDialog();
      else if (el.dataset.channel === "sms") await render("messages");
      else {
        await render("cases");
        toast("从办件进入评价，系统会自动带入办件渠道。");
      }
    } else if (a === "new-case") newCaseDialog();
    else if (a === "evaluate") await evaluationDialog(el.dataset.id);
    else if (a === "ticket") await ticketDialog(el.dataset.id);
    else if (a === "survey") surveyDialog(el.dataset.id);
    else if (a === "invite") await inviteDialog(el.dataset.id);
    else if (a === "retry") await render();
    else if (a === "open-invite") {
      const d = await api("/invite/" + el.dataset.token);
      await evaluationDialog(d.case_id, "sms");
    } else if (a === "copy-invite") {
      const input = $("#invite-url");
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        toast("链接已复制");
      } catch {
        toast("链接已选中，请按 Ctrl+C 复制");
      }
    } else if (a === "filter-rank") {
      const params = new URLSearchParams();
      for (const k of ["region", "start", "end"])
        if ($("#" + k + "-filter").value)
          params.set(k, $("#" + k + "-filter").value);
      charts.forEach((c) => c.dispose());
      charts = [];
      await rankingsView(generation, "?" + params);
    }
  } catch (e) {
    toast(e.message);
  }
});
document.addEventListener("input", (ev) => {
  if (ev.target.id === "case-search") caseTable();
  if (ev.target.id === "ticket-search") ticketTable();
  if (ev.target.id === "evaluation-search") evaluationList();
  if (ev.target.dataset.tlx !== undefined)
    $("#out" + ev.target.dataset.tlx).textContent = ev.target.value + " / 100";
});
document.addEventListener("change", (ev) => {
  if (
    ev.target.closest("#evaluation-form") &&
    ["rating", "target"].includes(ev.target.name)
  )
    updateEvaluationReasons();
  if (ev.target.id === "case-filter") caseTable();
  if (ev.target.id === "ticket-filter") ticketTable();
  if (ev.target.id === "rating-filter") evaluationList();
  if (ev.target.id === "survey-version")
    surveyDialog(ev.target.dataset.id, ev.target.value);
});
document.addEventListener("submit", async (ev) => {
  const f = ev.target;
  if (
    ![
      "login-form",
      "case-form",
      "evaluation-form",
      "survey-form",
      "ticket-form",
    ].includes(f.id)
  )
    return;
  ev.preventDefault();
  const fd = new FormData(f),
    button = ev.submitter,
    action = button?.value;
  if (button) button.disabled = true;
  const data = Object.fromEntries(fd);
  try {
    if (f.id === "login-form") {
      if (f.dataset.register === "true") {
        await api("/register", "POST", data);
        toast("账号创建成功，请登录");
        loginDialog();
        return;
      }
      const d = await api("/login", "POST", data);
      user = d.user;
      csrf = d.csrf;
      cache = {};
      $("#dialog").close();
      await render(page);
      toast("欢迎，" + user.name);
      await handleInvite();
    } else if (f.id === "case-form") {
      await api("/cases", "POST", {
        ...data,
        department_id: Number(data.department_id),
      });
      $("#dialog").close();
      await render("cases");
      toast("模拟办件已创建，可以开始评价");
    } else if (f.id === "evaluation-form") {
      const r = await api("/evaluations", "POST", {
        case_id: Number(f.dataset.id),
        target: data.target,
        rating: Number(data.rating),
        tags: fd.getAll("tags"),
        comment: data.comment,
        channel: data.channel,
        anonymous: fd.has("anonymous"),
      });
      $("#dialog").close();
      cache.cases = null;
      await render("evaluations");
      toast(
        r.ticket_id ? "评价已保存，差评工单已创建" : "评价已保存，感谢您的反馈",
      );
      evaluationReceipt(r, data);
    } else if (f.id === "survey-form") {
      const n = data.instrument === "course5" ? 5 : 10;
      const r = await api("/surveys", "POST", {
        evaluation_id: Number(f.dataset.id),
        instrument: data.instrument,
        answers: Array.from({ length: n }, (_, i) => Number(data["q" + i])),
        tlx: Array.from({ length: 6 }, (_, i) => Number(data["t" + i])),
        task_seconds: 0,
      });
      $("#dialog").close();
      await render("evaluations");
      toast(
        `问卷已保存 · 可用性 ${r.usability_score} · Raw TLX ${r.workload_score}`,
      );
    } else if (f.id === "ticket-form") {
      await api("/tickets/" + f.dataset.id + "/actions", "POST", {
        action,
        detail: data.detail,
        assignee_id: Number(data.assignee_id),
        version: Number(f.dataset.version),
      });
      await render("tickets");
      await ticketDialog(f.dataset.id);
      toast("处理记录已保存");
    }
  } catch (e) {
    errorInDialog(e);
  } finally {
    if (button && button.isConnected) button.disabled = false;
  }
});
window.addEventListener("resize", () => charts.forEach((c) => c.resize()));
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1) || "overview";
  if (next !== page) render(next);
});
async function handleInvite() {
  const token = new URLSearchParams(location.search).get("invite");
  if (token && user?.role === "citizen") {
    try {
      const d = await api("/invite/" + encodeURIComponent(token));
      await evaluationDialog(d.case_id, "sms");
      history.replaceState(null, "", location.pathname + location.hash);
    } catch (e) {
      toast(e.message);
    }
  }
}
try {
  const [s, m] = await Promise.all([api("/session"), api("/meta")]);
  user = s.user;
  csrf = s.csrf;
  meta = m;
  await render(location.hash.slice(1) || "overview");
  await handleInvite();
} catch (e) {
  $("#main").innerHTML = empty(
    "本地服务连接失败",
    esc(e.message),
    '<button class="btn" onclick="location.reload()">重试</button>',
  );
}

function ticketStage(t) {
  if (t.status === "feedback")
    return t.disposition === "invalid" ? "说明待确认" : "整改结果待确认";
  if (t.status === "closed")
    return t.disposition === "invalid" ? "解释已归档" : "整改已办结";
  return statuses[t.status]?.[0] || "处理中";
}
function ticketActionTitle(e) {
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
function ticketNext(t) {
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
      mine: isManager() || user.role === "rectifier",
    };
  if (t.status === "rectifying")
    return {
      owner: staff,
      title: t.plan ? "正在落实整改方案" : "正在制定整改方案",
      detail: t.plan
        ? "整改完成后将提交结果，等待评价人确认。"
        : "保存具体方案并落实后，再提交整改结果。",
      mine: isManager() || user.role === "rectifier",
    };
  if (t.status === "feedback")
    return {
      owner: "评价人",
      title: t.disposition === "invalid" ? "请阅读核实说明" : "请查看整改结果",
      detail: "您可以接受结果，也可以说明不接受的原因并退回处理。",
      mine: user.role === "citizen" && user.id === t.user_id,
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
function ticketProgress(t) {
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
function taskCard(
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
async function dashboard(token) {
  const [c, t, e] = await Promise.all([
    api("/cases"),
    api("/tickets"),
    api("/evaluations"),
  ]);
  if (token !== generation) return;
  cache.cases = c.items;
  const tickets = t.items,
    citizen = user.role === "citizen";
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
      citizen ? "我的服务工作台" : roles[user.role] + "工作台",
      citizen
        ? "先完成眼前的待办，再查看每一次反馈的进展。"
        : "按权限展示当前待办，让核实与反馈有序推进。",
      `<button class="btn" data-page="public">${icon("chart")}服务总览</button>`,
    ) +
    `<div class="welcome-strip"><span class="avatar">${esc(user.name[0])}</span><div><b>${esc(user.name)}，您好</b><p>${citizen ? "您的评价、处理进度和确认事项集中在这里。" : user.role === "window" ? "您可查看本部门进展，核实与整改由有权限的专员处理。" : "以下仅包含您有权查看的工单。"}</p></div><span class="badge">${roles[user.role]}</span></div><section class="task-grid">${cards}</section>
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
