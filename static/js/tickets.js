import { $, date, empty, esc, heading, isManager, metric, modal, statuses, targets } from './ui.js';
import { appState } from './state.js';
import { api } from './api.js';
import { ticketActionTitle, ticketProgress, ticketStage } from './dashboard.js';

export async function ticketsView(token) {
  const { items } = await api("/tickets");
  if (token !== appState.generation) return;
  appState.cache.tickets = items;
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

export function ticketTable() {
  const q = $("#ticket-search").value,
    f = $("#ticket-filter").value;
  const rows = appState.cache.tickets.filter(
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

export async function ticketDialog(tid) {
  const { ticket: t, events } = await api("/tickets/" + tid);
  appState.cache.ticket = t;
  const manager = isManager(),
    staff =
      manager ||
      (appState.user.role === "rectifier" && appState.user.department_id === t.department_id);
  let actions = "";
  if (manager && t.status === "pending")
    actions = `<label class="field">整改专员<select name="assignee_id">${appState.meta.staff
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
    appState.user.role === "citizen" &&
    t.user_id === appState.user.id &&
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
