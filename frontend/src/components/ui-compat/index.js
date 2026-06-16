import {
  Comment,
  Fragment,
  Text,
  computed,
  defineComponent,
  h,
  inject,
  provide,
  ref,
  resolveComponent
} from 'vue'

const RADIO_GROUP_KEY = Symbol('UiRadioGroup')

const flattenNodes = (nodes = []) => {
  return nodes.flatMap((node) => {
    if (Array.isArray(node)) return flattenNodes(node)
    if (node?.type === Fragment) return flattenNodes(node.children || [])
    return [node]
  })
}

const isRenderableNode = (node) => {
  if (!node || node.type === Comment) return false
  if (node.type === Text) return String(node.children || '').trim().length > 0
  if (Array.isArray(node.children)) return flattenNodes(node.children).some(isRenderableNode)
  return true
}

const getNodeText = (nodes = []) => {
  return flattenNodes(nodes).map((node) => {
    if (!node) return ''
    if (typeof node.children === 'string') return node.children
    if (Array.isArray(node.children)) return getNodeText(node.children)
    if (node.children?.default) return getNodeText(node.children.default())
    return ''
  }).join('').trim()
}

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

const currentValue = (props) => {
  return props.value !== undefined ? props.value : props.modelValue
}

const emitModel = (emit, value) => {
  emit('update:value', value)
  emit('update:modelValue', value)
  emit('change', value)
}

const colorMap = {
  default: 'neutral',
  red: 'error',
  orange: 'warning',
  yellow: 'warning',
  green: 'success',
  blue: 'info',
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  CRITICAL: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

const iconMap = {
  ApiOutlined: 'i-lucide-radio-tower',
  AreaChartOutlined: 'i-lucide-chart-area',
  BellOutlined: 'i-lucide-bell',
  BlockOutlined: 'i-lucide-blocks',
  CheckCircleOutlined: 'i-lucide-circle-check',
  ClockCircleOutlined: 'i-lucide-clock',
  CloseCircleOutlined: 'i-lucide-circle-x',
  CloudOutlined: 'i-lucide-cloud',
  DatabaseOutlined: 'i-lucide-database',
  DeleteOutlined: 'i-lucide-trash-2',
  EditOutlined: 'i-lucide-pencil',
  ExclamationCircleOutlined: 'i-lucide-circle-alert',
  FileTextOutlined: 'i-lucide-file-text',
  FilterOutlined: 'i-lucide-filter',
  GaugeOutlined: 'i-lucide-gauge',
  LineChartOutlined: 'i-lucide-chart-line',
  LockOutlined: 'i-lucide-lock',
  PauseCircleOutlined: 'i-lucide-circle-pause',
  PictureOutlined: 'i-lucide-image',
  PlayCircleOutlined: 'i-lucide-circle-play',
  RadarChartOutlined: 'i-lucide-radar',
  ReloadOutlined: 'i-lucide-rotate-cw',
  SafetyOutlined: 'i-lucide-shield-check',
  StopOutlined: 'i-lucide-square',
  SyncOutlined: 'i-lucide-refresh-cw',
  TeamOutlined: 'i-lucide-users',
  UserOutlined: 'i-lucide-user',
  WarningOutlined: 'i-lucide-triangle-alert'
}

const UiIconAlias = (iconName) => defineComponent({
  name: iconName,
  setup(_, { attrs }) {
    const cls = iconMap[iconName] || 'i-lucide-circle'
    return () => h('span', { ...attrs, class: [cls, attrs.class] })
  }
})

const UiButton = defineComponent({
  name: 'UiButton',
  inheritAttrs: false,
  props: {
    type: String,
    size: String,
    danger: Boolean,
    disabled: Boolean,
    loading: Boolean,
    block: Boolean
  },
  setup(props, { attrs, slots }) {
    return () => {
      const colorCls = props.danger ? 'ui-btn-error' : props.type === 'primary' ? 'ui-btn-primary' : props.type === 'link' ? 'ui-btn-link' : 'ui-btn-default'
      return h('button', {
        ...attrs,
        type: attrs.type || 'button',
        class: ['ui-button', colorCls, props.size === 'small' ? 'ui-btn-sm' : '', props.block ? 'ui-button-block' : '', attrs.class],
        disabled: props.disabled || props.loading
      }, [
        props.loading ? h('span', { class: 'i-lucide-loader-circle ui-spin' }) : null,
        slots.default?.()
      ])
    }
  }
})

const UiCard = defineComponent({
  name: 'UiCard',
  inheritAttrs: false,
  props: {
    title: String,
    size: String
  },
  setup(props, { attrs, slots }) {
    return () => h('div', {
      ...attrs,
      class: ['ui-card', attrs.class]
    }, [
      (props.title || slots.extra) ? h('div', { class: 'ui-card-header' }, [
        h('div', { class: 'ui-card-title' }, slots.title ? slots.title() : props.title),
        slots.extra ? h('div', { class: 'ui-card-extra' }, slots.extra()) : null
      ]) : null,
      h('div', { class: 'ui-card-body' }, slots.default?.())
    ])
  }
})

const UiRow = defineComponent({
  name: 'UiRow',
  inheritAttrs: false,
  props: {
    gutter: [Number, String, Array]
  },
  setup(props, { attrs, slots }) {
    return () => {
      const gutter = Array.isArray(props.gutter) ? props.gutter[0] : props.gutter
      return h('div', {
        ...attrs,
        class: ['ui-row', attrs.class],
        style: { '--ui-gutter': `${gutter || 16}px`, ...attrs.style }
      }, slots.default?.())
    }
  }
})

const UiCol = defineComponent({
  name: 'UiCol',
  inheritAttrs: false,
  props: {
    span: [Number, String],
    xs: [Number, String],
    sm: [Number, String],
    md: [Number, String],
    lg: [Number, String]
  },
  setup(props, { attrs, slots }) {
    return () => {
      const span = Number(props.lg || props.md || props.sm || props.xs || props.span || 24)
      return h('div', {
        ...attrs,
        class: ['ui-col', attrs.class],
        style: { '--ui-span': span, ...attrs.style }
      }, slots.default?.())
    }
  }
})

const UiStatistic = defineComponent({
  name: 'UiStatistic',
  props: {
    title: String,
    value: [String, Number],
    suffix: String,
    valueStyle: Object
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'ui-statistic' }, [
      h('div', { class: 'ui-statistic-title' }, props.title),
      h('div', { class: 'ui-statistic-value', style: props.valueStyle }, [
        slots.prefix ? h('span', { class: 'ui-statistic-prefix' }, slots.prefix()) : null,
        h('span', props.value ?? 0),
        props.suffix ? h('span', { class: 'ui-statistic-suffix' }, props.suffix) : null
      ])
    ])
  }
})

const UiTable = defineComponent({
  name: 'UiTable',
  inheritAttrs: false,
  props: {
    columns: Array,
    dataSource: Array,
    data: Array,
    loading: Boolean,
    rowKey: [String, Function],
    pagination: [Object, Boolean],
    locale: Object,
    rowClassName: [String, Function],
    customRow: Function
  },
  setup(props, { attrs, slots }) {
    const page = ref(1)
    const rowKeyValue = (record, index) => {
      if (typeof props.rowKey === 'function') return props.rowKey(record)
      if (props.rowKey && record?.[props.rowKey] !== undefined) return record[props.rowKey]
      if (record?.id !== undefined) return record.id
      if (record?.key !== undefined) return record.key
      return index
    }
    const renderBodyCell = (column, record, index) => {
      const fallback = record?.[column.dataIndex] ?? record?.[column.key] ?? ''
      if (!slots.bodyCell) return fallback
      const nodes = flattenNodes(slots.bodyCell({
        column,
        record,
        index,
        text: fallback
      }))
      return nodes.some(isRenderableNode) ? nodes : fallback
    }
    const columnStyle = (column) => {
      if (!column?.width) return undefined
      return { width: typeof column.width === 'number' ? `${column.width}px` : column.width }
    }
    const rowAttrs = (record, index) => {
      const custom = typeof props.customRow === 'function' ? props.customRow(record, index) || {} : {}
      const className = typeof props.rowClassName === 'function' ? props.rowClassName(record, index) : props.rowClassName
      return { ...custom, class: [custom.class, className] }
    }
    return () => {
      const columns = props.columns || []
      const rows = props.dataSource || props.data || []
      const pageSize = props.pagination && typeof props.pagination === 'object' ? Number(props.pagination.pageSize || rows.length) : rows.length
      const pageCount = pageSize > 0 ? Math.ceil(rows.length / pageSize) : 1
      const visibleRows = pageSize > 0 ? rows.slice((page.value - 1) * pageSize, page.value * pageSize) : rows
      return h('div', { ...attrs, class: ['ui-table-wrap', attrs.class] }, [
        props.loading ? h('div', { class: 'ui-table-loading' }, '加载中...') : null,
        h('table', { class: 'ui-table' }, [
          h('thead', [
            h('tr', columns.map(column => h('th', { key: column.key || column.dataIndex, style: columnStyle(column) }, column.title)))
          ]),
          h('tbody', visibleRows.length > 0
            ? visibleRows.map((record, index) => h('tr', { ...rowAttrs(record, index), key: rowKeyValue(record, index) }, columns.map(column => h('td', { key: column.key || column.dataIndex, style: columnStyle(column) }, renderBodyCell(column, record, index)))))
            : h('tr', [h('td', { colspan: Math.max(columns.length, 1), class: 'ui-table-empty' }, props.locale?.emptyText || '暂无数据')])
          )
        ]),
        props.pagination && pageCount > 1 ? h('div', { class: 'ui-pagination' }, [
          h('button', { type: 'button', disabled: page.value <= 1, onClick: () => { page.value -= 1 } }, '上一页'),
          h('span', `${page.value} / ${pageCount}`),
          h('button', { type: 'button', disabled: page.value >= pageCount, onClick: () => { page.value += 1 } }, '下一页')
        ]) : null
      ])
    }
  }
})

const UiTag = defineComponent({
  name: 'UiTag',
  inheritAttrs: false,
  props: {
    color: String,
    size: String
  },
  setup(props, { attrs, slots }) {
    return () => h('span', {
      ...attrs,
      class: ['ui-tag', `ui-tag-${colorMap[props.color] || props.color || 'neutral'}`, props.size === 'small' ? 'ui-tag-sm' : '', attrs.class]
    }, slots.default?.())
  }
})

const UiSelect = defineComponent({
  name: 'UiSelect',
  inheritAttrs: false,
  props: {
    modelValue: [String, Number, Array, Boolean],
    value: [String, Number, Array, Boolean],
    mode: String,
    placeholder: String,
    disabled: Boolean,
    allowClear: Boolean
  },
  emits: ['update:modelValue', 'update:value', 'change'],
  setup(props, { attrs, emit, slots }) {
    const selected = computed(() => currentValue(props))
    return () => h('select', {
      ...attrs,
      class: ['ui-field', 'ui-select', attrs.class],
      value: selected.value,
      multiple: props.mode === 'multiple',
      disabled: props.disabled,
      onChange: (event) => {
        const target = event.target
        const value = props.mode === 'multiple'
          ? Array.from(target.selectedOptions).map(option => option.value)
          : target.value
        emitModel(emit, value)
      }
    }, [
      props.placeholder && props.mode !== 'multiple' ? h('option', { value: '' }, props.placeholder) : null,
      props.allowClear && props.mode !== 'multiple' ? h('option', { value: '' }, '全部') : null,
      slots.default?.()
    ])
  }
})

const UiSelectOption = defineComponent({
  name: 'UiSelectOption',
  props: {
    value: [String, Number, Boolean]
  },
  setup(props, { slots }) {
    return () => {
      const content = slots.default?.() || []
      const value = props.value !== undefined ? props.value : getNodeText(content)
      return h('option', { value }, content)
    }
  }
})

const UiInput = defineComponent({
  name: 'UiInput',
  inheritAttrs: false,
  props: {
    modelValue: [String, Number],
    value: [String, Number],
    type: String,
    rows: [Number, String],
    readonly: Boolean
  },
  emits: ['update:modelValue', 'update:value', 'change'],
  setup(props, { attrs, emit }) {
    return () => {
      const tag = props.type === 'textarea' ? 'textarea' : 'input'
      return h(tag, {
        ...attrs,
        class: ['ui-field', attrs.class],
        type: tag === 'input' ? (props.type || 'text') : undefined,
        rows: props.rows,
        value: currentValue(props) ?? '',
        readonly: props.readonly,
        onInput: event => emitModel(emit, event.target.value),
        onChange: event => emit('change', event.target.value)
      })
    }
  }
})

const UiTextarea = defineComponent({
  name: 'UiTextarea',
  inheritAttrs: false,
  props: {
    modelValue: String,
    value: String,
    rows: [Number, String]
  },
  emits: ['update:modelValue', 'update:value', 'change'],
  setup(props, { attrs, emit }) {
    return () => h('textarea', {
      ...attrs,
      class: ['ui-field', attrs.class],
      rows: props.rows || 3,
      value: currentValue(props) ?? '',
      onInput: event => emitModel(emit, event.target.value),
      onChange: event => emit('change', event.target.value)
    })
  }
})

const UiInputNumber = defineComponent({
  name: 'UiInputNumber',
  inheritAttrs: false,
  props: {
    modelValue: Number,
    value: Number,
    min: Number,
    max: Number,
    step: Number,
    precision: Number
  },
  emits: ['update:modelValue', 'update:value', 'change'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      class: ['ui-field', attrs.class],
      type: 'number',
      value: currentValue(props) ?? '',
      min: props.min,
      max: props.max,
      step: props.step ?? (props.precision ? 1 / (10 ** props.precision) : undefined),
      onInput: event => emitModel(emit, event.target.value === '' ? null : Number(event.target.value)),
      onChange: event => emit('change', event.target.value === '' ? null : Number(event.target.value))
    })
  }
})

const UiSwitch = defineComponent({
  name: 'UiSwitch',
  props: {
    checked: Boolean,
    modelValue: Boolean,
    disabled: Boolean
  },
  emits: ['update:checked', 'update:modelValue', 'change'],
  setup(props, { emit }) {
    const active = computed(() => props.checked !== undefined ? props.checked : props.modelValue)
    const update = (checked) => {
      emit('update:checked', checked)
      emit('update:modelValue', checked)
      emit('change', checked)
    }
    return () => h('button', {
      type: 'button',
      role: 'switch',
      'aria-checked': active.value,
      disabled: props.disabled,
      class: ['ui-switch', active.value && 'active'],
      onClick: () => update(!active.value)
    }, h('span'))
  }
})

const UiSlider = defineComponent({
  name: 'UiSlider',
  inheritAttrs: false,
  props: {
    value: Number,
    modelValue: Number,
    min: Number,
    max: Number,
    step: Number,
    marks: Object
  },
  emits: ['update:value', 'update:modelValue', 'change'],
  setup(props, { attrs, emit }) {
    return () => h('div', { class: 'ui-slider-wrap' }, [
      h('input', {
        ...attrs,
        class: ['ui-slider', attrs.class],
        type: 'range',
        min: props.min,
        max: props.max,
        step: props.step,
        value: currentValue(props) ?? props.min ?? 0,
        onInput: event => emitModel(emit, Number(event.target.value))
      }),
      props.marks ? h('div', { class: 'ui-slider-marks' }, Object.entries(props.marks).map(([key, value]) => h('span', { key }, value))) : null
    ])
  }
})

const UiForm = defineComponent({
  name: 'UiForm',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('form', { ...attrs, class: ['ui-form', attrs.class], onSubmit: event => event.preventDefault() }, slots.default?.())
  }
})

const UiFormItem = defineComponent({
  name: 'UiFormItem',
  inheritAttrs: false,
  props: {
    label: String,
    required: Boolean
  },
  setup(props, { attrs, slots }) {
    return () => h('label', { ...attrs, class: ['ui-form-item', attrs.class] }, [
      props.label ? h('span', { class: 'ui-form-label' }, [props.label, props.required ? h('b', ' *') : null]) : null,
      slots.default?.()
    ])
  }
})

const UiSpace = defineComponent({
  name: 'UiSpace',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('div', { ...attrs, class: ['ui-space', attrs.class] }, slots.default?.())
  }
})

const UiModal = defineComponent({
  name: 'UiModal',
  inheritAttrs: false,
  props: {
    visible: Boolean,
    open: Boolean,
    title: String,
    width: [String, Number],
    footer: null,
    confirmLoading: Boolean,
    okText: String,
    cancelText: String
  },
  emits: ['ok', 'cancel', 'update:visible', 'update:open'],
  setup(props, { attrs, emit, slots }) {
    const close = () => {
      emit('update:visible', false)
      emit('update:open', false)
      emit('cancel')
    }
    return () => (props.visible || props.open) ? h('div', { class: 'ui-modal-mask' }, [
      h('div', {
        ...attrs,
        class: ['ui-modal', attrs.class],
        style: { width: typeof props.width === 'number' ? `${props.width}px` : props.width, ...attrs.style }
      }, [
        h('div', { class: 'ui-modal-header' }, [
          h('strong', props.title),
          h('button', { type: 'button', class: 'ui-icon-button', onClick: close }, '×')
        ]),
        h('div', { class: 'ui-modal-body' }, slots.default?.()),
        props.footer === null ? null : h('div', { class: 'ui-modal-footer' }, slots.footer ? slots.footer() : [
          h(UiButton, { onClick: close }, () => props.cancelText || '取消'),
          h(UiButton, { type: 'primary', loading: props.confirmLoading, onClick: () => emit('ok') }, () => props.okText || '确定')
        ])
      ])
    ]) : null
  }
})

const UiRadioGroup = defineComponent({
  name: 'UiRadioGroup',
  props: {
    value: [String, Number, Boolean],
    modelValue: [String, Number, Boolean]
  },
  emits: ['update:value', 'update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    provide(RADIO_GROUP_KEY, {
      value: computed(() => currentValue(props)),
      update: value => emitModel(emit, value)
    })
    return () => h('div', { class: 'ui-radio-group' }, slots.default?.())
  }
})

const UiRadio = defineComponent({
  name: 'UiRadio',
  props: {
    value: [String, Number, Boolean]
  },
  setup(props, { slots }) {
    const group = inject(RADIO_GROUP_KEY)
    return () => h('label', { class: 'ui-radio' }, [
      h('input', {
        type: 'radio',
        checked: group?.value.value === props.value,
        onChange: () => group?.update(props.value)
      }),
      h('span', slots.default?.())
    ])
  }
})

const UiCheckbox = defineComponent({
  name: 'UiCheckbox',
  props: {
    checked: Boolean,
    modelValue: Boolean
  },
  emits: ['update:checked', 'update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const active = computed(() => props.checked !== undefined ? props.checked : props.modelValue)
    return () => h('label', { class: 'ui-checkbox' }, [
      h('input', {
        type: 'checkbox',
        checked: active.value,
        onChange: event => {
          emit('update:checked', event.target.checked)
          emit('update:modelValue', event.target.checked)
          emit('change', event.target.checked)
        }
      }),
      h('span', slots.default?.())
    ])
  }
})

const UiDivider = defineComponent({
  name: 'UiDivider',
  setup(_, { slots }) {
    return () => h('div', { class: 'ui-divider' }, slots.default?.())
  }
})

const UiProgress = defineComponent({
  name: 'UiProgress',
  props: {
    percent: Number,
    strokeColor: String
  },
  setup(props) {
    return () => h('div', { class: 'ui-progress' }, [
      h('span', {
        style: {
          width: `${Math.max(0, Math.min(100, props.percent || 0))}%`,
          background: props.strokeColor || 'var(--ui-primary)'
        }
      })
    ])
  }
})

const UiAlert = defineComponent({
  name: 'UiAlert',
  props: {
    message: String,
    type: String
  },
  setup(props) {
    return () => h('div', { class: ['ui-alert', `ui-alert-${props.type || 'info'}`] }, props.message)
  }
})

const UiBadge = defineComponent({
  name: 'UiBadge',
  props: {
    count: [Number, String],
    offset: Array
  },
  setup(props, { slots }) {
    return () => h('span', { class: 'ui-badge-wrap' }, [
      slots.default?.(),
      Number(props.count) > 0 ? h('span', { class: 'ui-badge-count' }, props.count) : null
    ])
  }
})

const UiEmpty = defineComponent({
  name: 'UiEmpty',
  props: {
    description: String
  },
  setup(props) {
    return () => h('div', { class: 'ui-empty' }, props.description || '暂无数据')
  }
})

const UiSpin = defineComponent({
  name: 'UiSpin',
  setup() {
    return () => h('span', { class: 'i-lucide-loader-circle ui-spin' })
  }
})

const UiTabs = defineComponent({
  name: 'UiTabs',
  props: {
    activeKey: [String, Number],
    activeTab: [String, Number],
    modelValue: [String, Number]
  },
  emits: ['update:activeKey', 'update:activeTab', 'update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const localActive = ref()
    const getActive = (panes) => props.activeKey ?? props.activeTab ?? props.modelValue ?? localActive.value ?? panes[0]?.props?.key
    const setActive = (key) => {
      localActive.value = key
      emit('update:activeKey', key)
      emit('update:activeTab', key)
      emit('update:modelValue', key)
      emit('change', key)
    }
    return () => {
      const panes = flattenNodes(slots.default?.() || []).filter(node => node.type?.name === 'UiTabPane')
      const active = getActive(panes)
      const pane = panes.find(node => String(node.props?.key) === String(active)) || panes[0]
      return h('div', { class: 'ui-tabs' }, [
        h('div', { class: 'ui-tab-list' }, panes.map(node => h('button', {
          type: 'button',
          class: ['ui-tab', String(node.props?.key) === String(active) && 'active'],
          onClick: () => setActive(node.props?.key)
        }, node.props?.tab || node.props?.label || node.props?.key))),
        h('div', { class: 'ui-tab-panel' }, pane?.children?.default?.())
      ])
    }
  }
})

const UiTabPane = defineComponent({
  name: 'UiTabPane',
  props: {
    tab: String
  },
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  }
})

const UiCollapse = defineComponent({
  name: 'UiCollapse',
  props: {
    activeKey: [String, Number, Array],
    modelValue: [String, Number, Array]
  },
  emits: ['update:activeKey', 'update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const local = ref([])
    const current = computed(() => toArray(props.activeKey ?? props.modelValue ?? local.value))
    const toggle = (key) => {
      const next = current.value.includes(key) ? current.value.filter(item => item !== key) : [...current.value, key]
      local.value = next
      emit('update:activeKey', next)
      emit('update:modelValue', next)
      emit('change', next)
    }
    return () => {
      const panels = flattenNodes(slots.default?.() || []).filter(node => node.type?.name === 'UiCollapsePanel')
      return h('div', { class: 'ui-collapse' }, panels.map(node => {
        const key = node.props?.key
        const open = current.value.map(String).includes(String(key))
        return h('div', { class: 'ui-collapse-panel' }, [
          h('button', { type: 'button', class: 'ui-collapse-header', onClick: () => toggle(key) }, node.props?.header || key),
          open ? h('div', { class: 'ui-collapse-body' }, node.children?.default?.()) : null
        ])
      }))
    }
  }
})

const UiCollapsePanel = defineComponent({
  name: 'UiCollapsePanel',
  props: {
    header: String
  },
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  }
})

const UiList = defineComponent({
  name: 'UiList',
  props: {
    dataSource: Array
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'ui-list' }, (props.dataSource || []).map((item, index) => slots.renderItem
      ? slots.renderItem({ item, index })
      : h('div', { class: 'ui-list-item' }, String(item))))
  }
})

const UiListItem = defineComponent({
  name: 'UiListItem',
  setup(_, { slots }) {
    return () => h('div', { class: 'ui-list-item' }, [
      h('div', { class: 'ui-list-main' }, slots.default?.()),
      slots.actions ? h('div', { class: 'ui-list-actions' }, slots.actions()) : null
    ])
  }
})

const UiListItemMeta = defineComponent({
  name: 'UiListItemMeta',
  setup(_, { slots }) {
    return () => h('div', { class: 'ui-list-meta' }, [
      slots.title ? h('div', { class: 'ui-list-title' }, slots.title()) : null,
      slots.description ? h('div', { class: 'ui-list-description' }, slots.description()) : null
    ])
  }
})

const UiDescriptions = defineComponent({
  name: 'UiDescriptions',
  props: {
    column: [Number, String]
  },
  setup(_, { slots }) {
    return () => {
      const items = flattenNodes(slots.default?.() || []).filter(node => node.type?.name === 'UiDescriptionsItem')
      return h('div', { class: 'ui-descriptions' }, items.map(node => h('div', { class: 'ui-description-item' }, [
        h('span', { class: 'ui-description-label' }, node.props?.label),
        h('span', { class: 'ui-description-content' }, node.children?.default?.())
      ])))
    }
  }
})

const UiDescriptionsItem = defineComponent({
  name: 'UiDescriptionsItem',
  props: {
    label: String
  },
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  }
})

const UiTimeline = defineComponent({
  name: 'UiTimeline',
  setup(_, { slots }) {
    return () => h('div', { class: 'ui-timeline' }, slots.default?.())
  }
})

const UiTimelineItem = defineComponent({
  name: 'UiTimelineItem',
  setup(_, { slots }) {
    return () => h('div', { class: 'ui-timeline-item' }, slots.default?.())
  }
})

const UiPopconfirm = defineComponent({
  name: 'UiPopconfirm',
  props: {
    title: String
  },
  emits: ['confirm'],
  setup(props, { emit, slots }) {
    return () => h('span', {
      class: 'ui-popconfirm',
      onClick: (event) => {
        event.stopPropagation()
        if (window.confirm(props.title || '确定执行该操作?')) emit('confirm')
      }
    }, slots.default?.())
  }
})

const UiTooltip = defineComponent({
  name: 'UiTooltip',
  props: {
    title: String
  },
  setup(props, { slots }) {
    return () => h('span', { class: 'ui-tooltip', title: props.title }, slots.default?.())
  }
})

const UiAvatar = defineComponent({
  name: 'UiAvatar',
  setup(_, { attrs, slots }) {
    return () => h('span', { ...attrs, class: ['ui-avatar', attrs.class] }, slots.default?.())
  }
})

const passthrough = (name, tag = 'div', className = '') => defineComponent({
  name,
  inheritAttrs: false,
  setup(_, { attrs, slots, emit }) {
    return () => h(tag, { ...attrs, class: [className || name.replace(/^Ui/, 'ui-').toLowerCase(), attrs.class] }, slots.default?.())
  }
})

const components = {
  UiAlert,
  UiAvatar,
  UiBadge,
  UiButton,
  UiCard,
  UiCheckbox,
  UiCol,
  UiCollapse,
  UiCollapsePanel,
  UiDescriptions,
  UiDescriptionsItem,
  UiDivider,
  UiDropdown: passthrough('UiDropdown', 'div', 'ui-dropdown'),
  UiEmpty,
  UiForm,
  UiFormItem,
  UiInput,
  UiInputNumber,
  UiList,
  UiListItem,
  UiListItemMeta,
  UiMenu: passthrough('UiMenu', 'div', 'ui-menu'),
  UiMenuItem: passthrough('UiMenuItem', 'div', 'ui-menu-item'),
  UiModal,
  UiPopconfirm,
  UiPopover: passthrough('UiPopover', 'div', 'ui-popover'),
  UiProgress,
  UiRadio,
  UiRadioGroup,
  UiRow,
  UiSelect,
  UiSelectOption,
  UiSlider,
  UiSpace,
  UiSpin,
  UiStatistic,
  UiSwitch,
  UiTabPane,
  UiTable,
  UiTabs,
  UiTag,
  UiTextarea,
  UiTimeline,
  UiTimelineItem,
  UiTooltip
}

export default {
  install(app) {
    Object.entries(components).forEach(([name, component]) => {
      app.component(name, component)
    })
    Object.keys(iconMap).forEach((name) => {
      app.component(name, UiIconAlias(name))
    })
  }
}
