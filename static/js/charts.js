import { appState } from './state.js';
import { channel, empty } from './ui.js';

export function draw(id, option) {
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
  appState.charts.push(c);
}

export function lineChart(id, trend) {
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

export function donut(id, channels) {
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
