import { $, channel, empty, esc, heading, icon, modal } from './ui.js';
import { appState } from './state.js';
import { api } from './api.js';

export async function casesView(token) {
  const { items } = await api("/cases");
  if (token !== appState.generation) return;
  appState.cache.cases = items;
  $("#main").innerHTML =
    heading(
      appState.user.role === "citizen" ? "我的办件" : "办件管理",
      "从办件进入评价，服务对象和评价渠道清晰可见。",
      ["citizen", "window", "admin"].includes(appState.user.role)
        ? `<button class="btn primary" data-action="new-case">${icon("plus")}创建模拟办件</button>`
        : "",
    ) +
    `<div class="notice">模拟场景 A：线上办理与补评 · B：材料告知不清 · C：争议差评。创建后可实际完成评价、工单和问卷流程。</div><section class="panel"><div class="toolbar"><input id="case-search" placeholder="搜索事项名称或办件编号" aria-label="搜索办件"><select id="case-filter" aria-label="评价状态"><option value="all">全部办件</option><option value="pending">待评价</option><option value="done">已评价</option></select><span class="muted">共 ${items.length} 件</span></div><div id="case-table"></div></section>`;
  caseTable();
}

export function caseTable() {
  const q = ($("#case-search")?.value || "").toLowerCase(),
    filter = $("#case-filter")?.value;
  const rows = appState.cache.cases.filter(
    (c) =>
      (c.title + c.number).toLowerCase().includes(q) &&
      (filter === "pending"
        ? !c.evaluated
        : filter === "done"
          ? c.evaluated
          : true),
  );
  $("#case-table").innerHTML = rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>办件事项</th><th>办理部门</th><th>评价渠道</th><th>评价状态</th><th>操作</th></tr></thead><tbody>${rows.map((c) => `<tr><td><strong>${esc(c.title)}</strong><small>${esc(c.number)} · 场景 ${esc(c.scenario)} · 模拟</small></td><td>${esc(c.department)}<small>${esc(c.region)}</small></td><td>${channel[c.channel]}</td><td><span class="badge ${c.evaluated ? "green" : "amber"}">${c.evaluated ? "服务已评价" : "服务待评价"}</span></td><td>${appState.user.role === "citizen" ? `<button class="btn primary small" data-action="evaluate" data-id="${c.id}">${c.evaluated ? "评价其他对象" : "去评价"}</button> ` : ""}${["citizen", "window", "admin"].includes(appState.user.role) ? `<button class="btn small" data-action="invite" data-id="${c.id}">补评 / 扫码</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
    : empty("暂无符合条件的办件", "可以调整筛选，或创建一个模拟办件。");
}

export function newCaseDialog() {
  modal(
    "创建模拟办件",
    "创建新的教学案例，原有记录会保留。",
    `<form id="case-form"><label class="field">实验场景<select name="scenario"><option value="A">A · 线上办理顺畅</option><option value="B">B · 材料告知不清</option><option value="C">C · 材料不全引发争议</option></select></label><label class="field">办理部门<select name="department_id">${appState.meta.departments.map((d) => `<option value="${d.id}">${esc(d.region + " · " + d.name)}</option>`).join("")}</select></label><label class="field">办理渠道<select name="channel">${Object.entries(
      channel,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select></label><p class="inline-error" role="alert"></p><div class="dialog-footer"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">创建办件</button></div></form>`,
    true,
  );
}

export async function inviteDialog(cid) {
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
