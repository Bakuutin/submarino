/* eslint-disable import/export */
/* eslint-disable complexity */

import { decodeMessage, encodeMessage, enumeration, message } from 'protons-runtime'

export const dm = {}

// DirectMessage
dm.DirectMessage = {}
let _DirectMessageCodec

dm.DirectMessage.codec = () => {
  if (_DirectMessageCodec == null) {
    _DirectMessageCodec = message((obj, w, opts = {}) => {
      if (opts.lengthDelimited !== false) {
        w.fork()
      }

      if (opts.lengthDelimited !== false) {
        w.ldelim()
      }
    }, (reader, length, opts = {}) => {
      const obj = {}

      const end = length == null ? reader.len : reader.pos + length

      while (reader.pos < end) {
        const tag = reader.uint32()

        switch (tag >>> 3) {
          default: {
            reader.skipType(tag & 7)
            break
          }
        }
      }

      return obj
    })
  }

  return _DirectMessageCodec
}

dm.DirectMessage.encode = (obj) => {
  return encodeMessage(obj, dm.DirectMessage.codec())
}

dm.DirectMessage.decode = (buf, opts) => {
  return decodeMessage(buf, dm.DirectMessage.codec(), opts)
}

// Metadata
dm.Metadata = {}
let _MetadataCodec

dm.Metadata.codec = () => {
  if (_MetadataCodec == null) {
    _MetadataCodec = message((obj, w, opts = {}) => {
      if (opts.lengthDelimited !== false) {
        w.fork()
      }

      if ((obj.clientVersion != null && obj.clientVersion !== '')) {
        w.uint32(10)
        w.string(obj.clientVersion)
      }

      if ((obj.timestamp != null && obj.timestamp !== 0n)) {
        w.uint32(16)
        w.int64(obj.timestamp)
      }

      if (opts.lengthDelimited !== false) {
        w.ldelim()
      }
    }, (reader, length, opts = {}) => {
      const obj = {
        clientVersion: '',
        timestamp: 0n
      }

      const end = length == null ? reader.len : reader.pos + length

      while (reader.pos < end) {
        const tag = reader.uint32()

        switch (tag >>> 3) {
          case 1: {
            obj.clientVersion = reader.string()
            break
          }
          case 2: {
            obj.timestamp = reader.int64()
            break
          }
          default: {
            reader.skipType(tag & 7)
            break
          }
        }
      }

      return obj
    })
  }

  return _MetadataCodec
}

dm.Metadata.encode = (obj) => {
  return encodeMessage(obj, dm.Metadata.codec())
}

dm.Metadata.decode = (buf, opts) => {
  return decodeMessage(buf, dm.Metadata.codec(), opts)
}

// Status enum
// Create enum with reverse mappings (like TypeScript enums)
const __StatusValues = {
  UNKNOWN: 0,
  OK: 200,
  ERROR: 500,
  // Reverse mappings for decoding
  0: 'UNKNOWN',
  200: 'OK',
  500: 'ERROR'
}

dm.Status = {
  UNKNOWN: 'UNKNOWN',
  OK: 'OK',
  ERROR: 'ERROR'
}

dm.Status.codec = () => {
  return enumeration(__StatusValues)
}

// DirectMessageRequest
dm.DirectMessageRequest = {}
let _DirectMessageRequestCodec

dm.DirectMessageRequest.codec = () => {
  if (_DirectMessageRequestCodec == null) {
    _DirectMessageRequestCodec = message((obj, w, opts = {}) => {
      if (opts.lengthDelimited !== false) {
        w.fork()
      }

      if (obj.metadata != null) {
        w.uint32(10)
        dm.Metadata.codec().encode(obj.metadata, w)
      }

      if ((obj.content != null && obj.content !== '')) {
        w.uint32(18)
        w.string(obj.content)
      }

      if ((obj.type != null && obj.type !== '')) {
        w.uint32(26)
        w.string(obj.type)
      }

      if (opts.lengthDelimited !== false) {
        w.ldelim()
      }
    }, (reader, length, opts = {}) => {
      const obj = {
        content: '',
        type: ''
      }

      const end = length == null ? reader.len : reader.pos + length

      while (reader.pos < end) {
        const tag = reader.uint32()

        switch (tag >>> 3) {
          case 1: {
            obj.metadata = dm.Metadata.codec().decode(reader, reader.uint32(), {
              limits: opts.limits?.metadata
            })
            break
          }
          case 2: {
            obj.content = reader.string()
            break
          }
          case 3: {
            obj.type = reader.string()
            break
          }
          default: {
            reader.skipType(tag & 7)
            break
          }
        }
      }

      return obj
    })
  }

  return _DirectMessageRequestCodec
}

dm.DirectMessageRequest.encode = (obj) => {
  return encodeMessage(obj, dm.DirectMessageRequest.codec())
}

dm.DirectMessageRequest.decode = (buf, opts) => {
  return decodeMessage(buf, dm.DirectMessageRequest.codec(), opts)
}

// DirectMessageResponse
dm.DirectMessageResponse = {}
let _DirectMessageResponseCodec

dm.DirectMessageResponse.codec = () => {
  if (_DirectMessageResponseCodec == null) {
    _DirectMessageResponseCodec = message((obj, w, opts = {}) => {
      if (opts.lengthDelimited !== false) {
        w.fork()
      }

      if (obj.metadata != null) {
        w.uint32(10)
        dm.Metadata.codec().encode(obj.metadata, w)
      }

      if (obj.status != null && __StatusValues[obj.status] !== 0) {
        w.uint32(16)
        dm.Status.codec().encode(obj.status, w)
      }

      if (obj.statusText != null) {
        w.uint32(26)
        w.string(obj.statusText)
      }

      if (opts.lengthDelimited !== false) {
        w.ldelim()
      }
    }, (reader, length, opts = {}) => {
      const obj = {
        status: dm.Status.UNKNOWN
      }

      const end = length == null ? reader.len : reader.pos + length

      while (reader.pos < end) {
        const tag = reader.uint32()

        switch (tag >>> 3) {
          case 1: {
            obj.metadata = dm.Metadata.codec().decode(reader, reader.uint32(), {
              limits: opts.limits?.metadata
            })
            break
          }
          case 2: {
            obj.status = dm.Status.codec().decode(reader)
            break
          }
          case 3: {
            obj.statusText = reader.string()
            break
          }
          default: {
            reader.skipType(tag & 7)
            break
          }
        }
      }

      return obj
    })
  }

  return _DirectMessageResponseCodec
}

dm.DirectMessageResponse.encode = (obj) => {
  return encodeMessage(obj, dm.DirectMessageResponse.codec())
}

dm.DirectMessageResponse.decode = (buf, opts) => {
  return decodeMessage(buf, dm.DirectMessageResponse.codec(), opts)
}

// Top-level codec
let _dmCodec

dm.codec = () => {
  if (_dmCodec == null) {
    _dmCodec = message((obj, w, opts = {}) => {
      if (opts.lengthDelimited !== false) {
        w.fork()
      }

      if (opts.lengthDelimited !== false) {
        w.ldelim()
      }
    }, (reader, length, opts = {}) => {
      const obj = {}

      const end = length == null ? reader.len : reader.pos + length

      while (reader.pos < end) {
        const tag = reader.uint32()

        switch (tag >>> 3) {
          default: {
            reader.skipType(tag & 7)
            break
          }
        }
      }

      return obj
    })
  }

  return _dmCodec
}

dm.encode = (obj) => {
  return encodeMessage(obj, dm.codec())
}

dm.decode = (buf, opts) => {
  return decodeMessage(buf, dm.codec(), opts)
}
