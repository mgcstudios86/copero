import type { MessageDescriptor, MessageParams } from './types'

export function msg(key: string, params?: MessageParams): MessageDescriptor {
  return params && Object.keys(params).length ? { key, params } : { key }
}
