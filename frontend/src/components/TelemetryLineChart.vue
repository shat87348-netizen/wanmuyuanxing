<template>
  <div ref="el" class="telemetry-line-chart"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  // [{ name, data: [[timestamp, value], ...], color }]
  series: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无数据' },
  colors: {
    type: Array,
    default: () => ['#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE', '#3BA272', '#FC8452', '#9A60B4']
  }
})

const el = ref(null)
let chart = null
let resizeObserver = null

const readThemeColors = () => {
  const rootStyle = getComputedStyle(document.documentElement)
  return {
    text: rootStyle.getPropertyValue('--ui-text-muted').trim() || '#9ca3af',
    border: rootStyle.getPropertyValue('--ui-border-muted').trim() || 'rgba(148, 163, 184, 0.25)'
  }
}

const formatDateTime = (value) => {
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const render = () => {
  if (!chart) return
  const theme = readThemeColors()
  const series = props.series.map((s, index) => {
    const color = s.color || props.colors[index % props.colors.length]
    return {
      name: s.name,
      type: 'line',
      smooth: false,
      showSymbol: false,
      data: s.data || [],
      lineStyle: { width: 2, color },
      itemStyle: { color }
    }
  })

  chart.setOption({
    color: props.colors,
    title: {
      text: series.some(s => s.data.length) ? '' : props.emptyText,
      left: 'center',
      top: 'middle',
      textStyle: { color: theme.text, fontSize: 14, fontWeight: 500 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        if (!params || params.length === 0) return ''
        const time = formatDateTime(params[0].value[0])
        const lines = params
          .map(p => `${p.marker}${p.seriesName}: ${typeof p.value[1] === 'number' ? p.value[1].toFixed(2) : p.value[1]}`)
          .join('<br/>')
        return `${time}<br/>${lines}`
      }
    },
    legend: { data: series.map(s => s.name), top: 0, textStyle: { color: theme.text } },
    grid: { left: 44, right: 22, top: 32, bottom: 32, containLabel: true },
    xAxis: {
      type: 'time',
      axisLabel: {
        color: theme.text,
        formatter: (value) => new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
      },
      axisLine: { lineStyle: { color: theme.border } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.text },
      axisLine: { lineStyle: { color: theme.border } },
      splitLine: { lineStyle: { color: theme.border } }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: false, filterMode: 'none' },
      { type: 'inside', yAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: false, filterMode: 'none' }
    ],
    series
  }, true)
}

onMounted(() => {
  chart = echarts.init(el.value)
  render()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(el.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})

watch(() => props.series, render, { deep: true })
</script>

<style scoped>
.telemetry-line-chart {
  width: 100%;
  height: 100%;
}
</style>
