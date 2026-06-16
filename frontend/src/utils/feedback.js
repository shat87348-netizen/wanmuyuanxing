const emitToast = (type, text) => {
  const detail = { type, text: String(text || '') }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sjcl:toast', { detail }))
  } else if (type === 'error') {
    console.error(detail.text)
  }
}

export const message = {
  success(text) {
    emitToast('success', text)
  },
  error(text) {
    emitToast('error', text)
  },
  warning(text) {
    emitToast('warning', text)
  },
  info(text) {
    emitToast('info', text)
  }
}

export default message
