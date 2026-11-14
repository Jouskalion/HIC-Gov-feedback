import { $, empty, errorInDialog, esc, toast } from './js/ui.js';
import { appState } from './js/state.js';
import { api } from './js/api.js';
import { handleInvite, render } from './js/navigation.js';
import { rankingsView } from './js/reports.js';
import { loginDialog } from './js/account.js';
import { evaluationDialog, evaluationList, evaluationReceipt, surveyDialog, updateEvaluationReasons } from './js/evaluations.js';
import { ticketDialog, ticketTable } from './js/tickets.js';
import { caseTable, inviteDialog, newCaseDialog } from './js/cases.js';

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
      appState.user = null;
      appState.cache = {};
      const s = await api("/session");
      appState.csrf = s.csrf;
      await render("overview");
      toast("已退出登录");
    } else if (a === "start") {
      if (!appState.user) loginDialog();
      else await render("cases");
    } else if (a === "channel") {
      if (!appState.user) loginDialog();
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
      appState.charts.forEach((c) => c.dispose());
      appState.charts = [];
      await rankingsView(appState.generation, "?" + params);
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
      appState.user = d.user;
      appState.csrf = d.csrf;
      appState.cache = {};
      $("#dialog").close();
      await render(appState.page);
      toast("欢迎，" + appState.user.name);
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
      appState.cache.cases = null;
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

window.addEventListener("resize", () => appState.charts.forEach((c) => c.resize()));

window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1) || "overview";
  if (next !== appState.page) render(next);
});

try {
  const [s, m] = await Promise.all([api("/session"), api("/meta")]);
  appState.user = s.user;
  appState.csrf = s.csrf;
  appState.meta = m;
  await render(location.hash.slice(1) || "overview");
  await handleInvite();
} catch (e) {
  $("#main").innerHTML = empty(
    "本地服务连接失败",
    esc(e.message),
    '<button class="btn" onclick="location.reload()">重试</button>',
  );
}
