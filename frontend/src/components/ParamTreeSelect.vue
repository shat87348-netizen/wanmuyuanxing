<template>
  <div class="param-tree-select" @click.stop>
    <div class="param-tree-input" @click="onInputClick">
      <span
        v-for="param in visibleTags"
        :key="param.value"
        class="selected-param-tag"
        :title="param.label"
      >
        <span class="selected-param-label">{{ param.label }}</span>
        <button type="button" aria-label="移除参数" @click.stop="removeParam(param.value)">×</button>
      </span>
      <span
        v-if="hiddenCount > 0"
        class="selected-param-more"
        :title="hiddenLabelList"
      >+{{ hiddenCount }}</span>
      <input
        ref="filterInputRef"
        v-model="filterText"
        class="param-tree-filter-input"
        :placeholder="selectedOptions.length === 0 ? placeholder : ''"
        @focus="open = true"
        @keydown.escape="open = false"
      />
      <span class="param-tree-arrow" @click.stop="onInputClick">⌄</span>
    </div>
    <div v-if="open" class="param-tree-panel">
      <div v-if="filteredTree.length === 0" class="param-tree-empty">
        {{ filterText ? '无匹配参数' : '暂无参数可选' }}
      </div>
      <div v-for="root in filteredTree" :key="root.key" class="param-tree-node root-node">
        <div class="param-tree-node-label">{{ root.label }}</div>
        <div v-for="group in root.children" :key="group.key" class="param-tree-node channel-node">
          <div class="param-tree-node-label">{{ group.label }}</div>
          <label v-for="param in group.children" :key="param.value" class="param-tree-leaf">
            <input
              type="checkbox"
              :checked="selectedValues.includes(param.value)"
              @change="toggleParam(param.value)"
            />
            <span>{{ param.label }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'

const props = defineProps({
  /** 数据数组；默认按 satelliteId/channel 分组，也支持 serverName/protocol 分组 */
  telemetryData: { type: Array, default: () => [] },
  /** v-model: 已选中的参数值数组 */
  modelValue: { type: Array, default: () => [] },
  /** 占位文本 */
  placeholder: { type: String, default: '选择参数' },
  /** 最大显示 tag 数；超出后用 +N 折叠，0 表示不限制 */
  maxTagCount: { type: Number, default: 0 },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const filterText = ref('')
const filterInputRef = ref(null)

const selectedValues = computed(() => props.modelValue || [])

const itemValue = (item) => item?.value || item?.telemetryCode || item?.paramCode || item?.paramName

const itemLabel = (item) => {
  if (!item) return ''
  if (item.optionLabel || item.label) return item.optionLabel || item.label
  const code = item.displayCode || item.sourceCode || item.telemetryCode || item.paramCode
  const name = item.paramName || item.name
  if (code && name && code !== name) return `${code} / ${name}`
  return code || name || itemValue(item)
}

const selectedOptions = computed(() =>
  selectedValues.value.map(value => {
    const found = props.telemetryData.find(
      d => itemValue(d) === value
    )
    if (found) {
      return { value, label: itemLabel(found) }
    }
    return { value, label: value }
  })
)

const visibleTags = computed(() => {
  if (!props.maxTagCount || props.maxTagCount <= 0) return selectedOptions.value
  return selectedOptions.value.slice(0, props.maxTagCount)
})

const hiddenCount = computed(() => {
  if (!props.maxTagCount || props.maxTagCount <= 0) return 0
  return Math.max(0, selectedOptions.value.length - props.maxTagCount)
})

const hiddenLabelList = computed(() =>
  selectedOptions.value.slice(props.maxTagCount).map(o => o.label).join(', ')
)

function addLeaf(rootMap, rootLabel, channelLabel, param) {
  if (!param.value) return
  const rootKey = rootLabel || '未标识设备'
  const channelKey = channelLabel || '默认协议'
  if (!rootMap.has(rootKey)) {
    rootMap.set(rootKey, { key: rootKey, label: rootKey, children: new Map() })
  }
  const root = rootMap.get(rootKey)
  if (!root.children.has(channelKey)) {
    root.children.set(channelKey, {
      key: `${rootKey}-${channelKey}`,
      label: channelKey,
      children: new Map(),
    })
  }
  const channel = root.children.get(channelKey)
  if (!channel.children.has(param.value)) {
    channel.children.set(param.value, param)
  }
}

const fullTree = computed(() => {
  const rootMap = new Map()
  props.telemetryData.forEach(item => {
    const value = itemValue(item)
    const rootLabel = item.serverName || item.satelliteId || item.host || item.sourceServer
    const groupLabel = item.protocol || item.channel || item.protocolType || '默认通道'
    addLeaf(rootMap, rootLabel, groupLabel, {
      value,
      label: itemLabel(item),
    })
  })
  return Array.from(rootMap.values())
    .map(root => ({
      key: root.key,
      label: root.label,
      children: Array.from(root.children.values())
        .map(channel => ({
          key: channel.key,
          label: channel.label,
          children: Array.from(channel.children.values()).sort((a, b) =>
            a.label.localeCompare(b.label, 'zh-CN')
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})

const filteredTree = computed(() => {
  const keyword = filterText.value.trim().toLowerCase()
  if (!keyword) return fullTree.value

  return fullTree.value
    .map(satellite => {
      const filteredChannels = satellite.children
        .map(channel => {
          const filteredParams = channel.children.filter(
            p =>
              p.label.toLowerCase().includes(keyword) ||
              (p.value || '').toLowerCase().includes(keyword)
          )
          return filteredParams.length > 0
            ? { ...channel, children: filteredParams }
            : null
        })
        .filter(Boolean)
      return filteredChannels.length > 0
        ? { ...satellite, children: filteredChannels }
        : null
    })
    .filter(Boolean)
})

function onInputClick() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => filterInputRef.value?.focus())
  }
}

function toggleParam(value) {
  if (!value) return
  const arr = [...selectedValues.value]
  const idx = arr.indexOf(value)
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else {
    arr.push(value)
  }
  emit('update:modelValue', arr)
}

function removeParam(value) {
  const arr = selectedValues.value.filter(v => v !== value)
  emit('update:modelValue', arr)
}

// 点击组件外部关闭面板
if (typeof document !== 'undefined') {
  document.addEventListener('click', () => {
    open.value = false
  })
}
</script>

<style scoped>
.param-tree-select {
  position: relative;
  min-width: 0;
}
.param-tree-input {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  min-height: 32px;
  padding: 4px 28px 4px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  cursor: pointer;
  font-size: 12px;
  overflow: hidden;
}
.param-tree-input:focus-within {
  outline: 2px solid color-mix(in srgb, var(--ui-primary) 45%, transparent);
  outline-offset: 1px;
}
.param-tree-filter-input {
  flex: 1 1 40px;
  min-width: 30px;
  width: 30px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ui-text);
  font-size: 12px;
  line-height: 20px;
  padding: 0;
}
.param-tree-filter-input::placeholder {
  color: var(--ui-text-muted);
}
.selected-param-tag {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 140px;
  gap: 4px;
  padding: 2px 6px;
  border-radius: calc(var(--ui-radius) + 2px);
  background: var(--ui-bg-accented);
  color: var(--ui-primary);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
}
.selected-param-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-param-tag button {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-primary) 16%, transparent);
  color: inherit;
  cursor: pointer;
  line-height: 1;
}
.selected-param-tag button:hover {
  background: color-mix(in srgb, var(--ui-primary) 28%, transparent);
}
.selected-param-more {
  display: inline-flex;
  align-items: center;
  flex: none;
  padding: 2px 8px;
  border-radius: calc(var(--ui-radius) + 2px);
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: help;
  white-space: nowrap;
}
.param-tree-arrow {
  position: absolute;
  right: 8px;
  top: 50%;
  color: var(--ui-text-muted);
  transform: translateY(-50%);
  font-size: 12px;
}
.param-tree-panel {
  position: absolute;
  z-index: 120;
  top: calc(100% + 6px);
  right: 0;
  width: min(420px, 80vw);
  max-height: 320px;
  overflow: auto;
  padding: 10px;
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.22),
    0 0 0 1px var(--ui-border);
}
.param-tree-empty {
  padding: 16px;
  color: var(--ui-text-muted);
  text-align: center;
}
.param-tree-node {
  display: grid;
  gap: 6px;
}
.root-node + .root-node {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--ui-border-muted);
}
.param-tree-node-label {
  color: var(--ui-text-highlighted);
  font-size: 13px;
  font-weight: 600;
}
.channel-node {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--ui-border-muted);
}
.channel-node > .param-tree-node-label {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 500;
}
.param-tree-leaf {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  margin-left: 12px;
  padding: 4px 6px;
  border-radius: var(--ui-radius);
  color: var(--ui-text);
  cursor: pointer;
}
.param-tree-leaf:hover {
  background: var(--ui-bg-muted);
}
.param-tree-leaf input {
  accent-color: var(--ui-primary);
}
</style>
