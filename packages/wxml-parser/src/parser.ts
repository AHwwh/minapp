import { Node, TagNodeAttr, Document, TextNode, CommentNode, TagNode } from './structs'
const debug = require('debug')('minapp:wxml-parser')

export class ParserError extends Error {
  /**
   * 解析失败时的错误
   * @param {number} index 错误位置
   * @param {string} message 错误信息
   * @memberof ParserError
   */
  constructor(public index: number, message: string) {
    super(message)
  }
}

// tslint:disable:no-conditional-assignment
export function parse(xml: string) {
  let lastLocation = 0
  let location = 0

  return document()

  function document() {
    let doc = new Document()
    whitespace()
    let n: Node
    while (!eos() && (n = node())) {
      doc.nodes.push(n)
    }
    return doc
  }

  function node(): Node {
    let n: Node
    if (is('<!--')) {
      n = comment()
    } else {
      let m = match(/^<([\w-:.]+)\s*/)
      if (m) {
        n = tag(m[1])
      } else {
        n = text()
      }
    }
    whitespace()
    return n
  }

  function text(): TextNode {
    // 查找下一个 comment 或 tag开始节点 或 tag结束节点
    let m = /(<!--|<\/?([\w-:.]+)\s*)/.exec(xml)
    let content
    if (!m) {
      content = xml
    } else {
      content = xml.substring(0, m.index)
    }
    content = content.replace(/\s*$/, '')
    match(content)
    return new TextNode(content, lastLocation, location)
  }

  function comment(): CommentNode {
    debug('comment %j', xml)
    let m = match(/^<!--([\s\S]*?)-->/)
    if (!m) {
      throw new ParserError(location, `comment node has no end tag`)
    } else {
      return new CommentNode(m[1].trim(), lastLocation, location)
    }
  }

  function tag(name: string): TagNode {
    debug('tag %j', `<${name} ` + xml)
    let n = new TagNode(name, lastLocation)

    whitespace()

    // attributes
    while (!(eos() || is('>') || is('/>'))) {
      n.attrs.push(attr())
      whitespace()
    }

    // self closing tag
    if (match(/^\/>/)) {
      n.selfClose = true
      n.end = location
      return n
    } else if (!match(/^>/)) {
      // 文档结束了
      throw new ParserError(location, `expect ">", bug got nothing`)
    }

    whitespace()
    let closeTag = /^<\/([\w-:.]+)>/
    let child
    while (!eos() && !is(closeTag) && (child = node())) {
      n.children.push(child)
    }

    // closing
    let m = match(closeTag)
    if (m) {
      if (m[1] === n.name) {
        n.end = location
        return n
      } else {
        throw new ParserError(lastLocation, `expect end tag "</${n.name}>", bug got "</${m[1]}>"`)
      }
    }

    throw new ParserError(location, `expect end tag "</${n.name}>", bug got nothing`)
  }

  /**
   * Attribute.
   */
  function attr() {
    debug('attr %j', xml)
    let m = match(/^([\w:-]+)\s*(=\s*("[^"]*"|'[^']*'|\w+))?/)
    if (!m) throw new ParserError(location, `node attribute syntax error`)
    return new TagNodeAttr(m[1], m[2] ? strip(m[3]) : true, location, lastLocation)
  }

  /**
   * Strip quotes from `val`.
   */
  function strip(val: string) {
    return val.replace(/^['"]|['"]$/g, '')
  }

  /**
   * match whitespace
   */
  function whitespace() {
    match(/^\s*/)
  }

  /**
   * Match `re` and advance the string.
   */
  function match(content: string): string
  function match(reg: RegExp): RegExpMatchArray
  function match(regOrContent: RegExp | string) {
    if (typeof regOrContent === 'string') {
      if (xml.indexOf(regOrContent) !== 0) return
      lastLocation = location
      location += regOrContent.length
      xml = xml.slice(regOrContent.length)
      return regOrContent
    } else {
      let m = xml.match(regOrContent)
      if (!m) return
      lastLocation = location
      location += m[0].length
      xml = xml.slice(m[0].length)
      return m
    }
  }

  /**
   * End-of-source.
   */
  function eos() {
    return 0 === xml.length
  }

  /**
   * Check for `prefix`.
   */
  function is(prefix: string | RegExp) {
    if (typeof prefix === 'string') {
      return 0 === xml.indexOf(prefix)
    } else {
      let m = xml.match(prefix)
      return m ? m.index === 0 : false
    }
  }
}

export * from './structs'
