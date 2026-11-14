import { $, date, empty, esc, heading, modal } from './ui.js';
import { appState } from './state.js';
import { api } from './api.js';

export async function messagesView(token) {
  const { items } = await api("/messages");
  if (token !== appState.generation) return;
  $("#main").innerHTML =
    heading(
      "模拟短信收件箱",
      "所有邀请仅在本平台展示，不会向真实手机发送短信。",
    ) +
    `<section class="panel">${items.map((m) => `<div class="list-item"><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p><small>${date(m.created_at)} · 有效期至 ${date(m.expires_at)}</small><div style="margin-top:12px"><button class="btn primary small" data-action="open-invite" data-token="${esc(m.token)}">打开补评邀请</button></div></div>`).join("") || empty("暂无补评邀请", "在我的办件中创建补评链接后，消息会出现在这里。")}</section>`;
}

export async function guideView() {
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

export function loginDialog(register = false) {
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
