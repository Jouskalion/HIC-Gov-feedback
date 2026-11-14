import { $, channel, date, dimensions, empty, esc, fmt, heading, icon, isManager, metric } from './ui.js';
import { appState } from './state.js';
import { api } from './api.js';
import { donut, draw, lineChart } from './charts.js';
import { dashboard } from './dashboard.js';

export async function overview(token) {
  if (appState.user && appState.page !== "public") return dashboard(token);
  const s = await api("/public/stats");
  if (token !== appState.generation) return;
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

export async function rankingsView(token, query = "") {
  const s = await api("/public/stats" + query);
  if (token !== appState.generation) return;
  $("#main").innerHTML =
    heading("好差评公开榜单", "评价与整改公开可见，统计口径清晰可查。") +
    `<section class="panel" style="margin-bottom:22px"><div class="toolbar"><label>区域 <select id="region-filter"><option value="">全部区域</option>${appState.meta.departments.map((d) => `<option ${new URLSearchParams(query).get("region") === d.region ? "selected" : ""}>${esc(d.region)}</option>`).join("")}</select></label><label>开始 <input id="start-filter" type="date" value="${esc(new URLSearchParams(query).get("start") || "")}"></label><label>结束 <input id="end-filter" type="date" value="${esc(new URLSearchParams(query).get("end") || "")}"></label><button class="btn primary small" data-action="filter-rank">应用筛选</button><button class="btn ghost small" data-page="rankings">重置</button></div></section><section class="metrics">${metric("评价总量", s.total, "条", "当前筛选范围", "comment")}${metric("收到差评", s.negative, "条", "原始差评均保留", "ticket")}${metric("有效差评整改率", s.rectification_rate, "%", "无有效差评时显示 —", "check")}${metric("五级评价平均分", s.average_score, "/ 10", "课程分值：10 / 8 / 6 / 3 / 0", "chart")}</section><div class="notice">好评率 = 满意及非常满意 / 全部评价；整改率 = 已确认办结的有效差评 / 已核实有效差评。解释归档的无效差评不计作整改完成。当前包含 ${s.simulated} 条模拟评价。</div><section class="grid-equal"><article class="panel"><div class="panel-head"><h2>部门评价数量</h2></div><div class="panel-body"><div id="ranking-chart" class="chart"></div></div></article><article class="panel"><div class="panel-head"><h2>满意度分布</h2></div><div class="panel-body"><div id="rating-chart" class="chart"></div></div></article></section><article class="panel"><div class="panel-head"><div><h2>区域与部门排行</h2><p>按评价数量排序，不将小样本高分直接视为服务优劣结论</p></div></div><div class="table-wrap"><table><thead><tr><th>部门</th><th>区域</th><th>评价数</th><th>好评率</th><th>差评数</th><th>有效差评整改率</th></tr></thead><tbody>${s.departments.map((d, i) => `<tr><td><span class="numbered">${String(i + 1).padStart(2, "0")}</span><strong>${esc(d.name)}</strong></td><td>${esc(d.region)}</td><td>${d.total}</td><td>${fmt(d.positive_rate)}${d.positive_rate === null ? "" : "%"}</td><td>${d.negative}</td><td>${fmt(d.rectification_rate)}${d.rectification_rate === null ? "" : "%"}</td></tr>`).join("")}</tbody></table></div></article><article class="panel section-space"><div class="panel-head"><h2>最近评价</h2><span class="muted">对外展示不包含评价人身份信息</span></div>${s.recent.map((r) => `<div class="list-item"><h3>${esc(r.title)} <span class="stars">${"★".repeat(r.rating)}</span></h3><p>${esc(r.comment || "未补充文字")}</p><small>${esc(r.department)} · ${channel[r.channel]} · ${date(r.created_at)}</small></div>`).join("") || empty("暂无评价", "调整日期或区域后再试。")}</article>`;
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

export async function analyticsView(token) {
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
  if (token !== appState.generation) return;
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
