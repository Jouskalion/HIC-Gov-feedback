import { appState } from './state.js';

export async function api(path, method = "GET", data) {
  let r;
  try {
    r = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": appState.csrf },
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
