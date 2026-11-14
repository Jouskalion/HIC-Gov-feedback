import { $, badge, channel, courseQuestions, date, dimensions, empty, esc, heading, icon, isManager, levels, modal, susQuestions, targets, toast } from './ui.js';
import { appState } from './state.js';
import { api } from './api.js';

export async function evaluationsView(token) {
  const { items } = await api("/evaluations");
  if (token !== appState.generation) return;
  appState.cache.evaluations = items;
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

export function evaluationList() {
  const q = $("#evaluation-search").value,
    f = $("#rating-filter").value;
  const rows = appState.cache.evaluations.filter(
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
              )}<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><small>${esc(e.department)} · ${channel[e.channel]} · ${e.anonymous ? "对外匿名" : "对外姓名脱敏"}</small><div>${e.ticket_id ? `<button class="btn ghost small" data-action="ticket" data-id="${e.ticket_id}">${badge(e.ticket_status)} 查看进度</button>` : ""}${appState.user.role === "citizen" && !e.survey_id ? `<button class="btn small" data-action="survey" data-id="${e.id}">填写体验问卷</button>` : e.survey_id ? '<span class="badge green">问卷已完成</span>' : ""}</div></div></article>`,
        )
        .join("")
    : empty("暂无评价记录", "完成办件评价后，记录会出现在这里。");
}

export async function evaluationDialog(cid, preferred) {
  appState.cache.cases = (await api("/cases")).items;
  const c = appState.cache.cases.find((x) => x.id === Number(cid));
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

export function updateEvaluationReasons() {
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

export function evaluationReceipt(result, data) {
  modal(
    "评价已提交",
    "您的服务评价已经完成。",
    `<section class="receipt"><div class="receipt-icon">${icon("check")}</div><h3>谢谢，您的反馈已保存</h3><p>评价编号 <strong>PJ-${String(result.evaluation_id).padStart(5, "0")}</strong></p><p>${targets[data.target]} · ${levels[Number(data.rating) - 1]} · ${channel[data.channel]}</p></section>
  <div class="next-step"><span class="eyebrow">接下来</span><h3>${result.ticket_id ? "已创建处理工单 GD-" + String(result.ticket_id).padStart(5, "0") : "可随时查看本次评价"}</h3><p>${result.ticket_id ? "工作人员将受理、核实并反馈处理结果。反馈送达后，由您确认是否接受。" : "本次评价未触发差评工单。您的评价记录已保存，可返回查看。"}</p></div>
  <div class="optional-survey"><div><b>愿意再分享网站使用感受吗？</b><p>体验问卷为自愿填写，稍后填写或不填写都不影响评价和处理。</p></div><button class="btn small" data-action="survey" data-id="${result.evaluation_id}">自愿填写问卷</button></div>
  <div class="dialog-footer"><button class="btn" data-page="overview">返回工作台</button>${result.ticket_id ? `<button class="btn primary" data-action="ticket" data-id="${result.ticket_id}">查看处理进度</button>` : '<button class="btn primary" data-page="evaluations">查看评价记录</button>'}</div>`,
  );
}

export function surveyDialog(eid, instrument = "course5") {
  appState.surveyStart = performance.now();
  const qs = instrument === "sus10" ? susQuestions : courseQuestions;
  modal(
    "您的使用感受很重要",
    "评价已保存。问卷可稍后填写，不影响差评处理。",
    `<form id="survey-form" data-id="${eid}"><label class="field">问卷版本<select name="instrument" id="survey-version" data-id="${eid}"><option value="course5" ${instrument === "course5" ? "selected" : ""}>课程改编五题版</option><option value="sus10" ${instrument === "sus10" ? "selected" : ""}>标准 SUS 十题版</option></select></label><div class="notice">${instrument === "course5" ? "本问卷为课程改编版，使用原量表正向概念，不等同于标准 SUS，不使用行业基准分级。" : "标准 SUS：注意正反向陈述，按自己的真实体验选择。"}</div><h3>系统可用性</h3>${qs.map((q, i) => `<div class="likert"><p>${i + 1}. ${q}</p><div class="likert-options">${["非常不同意", "不同意", "中立", "同意", "非常同意"].map((t, n) => `<label><input type="radio" name="q${i}" value="${n + 1}" required>${t}</label>`).join("")}</div></div>`).join("")}<h3 style="margin-top:24px">NASA-TLX 任务负荷</h3><p class="muted">对刚刚完成的操作任务评分，不评价整个政务办理过程。0 为最低负荷，100 为最高负荷。</p>${dimensions.map((t, i) => `<div class="tlx-row"><label for="tlx${i}">${t}<output id="out${i}">未评分</output></label><input id="tlx${i}" name="t${i}" type="range" min="0" max="100" step="5" value="50" data-tlx="${i}"><small><span>${i === 3 ? "完美完成" : "非常低"}</span><span>${i === 3 ? "完全失败" : "非常高"}</span></small><label class="check"><input type="checkbox" name="confirmed${i}" required>已确认本项评分</label></div>`).join("")}<p class="inline-error" role="alert"></p><div class="dialog-footer"><button type="button" class="btn" data-action="close">稍后填写</button><button class="btn primary" type="submit">提交问卷</button></div></form>`,
  );
}
