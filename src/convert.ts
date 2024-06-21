/*
パースの順番
1. ほとんどはキーワード（記号を含む、fn・class・*など）から一つの文が始まるので、それを見つける
2. その文の種類を判定する
3. その分の中でさらに文がある場合、それを見つけ同じ手順を繰り返す
4. その分に対応するC#のコードを生成する
*/

// C#にはあるが省いた、または実装が予定されないキーワード
// alias, case, managed, unmanaged, var, when, where, readonly
// （LINQのクエリ式で使うキーワード（全て省略））
// ascending, by, descending, equals, from, group, into, join, let, on, orderby, select, where, yield

// C#ではコンテキストキーワードだが、キーワードとして扱うようにしたもの
// and, async, await, dynamic, nameof, nint, not, nuint, or, partial, record, with, yield

// C#にはないが追加したキーワード
// ctor, finalizer, fn, let, prop, immut

// C#ではコンテキストキーワードで、そのままコンテキストキーワードとして扱うもの
// add, args, get, global, init, notnull, remove, set, value

// C#にはないが追加したコンテキストキーワード
// field

import { convertType, parseType, searchArgsAndReturned } from './parsers/typeAndVariable';
import { convertRightSide } from './parsers/rightSide';

export type { Token, };
export { operators, SyntaxError, UnhandledError, parse, trimEmptyWords, removeEmptyWords, isAccessor, isNext, isLiteralCategory, isMethodKeyword };


const keywords = ['abstract', 'and', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'catch', 'char', 'checked', 'class', 'const', 'continue', 'ctor', 'decimal', 'default', 'delegate', 'do', 'double', 'dynamic', 'elif', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finalizer', 'finally', 'fixed', 'float', 'fn', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'let', 'lock', 'long', 'nameof', 'namespace', 'new', 'nint', 'not', 'nuint', 'null', 'object', 'operator', 'or', 'out', 'override', 'params', 'partial', 'private', 'prop', 'protected', 'public', 'immut', 'record', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while', 'with', 'yield'];
const contextKeywords = ['add', 'args', 'filed', 'get', 'global', 'init', 'notnull', 'remove', 'set', 'value'];

const operators = ['.', ';', ',', '(', ')', '{', '}', '?', ':', '=', '+', '+=', '++', '-', '-=', '--', '*', '*=', '/', '/=', '%', '%=', '??', '??=', '?.', '!.', '<<', '<<=', '>>', '>>=', '>>>', '>>>=', '&', '&=', '^', '^=', '|', '|=', '==', '!=', '<=', '>=', '<', '>', '&&', '||', '=>', '!', '~', '#', '::', '@', '$'];
const assignmentOperators = ['=', '+=', '-=', '*=', '/=', '%=', '??=', '<<=', '>>=', '>>>=', '&=', '^=', '|='];

type Category = undefined | 'line_break' | 'space' | 'operator' | 'keyword' | 'context_keyword' | 'comment' | 'string_literal' | 'raw_string_literal' | 'char_literal' | 'number_literal';
function isLiteralCategory(category: Category) {
  return category === 'string_literal' || category === 'raw_string_literal' || category === 'char_literal' || category === 'number_literal';
}

type Kind = CommentKind | BracketKind | SpaceKind | LiteralKind | OperatorKind | KeywordKind | NameKind | ModifierKind;
type CommentKind = 'comment.line' | 'comment.block';
type BracketKind = 'bracket.brace' | 'bracket.parenthesis';
type SpaceKind = 'space.line-break' | 'space.space';
type LiteralKind = 'literal.string' | 'literal.raw-string' | 'literal.char' | 'literal.number' | 'literal.bool' | 'literal.null';
type OperatorKind = 'operator.discard' | 'operator.type-annotation' | 'operator.accessibility-annotation' | 'operator.fn-arrow' | 'operator.tuple-connector' | 'operator.array-marker' | 'operator.generics-params-annotation' | 'operator.generics-params-separator' | 'operator.fn-args-separator' | 'operator.other';
type KeywordKind = 'keyword.declarator' | 'keyword.builtin-type' | 'keyword.block-with-expr' | 'keyword.block-without-expr' | 'keyword.var' | 'keyword.method' | 'keyword.expr' | 'keyword.block-or-method' | 'keyword.method-or-other' | 'keyword.accessor' | 'keyword.other';
const keywordsOfDeclarator = new Set([
  'class', 'const', 'ctor', 'delegate', 'enum', 'event', 'finalizer', 'fn', 'interface', 'let', 'prop', 'record', 'struct']);
const keywordsOfBuiltinType = new Set(['bool', 'byte', 'char', 'decimal', 'double', 'dynamic', 'float', 'int', 'long', 'nint', 'nuint', 'object', 'sbyte', 'short', 'string', 'uint', 'ulong', 'ushort', 'void']);
const keywordsOfBlockWithExpr = new Set(['for', 'foreach', 'while', 'elif', 'else', 'if', 'catch', 'switch', 'fixed', 'lock', 'do']);
const keywordsOfBlockWithoutExpr = new Set(['try', 'finally']);
const keywordsOfVar = new Set(['args', 'base', 'this', 'field', 'value']);
const keywordsOfMethod = new Set(['nameof', 'sizeof', 'typeof']);
const keywordsOfExpr = new Set(['break', 'continue', 'goto', 'return', 'await', 'throw']);
const keywordsOfBlockOrMethod = new Set(['checked', 'unchecked']);
const keywordsOfMethodOrOther = new Set(['default']);
const keywordsOfAccessor = new Set(['add', 'get', 'init', 'remove', 'set']);
const keywordsOfOther = new Set(['explicit', 'extern', 'global', 'implicit', 'namespace', 'operator', 'new', 'stackalloc', 'using', 'with', 'as', 'is', 'notnull', 'and', 'or']);
function isMethodKeyword(kind: Kind | undefined) {
  return kind === 'keyword.method' || kind === 'keyword.block-or-method' || kind === 'keyword.method-or-other';
}
type NameKind = 'name.class' | 'name.fn' | 'name.var' | 'name.const' | 'name.fn-arg' | 'name.field' | 'name.prop' | 'name.enum' | 'name.interface' | 'name.generics-param' | 'name.namespace' | 'name.other';
type ModifierKind = 'modifier.after-at' | 'modifier.other';
const modifierOfAfterAt = new Set(['internal', 'private', 'protected', 'public', 'sealed', 'static', 'unsafe', 'volatile']);
const modifierOfOther = new Set(['abstract', 'async', 'immut', 'in', 'out', 'override', 'params', 'partial', 'ref', 'virtual', 'yield']);
function kindOfKeywordOrModifier(keyword: string): KeywordKind | ModifierKind {
  if (keywordsOfDeclarator.has(keyword)) return 'keyword.declarator';
  if (keywordsOfBuiltinType.has(keyword)) return 'keyword.builtin-type';
  if (keywordsOfBlockWithExpr.has(keyword)) return 'keyword.block-with-expr';
  if (keywordsOfBlockWithoutExpr.has(keyword)) return 'keyword.block-without-expr';
  if (keywordsOfVar.has(keyword)) return 'keyword.var';
  if (keywordsOfMethod.has(keyword)) return 'keyword.method';
  if (keywordsOfExpr.has(keyword)) return 'keyword.expr';
  if (keywordsOfBlockOrMethod.has(keyword)) return 'keyword.block-or-method';
  if (keywordsOfMethodOrOther.has(keyword)) return 'keyword.method-or-other';
  if (keywordsOfAccessor.has(keyword)) return 'keyword.accessor';
  if (keywordsOfOther.has(keyword)) return 'keyword.other';
  if (modifierOfAfterAt.has(keyword)) return 'modifier.after-at';
  if (modifierOfOther.has(keyword)) return 'modifier.other';
  throw new SyntaxError({ content: keyword, start: 0, end: keyword.length });
}

// 'var'などのC#では予約語だが、削除されたキーワードを変数名として使う時に追加するプレフィックス（このプレフィックスから始まる変数を記述することは不可）
const autoModifiedVarNamePrefix = '__auto_modified_var_name_';

interface Token {
  id: number;
  text: string;
  start: number;
  end: number;
  category: Category;
  kind?: Kind;
  data?: any;
}
// UnhandledError, SyntaxError
class SyntaxError implements Error {
  name: string;
  message: string;
  cause?: Token | { content: string, start: number, end: number };
  constructor(token: Token | { content: string, start: number, end: number } | null = null, message: string | null = null) {
    this.name = 'SyntaxError';

    if (token === null) {
      this.message = message ?? 'Syntax error';
      return;
    }

    const { id } = token as Record<keyof Token, unknown>;
    if (typeof id !== 'number') {
      const tokenCasted = token as { content: string, start: number, end: number };

      if (message === null) {
        this.message = `Unexpected token: ${tokenCasted.content}`;
        this.cause = tokenCasted;
      } else {
        this.message = message;
        this.cause = tokenCasted;
      }
    }
    else {
      const tokenCasted = token as Token;

      if (message === null) {
        this.message = `Unexpected token: ${tokenCasted.text}`;
        this.cause = tokenCasted;
      } else {
        this.message = message;
        this.cause = tokenCasted;
      }
    }
  }
}
class UnhandledError implements Error {
  name: string;
  message: string;
  cause?: Token | { content: string, start: number, end: number };
  constructor(token: Token | { content: string, start: number, end: number } | null = null, message: string | null = null) {
    this.name = 'UnhandledError';

    if (token === null) {
      this.message = message ?? 'Unhandled error';
      return;
    }

    const { id } = token as Record<keyof Token, unknown>;
    if (typeof id !== 'number') {
      const tokenCasted = token as { content: string, start: number, end: number };

      if (message === null) {
        this.message = `Unhandled error: ${tokenCasted.content}`;
        this.cause = tokenCasted;
      } else {
        this.message = message;
        this.cause = tokenCasted;
      }
    }
    else {
      const tokenCasted = token as Token;

      if (message === null) {
        this.message = `Unhandled error: ${tokenCasted.text}`;
        this.cause = tokenCasted;
      } else {
        this.message = message;
        this.cause = tokenCasted;
      }
    }
  }
}

const separateByKeyword = /\w+|\r\n|\r|\n|(\s+)|==|\!==|<=|>=|&&|\|\||=>|\+\+|\-\-|\+=|\-=|\*=|\/=|%=|\?\.|\!\.|\?\?|\?\?=|<<|>>|>>>|<<=|>>=|>>>=|&=|\^=|\|=|::|\.\.|\W/g;
const commentRegex = /(?:(\/\/.*?)(?:\r\n|\r|\n))|(\/\/.*?$)|(\/\*.*?\*\/)/yms;
const stringLiteralRegex = /(?:(\$@"|@\$"|@\"|@")((?:(?:[^\+\r\n,;]*?)(?:"")*)*)(?:(?:,|;|\r\n|\r|\n|$|\+|==|!=|<=|>=|=>)|(")))|(?:((?<!@)\$?)(")((?:[^"\\]|\\.)*?)(?:(?:(?<!\\)(\\\\)*[;,]|(?= *?(?:\r\n|\r|\n|$|\+|==|!=|<=|>=|=>)))|(?<!\\)(\\\\)*(")))/y;
const rawStringLiteralRegex = /(?<!@)(?<!\$)(\$+?@?|@?\$+?)?(`.*?(?<!\\)`|(?<quote>"{3,}).*?\k<quote>(?!\"))/yms;
const charLiteralRegex = /(')([^ \r\n]+?)(?:(')|(?: |,|;|\r\n|\r|\n|$|\+|==|!=|<=|>=|=>))/y;
// 厳密な判定を行うなら↓
// const charLiteralRegex = /(')(?:(\\x[0-9A-Fa-f]{1,4})|(\\u[0-9A-Fa-f]{4})|(\\U[0-9A-Fa-f]{8})|(\\['"\\0abefnrtv]))(?:(')|(?: |,|;|\r\n|\r|\n|$|\+|==|!=|<=|>=|=>))/g;

let lastId = 0;

function parse(str: string): string {
  commentRegex.lastIndex = 0;
  stringLiteralRegex.lastIndex = 0;
  rawStringLiteralRegex.lastIndex = 0;
  charLiteralRegex.lastIndex = 0;

  const words: Token[] = [];
  let match: RegExpExecArray | null;
  let matchPreviousNumberLiteral: RegExpExecArray | null = null;
  let matchPreviousDecimalPoint: RegExpExecArray | null = null;
  while ((match = separateByKeyword.exec(str)) != null) {
    let category: Category;
    let kind: Kind | undefined;
    if (match[1] === undefined) {
      if (matchPreviousNumberLiteral !== null) {
        if (match[0] === '.') {
          if (matchPreviousDecimalPoint !== null)
            throw new SyntaxError({ content: '.', start: matchPreviousDecimalPoint.index, end: 1 }, 'Unexpected decimal point');
          matchPreviousDecimalPoint = match;
          continue;
        } else {
          if (matchPreviousDecimalPoint !== null) {
            if (isNaN(Number(match[0][0])) === false) {
              words.push({
                id: lastId++,
                category: 'number_literal',
                kind: 'literal.number',
                text: matchPreviousNumberLiteral[0] + matchPreviousDecimalPoint[0] + match[0],
                start: matchPreviousNumberLiteral.index,
                end: matchPreviousDecimalPoint.index + matchPreviousDecimalPoint[0].length + match[0].length
              });
              matchPreviousNumberLiteral = null;
              matchPreviousDecimalPoint = null;
              continue;
            } else {
              words.push({
                id: lastId++,
                category: 'number_literal',
                kind: 'literal.number',
                text: matchPreviousNumberLiteral[0],
                start: matchPreviousNumberLiteral.index,
                end: matchPreviousNumberLiteral.index + matchPreviousNumberLiteral[0].length
              });
              words.push({
                id: lastId++,
                category: 'operator',
                text: matchPreviousDecimalPoint[0],
                start: matchPreviousDecimalPoint.index,
                end: matchPreviousDecimalPoint.index + matchPreviousDecimalPoint[0].length
              });
              matchPreviousNumberLiteral = null;
              matchPreviousDecimalPoint = null;
            }
          } else {
            words.push({
              id: lastId++,
              category: 'number_literal',
              kind: 'literal.number',
              text: matchPreviousNumberLiteral[0],
              start: matchPreviousNumberLiteral.index,
              end: matchPreviousNumberLiteral.index + matchPreviousNumberLiteral[0].length
            });
            matchPreviousNumberLiteral = null;
          }
        }
      }
      if (match[0] === '\r\n' || match[0] == '\n') {
        category = 'line_break';
      } else if (operators.includes(match[0])) {
        category = 'operator';
      } else if (keywords.includes(match[0])) {
        category = 'keyword';
        kind = kindOfKeywordOrModifier(match[0]);
      } else if (contextKeywords.includes(match[0])) {
        category = 'context_keyword';
        kind = kindOfKeywordOrModifier(match[0]);
      } else {
        if (isNaN(Number(match[0][0])) === false) {
          if (matchPreviousNumberLiteral !== null)
            throw new SyntaxError({ content: match[0][0], start: match.index, end: match.index + match.length }, 'Unexpected number literal');
          matchPreviousNumberLiteral = match;
          continue;
        } else {
          category = undefined;
        }
      }
    } else {
      if (matchPreviousNumberLiteral !== null) {
        words.push({
          id: lastId++,
          category: 'number_literal',
          kind: 'literal.number',
          text: matchPreviousNumberLiteral[0],
          start: matchPreviousNumberLiteral.index,
          end: matchPreviousNumberLiteral.index + matchPreviousNumberLiteral[0].length
        });
        matchPreviousNumberLiteral = null;
      }
      category = 'space';
    }
    words.push({
      id: lastId++,
      category: category,
      kind: kind,
      text: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  if (matchPreviousNumberLiteral !== null) {
    words.push({
      id: lastId++,
      category: 'number_literal',
      kind: 'literal.number',
      text: matchPreviousNumberLiteral[0],
      start: matchPreviousNumberLiteral.index,
      end: matchPreviousNumberLiteral.index + matchPreviousNumberLiteral[0].length
    });
    matchPreviousNumberLiteral = null;
    if (matchPreviousDecimalPoint !== null) {
      words.push({
        id: lastId++,
        category: 'operator',
        text: matchPreviousDecimalPoint[0],
        start: matchPreviousDecimalPoint.index,
        end: matchPreviousDecimalPoint.index + matchPreviousDecimalPoint[0].length
      });
      matchPreviousDecimalPoint = null;
    }
  }

  const result: Token[] = [];

  for (let i = 0; i < str.length;) {
    commentRegex.lastIndex = i;
    stringLiteralRegex.lastIndex = i;
    rawStringLiteralRegex.lastIndex = i;
    charLiteralRegex.lastIndex = i;

    let commentPosition = findComment(str);
    let stringLiteralPosition = findStringLiteral(str);
    let rawStringLiteralPosition = findRawStringLiteral(str);
    let charLiteralPosition = findCharLiteral(str);

    if (commentPosition != null && (stringLiteralPosition == null || commentPosition.start < stringLiteralPosition.start) && (rawStringLiteralPosition == null || commentPosition.start < rawStringLiteralPosition.start) && (charLiteralPosition == null || commentPosition.start < charLiteralPosition.start)) {
      result.push({
        id: lastId++,
        category: 'comment',
        kind: commentPosition.isBlock ? 'comment.block' : 'comment.line',
        ...commentPosition
      });
      i = commentPosition.end;
    } else if (stringLiteralPosition != null && (rawStringLiteralPosition == null || stringLiteralPosition.start < rawStringLiteralPosition.start) && (charLiteralPosition == null || stringLiteralPosition.start < charLiteralPosition.start)) {
      result.push({
        id: lastId++,
        category: 'string_literal',
        kind: 'literal.string',
        ...stringLiteralPosition
      });
      i = stringLiteralPosition.end;
    } else if (rawStringLiteralPosition != null && (charLiteralPosition == null || rawStringLiteralPosition.start < charLiteralPosition.start)) {
      result.push({
        id: lastId++,
        category: 'raw_string_literal',
        kind: 'literal.raw-string',
        ...rawStringLiteralPosition
      });
      i = rawStringLiteralPosition.end;
    } else if (charLiteralPosition != null) {
      result.push({
        id: lastId++,
        category: 'char_literal',
        kind: 'literal.char',
        ...charLiteralPosition
      });
      i = charLiteralPosition.end;
    } else {
      const current = words.find(s => s.start == i);
      if (current != null) {
        result.push(current);
        i = current.end;
      } else {
        throw new SyntaxError({ content: str[i], start: i, end: i + 1 }, `Unexpected character: ${str[i]}`);
        result.push({
          id: lastId++,
          category: 'space',
          kind: 'space.space',
          text: str[i],
          start: i,
          end: i + 1
        });
        i++;
      }
    }
  }

  const converted: string[] = [];

  convertBlock(result, 0, 'none');

  console.log(result);

  return converted.join('') + '\r\n';

  function convertBlock(tokens: Token[], bracketCount: number, container: 'none' | 'namespace' | 'class' | 'struct' | 'fn') {
    const indexCount = 2;

    type ModifiersType = {
      inheritance: ['abstract' | 'new' | 'override' | 'virtual', Token] | null,
      refImmut: ['ref' | 'immut' | 'immut ref' | 'ref immut', Token | { content: string, start: number, end: number }] | null,
      async: [boolean, Token] | null,
      yield: [boolean, Token] | null,
      partial: [boolean, Token] | null,
      latestModifier: string | null,
    };
    const modifiers: ModifiersType = {
      inheritance: null,
      refImmut: null,
      async: null,
      yield: null,
      partial: null,
      latestModifier: null,
    };
    function resetModifiers() {
      modifiers.inheritance = null;
      modifiers.refImmut = null;
      modifiers.async = null;
      modifiers.yield = null;
      modifiers.partial = null;
      modifiers.latestModifier = null;
    }
    function isModifiersChanged() {
      return modifiers.inheritance !== null || modifiers.refImmut !== null || modifiers.async || modifiers.yield || modifiers.partial;
    }
    function isRefImmutToken(value: Token | { content: string, start: number, end: number }): value is Token {
      const { id } = value as Record<keyof Token, unknown>;
      if (typeof id !== 'number')
        return false;
      return true;
    }

    let i = 0;
    while (i < tokens.length) {
      const current = tokens[i];

      if (current.category === 'line_break' && i + 1 < tokens.length && tokens[i + 1].category === 'line_break') {
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].category !== 'line_break')
            break;
          converted.push('\r\n');
          i++;
        }
      } else if (current.category == 'keyword') {
        converted.push(' '.repeat(bracketCount * indexCount));

        switch (current.text) {
          case 'class': {
            if (container === 'fn') {
              throw new SyntaxError(current, 'Cannot declare class in function');
            }

            const leftBraceIndex = tokens.findIndex((s, j) => j > i && s.text == '{');
            if (leftBraceIndex == -1) {
              throw new SyntaxError(current, 'Missing left brace');
            }
            const atIndex = tokens.findIndex((s, j) => j > i && j < leftBraceIndex && s.text == '@');
            if (atIndex != -1) {
              const modifiers = searchModifiers(tokens.slice(atIndex + 1, leftBraceIndex), true);
              converted.push(...modifiers.map(x => x.text + ' '));
            }

            if (modifiers.inheritance !== null) {
              if (modifiers.inheritance[0] !== 'abstract')
                throw new SyntaxError(modifiers.inheritance[1], `${modifiers.inheritance} is not allowed for class`);
              converted.push(`${modifiers.inheritance} `);
            }
            if (modifiers.refImmut !== null) {
              if (isRefImmutToken(modifiers.refImmut[1]))
                throw new SyntaxError(modifiers.refImmut[1], `${modifiers.refImmut} is not allowed for class`);
              else
                throw new SyntaxError(modifiers.refImmut[1], `${modifiers.refImmut} is not allowed for class`);
            }
            if (modifiers.async)
              throw new SyntaxError(modifiers.async[1], 'async is not allowed for class');
            if (modifiers.yield)
              throw new SyntaxError(modifiers.yield[1], 'yield is not allowed for class');
            if (modifiers.partial)
              converted.push('partial ');
            resetModifiers();

            const classNameIndex = tokens.findIndex((s, j) => j > i && j < leftBraceIndex && (s.category == undefined || s.category == 'context_keyword'));
            if (classNameIndex == -1) {
              throw new SyntaxError(current, 'Missing class name');
            }
            const indexOfUnexpected = indexOfNotBlankOrComment(classNameIndex + 1, atIndex === -1 ? leftBraceIndex : atIndex)
            if (indexOfUnexpected !== -1) {
              throw new SyntaxError(tokens[indexOfUnexpected]);
            }
            let genericsParamsEndIndex = classNameIndex;
            const genericsParams: Token[] = [];
            for (let j = classNameIndex + 1; j < leftBraceIndex; j++) {
              if (tokens[j].category !== 'space' && tokens[j].category !== 'line_break' && tokens[j].category !== 'comment') {
                if (tokens[j].text === '-') {
                  tokens[j].kind = 'operator.generics-params-annotation';
                  genericsParamsEndIndex = j;
                  let isAtSeparator = true;
                  for (let k = j + 1; k < leftBraceIndex; k++) {
                    if (tokens[k].category === 'space' || tokens[k].category === 'line_break' || tokens[k].category === 'comment') {
                      continue;
                    }
                    if (isAtSeparator) {
                      tokens[k].kind = 'name.generics-param';
                      genericsParams.push(tokens[k]);
                      isAtSeparator = false;
                      genericsParamsEndIndex = k;
                    } else {
                      if (tokens[k].text === '@') {
                        break;
                      } else if (tokens[k].text === '_' || (k + 1 < tokens.length && tokens[k + 1].text === ':')) {
                        break;
                      } else if (tokens[k].text === '/') {
                        tokens[k].kind = 'operator.generics-params-separator';
                        isAtSeparator = true;
                      } else {
                        throw new SyntaxError(tokens[k]);
                      }
                    }
                  }
                  if (genericsParams.length === 0) {
                    throw new SyntaxError(tokens[j], 'Missing generics parameter');
                  }
                } else {
                  break;
                }
              }
            }
            if (tokens[genericsParamsEndIndex + 1].category !== 'space' && tokens[genericsParamsEndIndex + 1].category !== 'line_break' && tokens[genericsParamsEndIndex + 1].category !== 'comment' && tokens[genericsParamsEndIndex + 1].text !== '{') {
              throw new SyntaxError(tokens[genericsParamsEndIndex + 1]);
            }

            if (genericsParams.length === 0)
              converted.push(`class ${tokens[classNameIndex].text} {\r\n`);
            else
              converted.push(`class ${tokens[classNameIndex].text}<${genericsParams.map(x => x.text).join(', ')}> {\r\n`);

            let rightBraceIndex = -1;
            let braceCount = 1;
            for (let j = leftBraceIndex + 1; j < tokens.length; j++) {
              if (tokens[j].text == '{') {
                braceCount++;
              } else if (tokens[j].text == '}') {
                braceCount--;
                if (braceCount == 0) {
                  rightBraceIndex = j;
                  break;
                }
              }
            }
            if (rightBraceIndex == -1) {
              throw new SyntaxError(tokens[leftBraceIndex], 'Missing right brace');
            }
            const block = tokens.slice(leftBraceIndex + 1, rightBraceIndex);
            convertBlock(block, bracketCount + 1, 'class');

            converted.push(`${' '.repeat(bracketCount * indexCount)}}\r\n`);

            i = rightBraceIndex + 1;
            break;
          }
          case 'struct': {
            if (container === 'fn') {
              throw new SyntaxError(current, 'Cannot declare struct in function');
            }

            if (modifiers.inheritance !== null)
              throw new SyntaxError(modifiers.inheritance[1], `${modifiers.inheritance} is not allowed for struct`);
            if (modifiers.refImmut !== null) {
              if (modifiers.refImmut[0] === 'ref')
                converted.push('ref ');
              else if (modifiers.refImmut[0] === 'immut')
                converted.push('readonly ');
              else if (modifiers.refImmut[0] === 'immut ref')
                converted.push('readonly ref ');
              else
                throw new SyntaxError(modifiers.refImmut[1], `${modifiers.refImmut} is not allowed for struct`);

            }
            if (modifiers.async)
              throw new SyntaxError(modifiers.async[1], 'async is not allowed for struct');
            if (modifiers.yield)
              throw new SyntaxError(modifiers.yield[1], 'yield is not allowed for struct');
            if (modifiers.partial)
              converted.push('partial ');
            break;
          }
          case 'fn': {
            current.kind = 'keyword.declarator';

            let leftBraceIndex = tokens.findIndex((s, j) => j > i && s.text == '{');
            if (leftBraceIndex == -1) {
              if (modifiers.partial !== null) {
                leftBraceIndex = tokens.findIndex((s, j) => j > i && s.text == ';');
                if (leftBraceIndex == -1)
                  throw new SyntaxError(current, 'Missing left brace');
                tokens[leftBraceIndex].kind = 'operator.other';
              }
              throw new SyntaxError(current, 'Missing left brace');
            } else {
              tokens[leftBraceIndex].kind = 'bracket.brace';
            }
            const atIndex = tokens.findIndex((s, j) => j > i && j < leftBraceIndex && s.text == '@');
            if (atIndex != -1) {
              if (container === 'fn')
                throw new SyntaxError(tokens[atIndex], 'Accessibility modifier is not allowed in function');
              tokens[atIndex].kind = 'operator.accessibility-annotation';
              const modifiers = searchModifiers(tokens.slice(atIndex + 1, leftBraceIndex), true);
              tokens.slice(atIndex + 1, leftBraceIndex).forEach(s => s.kind = 'modifier.after-at');
              converted.push(...modifiers.map(x => x.text + ' '));
            }

            if (modifiers.inheritance !== null)
              throw new SyntaxError(modifiers.inheritance[1], `${modifiers.inheritance} is not allowed for function`);
            if (modifiers.refImmut !== null)
              throw new SyntaxError(modifiers.refImmut[1], `${modifiers.refImmut} is not allowed for function`);
            if (modifiers.async)
              converted.push('async ');
            if (modifiers.yield) {
              // 特殊処理
            }
            if (modifiers.partial)
              converted.push('partial ');
            resetModifiers();

            const fnNameIndex = tokens.findIndex((s, j) => j > i && j < leftBraceIndex && (s.category == undefined || s.category == 'context_keyword'));
            if (fnNameIndex == -1) {
              throw new SyntaxError(current, 'Missing function name');
            }
            let genericsParamsEndIndex = fnNameIndex;
            const genericsParams: Token[] = [];
            for (let j = fnNameIndex + 1; j < leftBraceIndex; j++) {
              if (tokens[j].category !== 'space' && tokens[j].category !== 'line_break' && tokens[j].category !== 'comment') {
                if (tokens[j].text === '-') {
                  tokens[j].kind = 'operator.generics-params-annotation';
                  genericsParamsEndIndex = j;
                  let isAtSeparator = true;
                  for (let k = j + 1; k < leftBraceIndex; k++) {
                    if (tokens[k].category === 'space' || tokens[k].category === 'line_break' || tokens[k].category === 'comment') {
                      continue;
                    }
                    if (isAtSeparator) {
                      tokens[k].kind = 'name.generics-param';
                      genericsParams.push(tokens[k]);
                      isAtSeparator = false;
                      genericsParamsEndIndex = k;
                    } else {
                      if (tokens[k].text === '@') {
                        break;
                      } else if (tokens[k].text === '_' || (k + 1 < tokens.length && tokens[k + 1].text === ':')) {
                        break;
                      } else if (tokens[k].text === '/') {
                        tokens[k].kind = 'operator.generics-params-separator';
                        isAtSeparator = true;
                      } else {
                        throw new SyntaxError(tokens[k]);
                      }
                    }
                  }
                  if (genericsParams.length === 0) {
                    throw new SyntaxError(tokens[j], 'Missing generics parameter');
                  }
                } else {
                  break;
                }
              }
            }
            if (tokens[genericsParamsEndIndex + 1].category !== 'space' && tokens[genericsParamsEndIndex + 1].category !== 'line_break' && tokens[genericsParamsEndIndex + 1].category !== 'comment' && tokens[genericsParamsEndIndex + 1].text !== '{') {
              throw new SyntaxError(tokens[genericsParamsEndIndex + 1]);
            }
            tokens[fnNameIndex].kind = 'name.fn';

            if (tokens.slice(genericsParamsEndIndex + 1, atIndex === -1 ? leftBraceIndex : atIndex).findIndex(s => s.category !== 'space' && s.category !== 'line_break' && s.category !== 'comment') === -1) {
              if (genericsParams.length === 0)
                converted.push(`void ${tokens[fnNameIndex].text}() {\r\n`);
              else
                converted.push(`void ${tokens[fnNameIndex].text}<${genericsParams.map(x => x.text).join(', ')}>() {\r\n`);
            } else {
              const argsAndReturned = searchArgsAndReturned(tokens.slice(genericsParamsEndIndex + 1, atIndex === -1 ? leftBraceIndex : atIndex));
              const args = argsAndReturned.args.map(x => {
                return `${convertType(x.type, true, false)} ${x.name}`;
              }).join(', ');
              const returned = convertType(argsAndReturned.returned, false, true);

              if (genericsParams.length === 0)
                converted.push(`${returned} ${tokens[fnNameIndex].text}(${args}) {\r\n`);
              else
                converted.push(`${returned} ${tokens[fnNameIndex].text}<${genericsParams.map(x => x.text).join(', ')}>(${args}) {\r\n`);
            }

            let rightBraceIndex = -1;
            let braceCount = 1;
            for (let j = leftBraceIndex + 1; j < tokens.length; j++) {
              if (tokens[j].text == '{') {
                braceCount++;
              } else if (tokens[j].text == '}') {
                braceCount--;
                if (braceCount == 0) {
                  rightBraceIndex = j;
                  break;
                }
              }
            }
            if (rightBraceIndex == -1) {
              throw new SyntaxError(tokens[leftBraceIndex], 'Missing right brace');
            }
            const block = tokens.slice(leftBraceIndex + 1, rightBraceIndex);
            convertBlock(block, bracketCount + 1, 'fn');

            converted.push(`${' '.repeat(bracketCount * indexCount)}}\r\n`);

            i = rightBraceIndex + 1;
            break;
          }
          case 'let':
          case 'const':
          case '--immut': {
            current.kind = 'keyword.declarator';
            const varName = isNext(() => true, true, i + 1, tokens, false, true) as { result: boolean, index: number };
            if (varName.index === i + 1 || varName.result === false)
              throw new SyntaxError(current, 'Missing variable name');

            const assignmentIndex = tokens.findIndex((s, j) => j > varName.index && assignmentOperators.includes(s.text));

            const colonIndex = tokens.findIndex((s, j) => j > varName.index && j < assignmentIndex && s.text === ':');

            let declaratorIndex;
            if (colonIndex !== -1) {
              const atMarkIndex = tokens.findIndex((s, j) => j > varName.index && j < assignmentIndex && s.text === '@');

              if (container === 'fn' && atMarkIndex !== -1)
                throw new SyntaxError(tokens[atMarkIndex], 'Accessibility modifier is not allowed in function');

              const removed = removeEmptyWords(tokens.slice(colonIndex + 1, atMarkIndex === -1 ? assignmentIndex : atMarkIndex), true);
              const type = parseType(removed, false, true, false);
              if (type.type === null)
                throw new SyntaxError(tokens[colonIndex], 'Missing type');

              if (container === 'fn') {
                const unexpected = removed.slice(colonIndex + 1 + type.endAt + 1).findIndex(s => s.category !== 'comment' && s.category !== 'space' && s.category !== 'line_break');
                if (unexpected !== -1)
                  throw new SyntaxError(tokens[unexpected]);
              } else {
                if (atMarkIndex !== -1) {
                  const modifiers = searchModifiers(tokens.slice(atMarkIndex + 1, assignmentIndex), true)
                  converted.push(...modifiers.map(x => x.text + ' '));
                }
              }

              converted.push(convertType(type.type, false, false));
              declaratorIndex = converted.length - 1;
              converted.push(` ${tokens[varName.index].text} ${tokens[assignmentIndex].text} `);
            } else {
              if (container !== 'fn')
                throw new SyntaxError(tokens[varName.index], 'Type inference is only allowed for local variables');
              converted.push('var');
              declaratorIndex = converted.length - 1;
              converted.push(` ${tokens[varName.index].text} ${tokens[assignmentIndex].text} `);
            }

            resetModifiers();

            const rightSide = convertRightSide(tokens.slice(assignmentIndex + 1), converted);
            if (current.text === 'const') {
              if (rightSide.isConst) {
                converted.splice(declaratorIndex, 0, 'const ');
              } else {
                throw new SyntaxError(tokens[varName.index], 'Const must be initialized with constant value');
              }
            } else if (current.text === '--immut') {
              current.text = 'immut';
              if (container !== 'class' && container !== 'struct')
                throw new SyntaxError(tokens[varName.index], 'Immutable is only allowed for fields');
              if (colonIndex === -1)
                throw new SyntaxError(tokens[varName.index], 'Immutable is only allowed for fields with explicit type');
              converted.splice(declaratorIndex, 0, 'readonly ');
            }
            i = rightSide.endAt + assignmentIndex + 1;
            break;
          }
          case 'prop': {
            current.kind = 'keyword.declarator';

            const nameIndex = isNext(() => true, true, i + 1, tokens, false, true) as { result: boolean, index: number };
            if (nameIndex.result === false || (tokens[nameIndex.index].category !== 'context_keyword' && tokens[nameIndex.index].category !== undefined))
              throw new SyntaxError(current, 'Missing property name');

            const colonIndex = isNext(() => true, true, nameIndex.index, tokens, false, true) as { result: boolean, index: number };
            if (colonIndex.result === false || tokens[colonIndex.index].text !== ':')
              throw new SyntaxError(current, 'Missing colon');

            let assignmentIndex = -1;
            let atMarkIndex = -1;
            let isAssignmentArrow = false;
            let braceCount = 0;
            for (let j = colonIndex.index + 1; j < tokens.length; j++) {
              if ((assignmentOperators.includes(tokens[j].text) || tokens[j].text === '=>') && braceCount === 0 && assignmentIndex === -1) {
                assignmentIndex = j;
                if (tokens[j].text === '=>')
                  isAssignmentArrow = true;
                break;
              } else if (tokens[j].text === '@' && braceCount === 0) {
                atMarkIndex = j;
                if (assignmentIndex !== -1)
                  throw new SyntaxError(tokens[atMarkIndex], 'Accessibility modifier must be before assignment');
              } else if (tokens[j].text === '{') {
                braceCount++;
              } else if (tokens[j].text === '}') {
                braceCount--;
              }
            }
            if (assignmentIndex === -1) {
              throw new SyntaxError(tokens[nameIndex.index], 'Missing assignment or lambda expression');
            }

            let accessorLeftBraceIndex = -1;
            let accessorRightBraceIndex = -1;
            braceCount = 0;
            for (let j = colonIndex.index + 1; j < assignmentIndex; j++) {
              if (tokens[j].text === '{') {
                if (braceCount === 0 && isNext(token => token.text === 'get' || token.text === 'immut', true, j, tokens, false, false)) {
                  accessorLeftBraceIndex = j;
                  break;
                } else
                  braceCount++;
              } else if (tokens[j].text === '}') {
                braceCount--;
              }
            }
            if (accessorLeftBraceIndex > assignmentIndex)
              accessorLeftBraceIndex = -1;
            if (accessorLeftBraceIndex !== -1) {
              braceCount = 1;
              for (let j = accessorLeftBraceIndex + 1; j < tokens.length; j++) {
                if (tokens[j].text === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    accessorRightBraceIndex = j;
                    break;
                  }
                } else if (tokens[j].text === '{') {
                  braceCount++;
                }
              }
              if (accessorRightBraceIndex === -1 || accessorRightBraceIndex > assignmentIndex)
                throw new SyntaxError(tokens[accessorLeftBraceIndex], 'Missing right brace');
              const unexpected = indexOfNotBlankOrComment(accessorRightBraceIndex + 1, assignmentIndex);
              if (unexpected !== -1)
                throw new SyntaxError(tokens[unexpected]);
            }

            if (atMarkIndex === -1 && accessorLeftBraceIndex === -1) {
              // prop Value: int => <rightSide>;
              if (isAssignmentArrow === false)
                throw new SyntaxError(tokens[assignmentIndex], 'Without accessors, expression body is required');
              const type = parseType(removeEmptyWords(tokens.slice(colonIndex.index + 1, assignmentIndex), true), false, true, false);
              if (type.type === null)
                throw new SyntaxError(tokens[nameIndex.index], 'Missing type');
              converted.push(convertType(type.type, false, false));
              converted.push(` ${tokens[nameIndex.index].text} `);

              const nextToArrowToken = isNext(() => true, true, assignmentIndex + 1, tokens, true, false) as { result: boolean, item: Token | null };
              if (nextToArrowToken.item === null)
                throw new SyntaxError(tokens[assignmentIndex]);
              if (nextToArrowToken.item.text === '{') {
                let rightSideBraceIndex = -1;
                let braceCount = 1;
                for (let j = assignmentIndex + 1; j < tokens.length; j++) {
                  if (tokens[j].text === '{') {
                    braceCount++;
                  } else if (tokens[j].text === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                      rightSideBraceIndex = j;
                      break;
                    }
                  }
                }
                if (rightSideBraceIndex === -1)
                  throw new SyntaxError(nextToArrowToken.item, 'Missing right brace');

                converted.push('{\r\n');
                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                converted.push('get {\r\n');
                convertRightSide(tokens.slice(assignmentIndex + 1, rightSideBraceIndex), converted);
                converted.push('\r\n');
                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                converted.push('}\r\n');
                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                converted.push('}\r\n');

                i = rightSideBraceIndex;
              } else {
                converted.push('=> ');
                const rightSide = convertRightSide(tokens.slice(assignmentIndex + 1), converted);
                i = rightSide.endAt + assignmentIndex;
              }
            } else if (atMarkIndex !== -1 && accessorLeftBraceIndex === -1) {
              // prop Value: int @public => <rightSide>;
              if (isAssignmentArrow === false)
                throw new SyntaxError(tokens[assignmentIndex], 'Without accessors, expression body is required');

              const modifiers = searchModifiers(tokens.slice(atMarkIndex + 1, assignmentIndex), true);
              converted.push(...modifiers.map(x => x.text + ' '));

              const type = parseType(removeEmptyWords(tokens.slice(colonIndex.index + 1, atMarkIndex), true), false, true, false);
              if (type.type === null)
                throw new SyntaxError(tokens[nameIndex.index], 'Missing type');
              converted.push(convertType(type.type, false, false));
              converted.push(` ${tokens[nameIndex.index].text} `);

              const nextToArrowToken = isNext(() => true, true, assignmentIndex + 1, tokens, true, false) as { result: boolean, item: Token | null };
              if (nextToArrowToken.item === null)
                throw new SyntaxError(tokens[assignmentIndex]);
              if (nextToArrowToken.item.text === '{') {
                let rightSideBraceIndex = -1;
                let braceCount = 1;
                for (let j = assignmentIndex + 1; j < tokens.length; j++) {
                  if (tokens[j].text === '{') {
                    braceCount++;
                  } else if (tokens[j].text === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                      rightSideBraceIndex = j;
                      break;
                    }
                  }
                }
                if (rightSideBraceIndex === -1)
                  throw new SyntaxError(nextToArrowToken.item, 'Missing right brace');

                converted.push('{\r\n');
                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                converted.push('get {\r\n');
                convertBlock(tokens.slice(assignmentIndex + 1, rightSideBraceIndex), bracketCount + 1, 'fn');
                converted.push('\r\n');
                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                converted.push('}\r\n');
                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                converted.push('}\r\n');

                i = rightSideBraceIndex;
              } else {
                converted.push('=> ');
                const rightSide = convertRightSide(tokens.slice(assignmentIndex + 1), converted);
                i = rightSide.endAt + assignmentIndex;
              }
            } else if (accessorLeftBraceIndex !== -1 && atMarkIndex === -1) {
              // prop Value: int { get( @public); set; } = <rightSide>;
              if (isAssignmentArrow === true)
                throw new SyntaxError(tokens[assignmentIndex], 'With accessors, expression body is not allowed');

              const removed = removeEmptyWords(tokens.slice(colonIndex.index + 1, accessorLeftBraceIndex), true);
              const type = parseType(removed, false, true);
              if (type.type === null)
                throw new SyntaxError(tokens[nameIndex.index], 'Missing type');
              converted.push(convertType(type.type, false, false));

              converted.push(` ${tokens[nameIndex.index].text} `);

              const typeEndAt = tokens.findIndex(s => s.id === removed[type.endAt - 1].id);
              convertPropAccessor(typeEndAt + 1, assignmentIndex);

              converted.push(' = ');

              const rightSide = convertRightSide(tokens.slice(assignmentIndex + 1), converted);

              i = rightSide.endAt + assignmentIndex;
            } else if (accessorLeftBraceIndex !== -1 && atMarkIndex !== -1) {
              // prop Value: int { get; set; } @public = <rightSide>;
              if (isAssignmentArrow === true)
                throw new SyntaxError(tokens[assignmentIndex], 'With accessors, expression body is not allowed');

              const modifiers = searchModifiers(tokens.slice(atMarkIndex + 1, assignmentIndex), true);
              converted.push(...modifiers.map(x => x.text + ' '));

              const removed = removeEmptyWords(tokens.slice(colonIndex.index + 1, accessorLeftBraceIndex), true);
              const type = parseType(removed, false, true);
              if (type.type === null)
                throw new SyntaxError(tokens[nameIndex.index], 'Missing type');
              converted.push(convertType(type.type, false, false));

              converted.push(` ${tokens[nameIndex.index].text} `);

              const typeEndAt = tokens.findIndex(s => s.id === removed[type.endAt - 1].id);
              if (typeEndAt === -1)
                throw new UnhandledError(current);
              const propAccessor = convertPropAccessor(typeEndAt + 1, atMarkIndex);
              if (propAccessor.hasModifiers)
                throw new SyntaxError(tokens[atMarkIndex], 'Duplicate accessibility modifier');

              converted.push(' = ');

              const rightSide = convertRightSide(tokens.slice(assignmentIndex + 1), converted);

              i = rightSide.endAt + assignmentIndex;
            } else {
              throw new UnhandledError(current);
            }

            function convertPropAccessor(start: number, end: number): { hasModifiers: boolean } {
              const removed = removeEmptyWords(tokens.slice(start, end), true);
              if (removed[0].text !== '{')
                throw new SyntaxError(removed[0], 'Missing left brace');
              if (removed[removed.length - 1].text !== '}')
                throw new SyntaxError(removed[removed.length - 1], 'Missing right brace');

              const isAutoProp = removed.slice(1, removed.length - 1).findIndex(s => s.text === '{' || s.text === '=>') === -1;

              let hasModifiers = false;
              if (isAutoProp) {
                converted.push('{ ');

                let getterEndIndex = -1;
                if (removed[1].text === 'immut') {
                  if (removed[2].text === 'get')
                    if (removed[3].text === ';') {
                      converted.push('readonly get; ');
                      getterEndIndex = 3;
                    } else if (removed[3].text === '@') {
                      hasModifiers = true;
                      const semicolonIndex = removed.findIndex((s, j) => s.text === ';' && j > 3);
                      if (semicolonIndex === -1)
                        throw new SyntaxError(removed[getterEndIndex + 1], 'Missing semicolon');

                      const modifiers = searchModifiers(removed.slice(4, semicolonIndex), true);

                      converted.push(...modifiers.map(x => x.text + ' '));
                      converted.push('readonly get; ');

                      getterEndIndex = semicolonIndex;
                    } else
                      throw new SyntaxError(removed[3]);
                  else
                    throw new SyntaxError(removed[2]);
                }
                else if (removed[1].text === 'get') {
                  if (removed[2].text === ';') {
                    converted.push('get; ');
                    getterEndIndex = 2;
                  } else if (removed[2].text === '@') {
                    hasModifiers = true;
                    const semicolonIndex = removed.findIndex((s, j) => s.text === ';' && j > 2);
                    if (semicolonIndex === -1)
                      throw new SyntaxError(removed[2], 'Missing semicolon');

                    const modifiers = searchModifiers(removed.slice(3, semicolonIndex), true);

                    converted.push(...modifiers.map(x => x.text + ' '));
                    converted.push('get; ');

                    getterEndIndex = semicolonIndex;
                  } else
                    throw new SyntaxError(removed[2]);
                } else {
                  throw new SyntaxError(removed[1]);
                }

                if (getterEndIndex === -1)
                  throw new UnhandledError(removed[0]);

                let setterEndIndex = -1;
                if (removed[getterEndIndex + 1].text === 'immut') {
                  if (removed[getterEndIndex + 2].text === 'set' || removed[getterEndIndex + 2].text === 'init')
                    if (removed[getterEndIndex + 3].text === ';') {
                      converted.push(`readonly ${removed[getterEndIndex + 2].text}; `);
                      setterEndIndex = getterEndIndex + 3;
                    } else if (removed[getterEndIndex + 3].text === '@') {
                      hasModifiers = true;
                      const semicolonIndex = removed.findIndex((s, j) => s.text === ';' && j > getterEndIndex + 3);
                      if (semicolonIndex === -1)
                        throw new SyntaxError(removed[getterEndIndex + 1], 'Missing semicolon');

                      const modifiers = searchModifiers(removed.slice(getterEndIndex + 4, semicolonIndex), true);

                      converted.push(...modifiers.map(x => x.text + ' '));
                      converted.push(`readonly ${removed[getterEndIndex + 2].text}; `);

                      setterEndIndex = semicolonIndex;
                    }
                    else
                      throw new SyntaxError(removed[getterEndIndex + 3]);
                  else
                    throw new SyntaxError(removed[getterEndIndex + 2]);
                } else if (removed[getterEndIndex + 1].text === 'set' || removed[getterEndIndex + 1].text === 'init') {
                  if (removed[getterEndIndex + 2].text === ';') {
                    converted.push('set; ');
                    setterEndIndex = getterEndIndex + 2;
                  } else if (removed[getterEndIndex + 2].text === '@') {
                    hasModifiers = true;
                    const semicolonIndex = removed.findIndex((s, j) => s.text === ';' && j > getterEndIndex + 2);
                    if (semicolonIndex === -1)
                      throw new SyntaxError(removed[getterEndIndex + 2], 'Missing semicolon');

                    const modifiers = searchModifiers(removed.slice(getterEndIndex + 3, semicolonIndex), true);

                    converted.push(...modifiers.map(x => x.text + ' '));
                    converted.push(`${removed[getterEndIndex + 1].text}; `);

                    setterEndIndex = semicolonIndex;
                  } else
                    throw new SyntaxError(removed[getterEndIndex + 2]);
                } else if (removed[getterEndIndex + 1].text === '}') {
                  setterEndIndex = removed.length - 2;
                } else {
                  throw new SyntaxError(removed[getterEndIndex + 1]);
                }

                if (setterEndIndex === -1)
                  throw new UnhandledError(removed[0]);

                if (setterEndIndex !== removed.length - 2)
                  throw new SyntaxError(removed[setterEndIndex + 1]);

                converted.push('}');
                return { hasModifiers: hasModifiers };
              } else {
                let i = 1;

                converted.push('{\r\n');
                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                let preConverted = [];
                if (removed[i].text === 'immut') {
                  preConverted.push('readonly ');
                  i++;
                } else if (removed[i].text !== 'get')
                  throw new SyntaxError(removed[i]);
                if (removed[i].text === 'get') {
                  preConverted.push('get ');
                  i++;
                } else
                  throw new SyntaxError(removed[i]);

                if (removed[i].text === '@') {
                  const modifiersEndIndex = removed.findIndex((s, j) => (s.text === '=>' || s.text === '{') && j > i) - 1;
                  if (modifiersEndIndex === -2)
                    throw new SyntaxError(removed[i]);
                  const modifiers = searchModifiers(removed.slice(i + 1, modifiersEndIndex + 1), true);
                  converted.push(...modifiers.map(x => x.text + ' '));
                  i = modifiersEndIndex + 1;
                }
                converted.push(...preConverted);

                if ((removed[i].text === '=>' && removed[i + 1].text === '{') || removed[i].text === '{') {
                  converted.push('{\r\n');
                  i = removed[i].text === '=>' ? i + 2 : i + 1;
                  let parenthesisCount = 0;
                  let braceCount = 1;
                  let rightBraceIndex = -1;
                  for (let j = i; j < removed.length; j++) {
                    if (removed[j].text === '{') {
                      braceCount++;
                    } else if (removed[j].text === '}') {
                      braceCount--;
                      if (braceCount === 0 && parenthesisCount === 0) {
                        rightBraceIndex = j;
                        break;
                      }
                    } else if (removed[j].text === '(') {
                      parenthesisCount++;
                    } else if (removed[j].text === ')') {
                      parenthesisCount--;
                    }
                  }
                  if (rightBraceIndex === -1)
                    throw new SyntaxError(removed[i], 'Missing right brace');

                  convertBlock(removed.slice(i, rightBraceIndex), bracketCount + 2, 'fn');

                  converted.push(' '.repeat((bracketCount + 1) * indexCount));
                  converted.push('}\r\n');

                  i = rightBraceIndex + 1;
                } else if (removed[i].text === '=>') {
                  converted.push(' => ');
                  let parenthesisCount = 0;
                  let braceCount = 0;
                  let setIndex = -1;
                  for (let j = i + 1; j < removed.length; j++) {
                    if (removed[j].text === '{') {
                      braceCount++;
                    } else if (removed[j].text === '}') {
                      braceCount--;
                    } else if (removed[j].text === '(') {
                      parenthesisCount++;
                    } else if (removed[j].text === ')') {
                      parenthesisCount--;
                    } else if (removed[j].text === 'set' && braceCount === 0 && parenthesisCount === 0) {
                      setIndex = j;
                      break;
                    }
                  }
                  let withoutSet = false;
                  if (setIndex === -1) {
                    setIndex = end - start - 1;
                    withoutSet = true;
                  }

                  convertRightSide(removed.slice(i + 1, setIndex), converted);

                  if (withoutSet) {
                    converted.push(' '.repeat((bracketCount + 2) * indexCount));
                    converted.push('}\r\n');

                    return { hasModifiers: hasModifiers };
                  }

                  i = setIndex;
                } else {
                  throw new SyntaxError(removed[i]);
                }

                if (removed[i].text === ',' || removed[i].text === ';')
                  i++;

                converted.push(' '.repeat((bracketCount + 1) * indexCount));
                preConverted = [];
                if (removed[i].text === 'immut') {
                  preConverted.push('readonly ');
                  i++;
                } else if (removed[i].text !== 'set' && removed[i].text !== '}')
                  throw new SyntaxError(removed[i]);
                if (removed[i].text === 'set') {
                  preConverted.push('set ');
                  i++;
                } else if (removed[i].text === '}') {
                  preConverted.push(' '.repeat((bracketCount + 1) * indexCount));
                  preConverted.push('}');
                  return { hasModifiers: hasModifiers };
                } else
                  throw new SyntaxError(removed[i]);

                if (removed[i].text === '@') {
                  const modifiersEndIndex = removed.findIndex((s, j) => (s.text === '=>' || s.text === '{') && j > i) - 1;
                  if (modifiersEndIndex === -2)
                    throw new SyntaxError(removed[i]);
                  const modifiers = searchModifiers(removed.slice(i + 1, modifiersEndIndex + 1), true);
                  converted.push(...modifiers.map(x => x.text + ' '));
                  i = modifiersEndIndex + 1;
                }
                converted.push(...preConverted);

                if ((removed[i].text === '=>' && removed[i + 1].text === '{') || removed[i].text === '{') {
                  converted.push('{\r\n');
                  i = removed[i].text === '=>' ? i + 2 : i + 1;
                  let parenthesisCount = 0;
                  let braceCount = 1;
                  let rightBraceIndex = -1;
                  for (let j = i; j < removed.length; j++) {
                    if (removed[j].text === '{') {
                      braceCount++;
                    } else if (removed[j].text === '}') {
                      braceCount--;
                      if (braceCount === 0 && parenthesisCount === 0) {
                        rightBraceIndex = j;
                        break;
                      }
                    } else if (removed[j].text === '(') {
                      parenthesisCount++;
                    } else if (removed[j].text === ')') {
                      parenthesisCount--;
                    }
                  }
                  if (rightBraceIndex === -1)
                    throw new SyntaxError(removed[i], 'Missing right brace');

                  convertBlock(removed.slice(i, rightBraceIndex), bracketCount + 2, 'fn');

                  converted.push(' '.repeat((bracketCount + 1) * indexCount));
                  converted.push('}\r\n');

                  i = rightBraceIndex + 1;
                } else if (removed[i].text === '=>') {
                  converted.push(' => ');
                  let parenthesisCount = 0;
                  let braceCount = 1;
                  let setEndIndex = -1;
                  for (let j = i + 1; j < removed.length; j++) {
                    if (removed[j].text === '{') {
                      braceCount++;
                    } else if (removed[j].text === '}') {
                      braceCount--;
                      if (braceCount === -1 && parenthesisCount === 0) {
                        setEndIndex = j;
                      }
                    } else if (removed[j].text === '(') {
                      parenthesisCount++;
                    } else if (removed[j].text === ')') {
                      parenthesisCount--;
                    }
                  }
                  if (setEndIndex === -1) {
                    setEndIndex = end - start - 1;
                  }

                  convertRightSide(removed.slice(i + 1, setEndIndex), converted);

                  i = setEndIndex;
                } else {
                  throw new SyntaxError(removed[i]);
                }

                converted.push(' '.repeat(bracketCount * indexCount));
                converted.push('}');
                return { hasModifiers: hasModifiers };
              }
            }

            resetModifiers();
            break;
          }
          case 'using': {
            current.kind = 'keyword.other';

            if (container !== 'none' && container !== 'namespace')
              throw new SyntaxError(current, 'Using is not allowed');

            if (isModifiersChanged())
              throw new SyntaxError(current);

            const semicolonIndex = tokens.findIndex((s, j) => j > i && s.text === ';');
            if (semicolonIndex == -1) {
              throw new SyntaxError(current, 'Missing semicolon');
            }
            const removed = removeEmptyWords(tokens.slice(i + 1, semicolonIndex), true);
            const unexpectedIndex = removed.findIndex(s => (s.category !== 'context_keyword' && s.category !== undefined) && (s.text !== '.' && s.text !== ',' && s.text !== '@' && s.text !== 'static'));
            if (unexpectedIndex !== -1) {
              throw new SyntaxError(tokens[unexpectedIndex]);
            }

            interface Using {
              name: string | null;
              isStatic: boolean;
              isGlobal: boolean;
            }
            const usings: Using[] = [];
            const currentUsing: Using = { name: null, isStatic: false, isGlobal: false };
            let j = 0;
            while (j < removed.length) {
              if (removed[j].text === '@') {
                if (currentUsing.name === null || removed.length <= j + 1) {
                  throw new SyntaxError(removed[j]);
                }
                let commaIndex = removed.findIndex((s, k) => k > j && s.text === ',');
                if (commaIndex !== -1)
                  throw new SyntaxError(removed[commaIndex], 'After @, "static" and "global" are only allowed');
                for (let k = j + 1; k < removed.length; k++) {
                  if (removed[k].text === 'static') {
                    if (currentUsing.isStatic) {
                      throw new SyntaxError(removed[k], 'Duplicate static');
                    }
                    currentUsing.isStatic = true;
                  } else if (removed[k].text === 'global') {
                    if (currentUsing.isGlobal) {
                      throw new SyntaxError(removed[k], 'Duplicate global');
                    }
                    currentUsing.isGlobal = true;
                  } else {
                    throw new SyntaxError(removed[k]);
                  }
                }
                j += 2;
              }
              else {
                if (currentUsing.name === null) {
                  if (removed[j].category !== 'context_keyword' && removed[j].category !== undefined)
                    throw new SyntaxError(removed[j]);
                  currentUsing.name = removed[j].text;
                } else {
                  if (removed[j].text === ',') {
                    usings.push({ name: currentUsing.name, isStatic: currentUsing.isStatic, isGlobal: currentUsing.isGlobal });
                    currentUsing.name = null;
                    currentUsing.isStatic = false;
                    currentUsing.isGlobal = false;
                    j++;
                    continue;
                  }
                  if ((removed[j].category === 'operator' && isAccessor(removed[j].text)) === false && removed[j].category !== 'context_keyword' && removed[j].category !== undefined) {
                    throw new SyntaxError(removed[j]);
                  }
                  currentUsing.name += removed[j].text;
                }
                j++;
              }
            }

            if (currentUsing.name !== null)
              usings.push(currentUsing);

            if (usings.length === 0)
              throw new SyntaxError(current, 'Missing using name');
            const containsStatic = usings.findIndex(s => s.isStatic) !== -1;
            const containsGlobal = usings.findIndex(s => s.isGlobal) !== -1;
            for (let using of usings) {
              converted.push(`${containsGlobal ? 'global ' : ''}using ${containsStatic ? 'static ' : ''}${using.name};\r\n`);
            }
            break;
          }
          case 'abstract':
          case 'new':
          case 'override':
          case 'virtual': {
            if (isNextBlankOrComment())
              throw new SyntaxError(tokens[i + 1]);

            converted.pop();

            current.kind = 'modifier.other';
            if (modifiers.inheritance !== null) {
              if (modifiers.inheritance[0] === current.text)
                throw new SyntaxError(current, `Duplicate ${current.text}`);
              else
                throw new SyntaxError(current, `${current.text} cannot be used with ${modifiers.inheritance}`);
            }
            modifiers.inheritance = [current.text, current];
            modifiers.latestModifier = current.text;
            break;
          }
          case 'ref': {
            if (isNextBlankOrComment())
              throw new SyntaxError(tokens[i + 1]);

            converted.pop();

            current.kind = 'modifier.other';
            if (modifiers.refImmut === null)
              modifiers.refImmut = ['ref', current];
            else if (modifiers.refImmut[0] === 'immut') {
              if (modifiers.latestModifier !== 'immut')
                throw new SyntaxError(current, 'ref and immut must be used together');
              modifiers.refImmut = ['immut ref', { content: 'immut ref', start: modifiers.refImmut[1].start, end: current.end }];
            } else
              throw new SyntaxError(current, 'Duplicate ref');
            modifiers.latestModifier = current.text;
            break;
          }
          case 'immut': {
            if (isNextBlankOrComment())
              throw new SyntaxError(tokens[i + 1]);

            converted.pop();

            if (container === 'class' || container === 'struct') {
              const nextToken = isNext(() => true, true, i + 1, tokens, true, false) as { result: boolean, item: Token | null };
              if (nextToken.item === null)
                throw new SyntaxError(current);
              if (nextToken.item.category === undefined || nextToken.item.category === 'context_keyword') {
                current.kind = 'keyword.declarator';
                current.text = '--immut';
                i--;
                continue;
              }
            }

            current.kind = 'modifier.other';
            if (modifiers.refImmut === null)
              modifiers.refImmut = ['immut', current];
            else if (modifiers.refImmut[0] === 'ref') {
              if (modifiers.latestModifier !== 'ref')
                throw new SyntaxError(current, 'ref and immut must be used together');
              modifiers.refImmut = ['ref immut', { content: 'ref immut', start: modifiers.refImmut[1].start, end: current.end }];
            } else
              throw new SyntaxError(current, 'Duplicate immut');
            modifiers.latestModifier = current.text;
            break;
          }
          case 'async': {
            if (isNextBlankOrComment())
              throw new SyntaxError(tokens[i + 1]);

            converted.pop();

            current.kind = 'modifier.other';
            if (modifiers.async)
              throw new SyntaxError(current, 'Duplicate async');
            modifiers.async = [true, current];
            modifiers.latestModifier = current.text;
            break;
          }
          case 'yield': {
            if (isNextBlankOrComment())
              throw new SyntaxError(tokens[i + 1]);

            converted.pop();

            current.kind = 'modifier.other';
            if (modifiers.yield)
              throw new SyntaxError(current, 'Duplicate yield');
            modifiers.yield = [true, current];
            modifiers.latestModifier = current.text;
            break;
          }
          case 'partial': {
            if (isNextBlankOrComment())
              throw new SyntaxError(tokens[i + 1]);

            converted.pop();

            current.kind = 'modifier.other';
            if (modifiers.partial)
              throw new SyntaxError(current, 'Duplicate partial');
            modifiers.partial = [true, current];
            modifiers.latestModifier = current.text;
            break;
          }
          default: {
            if (isModifiersChanged())
              throw new SyntaxError(current);

            const rightSide = convertRightSide(tokens.slice(i), converted);
            i += rightSide.endAt;
            break;
          }
        }

        for (let j = i; j < tokens.length; j++) {
          if (tokens[j].text == ';') {
            i = j + 1;
          } else {
            break;
          }
        }
      }

      i++;
    }

    function isNextBlankOrComment(indexOverride: null | number = null, tokensOverride: null | Token[] = null) {
      const tokensToUse = tokensOverride || tokens;
      const indexToUse = indexOverride || i;
      if (tokensToUse[indexToUse].category === 'space' || tokensToUse[indexToUse].category === 'line_break' || tokensToUse[indexToUse].category === 'comment')
        return true;
      return false;
    }

    function isInNotBlankOrComment(startIndex: number, endIndex: number, tokensOverride: null | Token[] = null) {
      const tokensToUse = tokensOverride || tokens;
      for (let j = startIndex; j < endIndex; j++) {
        if (tokensToUse[j].category !== 'space' && tokensToUse[j].category !== 'line_break' && tokensToUse[j].category !== 'comment')
          return false;
      }
      return true;
    }
    function indexOfNotBlankOrComment(startIndex: number, endIndex: number, tokensOverride: null | Token[] = null) {
      const tokensToUse = tokensOverride || tokens;
      for (let j = startIndex; j < endIndex; j++) {
        if (tokensToUse[j].category !== 'space' && tokensToUse[j].category !== 'line_break' && tokensToUse[j].category !== 'comment')
          return j;
      }
      return -1;
    }

    return;
  }

  function searchModifiers(tokens: Token[], doMarkKind: boolean) {
    const modifiers = [];
    for (let token of tokens) {
      if (token.category === 'space' || token.category === 'line_break' || token.category === 'comment')
        continue;
      if (modifierOfAfterAt.has(token.text)) {
        if (doMarkKind)
          token.kind = 'modifier.after-at';
        modifiers.push(token);
      } else {
        throw new SyntaxError(token);
      }
    }
    if (tokens.length === 0 || modifiers.length === 0)
      throw new SyntaxError(tokens[0], 'Missing modifier');
    return modifiers;
  }
  function isNextIndexer(tokens: Token[]): boolean {
    let passedThis = false;
    for (let token of tokens) {
      if (token.category === 'space' || token.category === 'line_break' || token.category === 'comment')
        continue;
      if (passedThis) {
        if (token.text === '#')
          return true;
        else
          return false;
      } else {
        if (token.text === 'this') {
          passedThis = true;
          continue;
        }
      }
    }
    return false;
  }
}


function trimEmptyWords(tokens: Token[], doMarkKind: boolean) {
  let start = 0;
  let end = tokens.length - 1;

  if (tokens.length === 0)
    return tokens;

  while (tokens[start].category === 'space' || tokens[start].category === 'line_break' || tokens[start].category === 'comment') {
    if (doMarkKind) {
      switch (tokens[start].category) {
        case 'space':
          tokens[start].kind = 'space.space';
          break;
        case 'line_break':
          tokens[start].kind = 'space.line-break';
          break;
        case 'comment':
          tokens[start].kind = 'comment.line';
          break;
      }
    }
    start++;
  }

  while (tokens[end].category === 'space' || tokens[end].category === 'line_break' || tokens[start].category === 'comment') {
    if (doMarkKind) {
      switch (tokens[end].category) {
        case 'space':
          tokens[end].kind = 'space.space';
          break;
        case 'line_break':
          tokens[end].kind = 'space.line-break';
          break;
        case 'comment':
          tokens[end].kind = 'comment.line';
          break;
      }
    }
    end--;
  }

  return tokens.slice(start, end + 1);
}
function removeEmptyWords(tokens: Token[], doMarkKind: boolean) {
  if (doMarkKind) {
    const result = [];
    for (let word of tokens) {
      if (word.category === 'space' || word.category === 'line_break' || word.category === 'comment') {
        switch (word.category) {
          case 'space':
            word.kind = 'space.space';
            break;
          case 'line_break':
            word.kind = 'space.line-break';
            break;
          case 'comment':
            word.kind = 'comment.line';
            break;
        }
      } else {
        result.push(word);
      }
    }
    return result;
  }
  else
    return tokens.filter(s => s.category !== 'space' && s.category !== 'line_break' && s.category !== 'comment');
}

function findComment(str: string) {
  const captures = commentRegex.exec(str);
  if (captures == null) return null;
  const length = captures.slice(1).reduce((a, b) => a + (b ? b.length : 0), 0)
  return {
    text: str.slice(captures.index, captures.index + length),
    start: captures.index,
    end: captures.index + length,
    isBlock: captures[3] !== undefined
  };
}
function findStringLiteral(str: string) {
  const captures = stringLiteralRegex.exec(str);
  if (captures == null) return null;
  let text, start, end;
  if (captures.length === 1) {
    text = captures[0];
    start = captures.index;
    end = captures.index + captures[0].length;
  } else {
    text = captures.slice(1).join('');
    let length = captures.slice(1).reduce((a, b) => a + (b ? b.length : 0), 0);
    if ((text.startsWith('@') || text.startsWith('$')) === false && captures.length >= 10 && captures[9] === undefined) {
      text += '"';
    }
    start = captures.index;
    end = captures.index + length;
  }
  return { text, start, end };
}
const escapesInRawStringLiteral = /\\`/g;
function findRawStringLiteral(str: string) {
  const captures = rawStringLiteralRegex.exec(str);
  if (captures == null) return null;
  let text = captures[0];
  if (text.endsWith('`')) {
    const startBackQuoteIndex = text.indexOf('`');
    const endBackQuoteIndex = text.lastIndexOf('`');
    let safeMultiQuoteCount = 3;
    for (let i = 3; i < Number.MAX_SAFE_INTEGER; i++) {
      if (text.indexOf('"'.repeat(i)) === -1) {
        safeMultiQuoteCount = i;
        break;
      }
    }
    text = text.slice(0, startBackQuoteIndex) + '"'.repeat(safeMultiQuoteCount) + text.slice(startBackQuoteIndex + 1, endBackQuoteIndex) + '"'.repeat(safeMultiQuoteCount);
    text = text.replace(escapesInRawStringLiteral, '`');
  }
  return {
    text,
    start: captures.index,
    end: captures.index + captures[0].length
  };
}
function findCharLiteral(str: string) {
  const captures = charLiteralRegex.exec(str);
  if (captures == null) return null;
  let text = captures[2];
  return {
    text: "'" + text + "'",
    start: captures.index,
    end: captures.index + text.length + (captures[3] === undefined ? 1 : 2),
  };
}
function isAccessor(text: string): text is '.' | '?.' | '!.' {
  // const o = {};
  // RETURN(o) = o;
  return text === '.' || text === '?.' || text === '!.';
}

function isNext(predicate: (token: Token) => boolean, skipToNonBlankOrComment = true, index: number, tokens: Token[], returnEvaluatedItem = false, returnNextIndex = false): boolean | { result: boolean, item: Token | null } | { result: boolean, index: number } {
  if (index + 1 >= tokens.length) {
    if (returnEvaluatedItem)
      return { result: false, item: null };
    else if (returnNextIndex)
      return { result: false, index: -1 };
    else
      return false;
  }

  let next;
  if (skipToNonBlankOrComment) {
    for (let j = index + 1; j < tokens.length; j++) {
      if (tokens[j].category !== 'space' && tokens[j].category !== 'line_break' && tokens[j].category !== 'comment') {
        next = tokens[j];
        break;
      }
    }
    if (!next) {
      if (returnEvaluatedItem)
        return { result: false, item: null };
      else if (returnNextIndex)
        return { result: false, index: -1 };
      else
        return false;
    }
  } else {
    next = tokens[index + 1];
  }
  if (returnEvaluatedItem)
    return { result: predicate(next), item: next };
  else if (returnNextIndex)
    return { result: predicate(next), index: tokens.indexOf(next) };
  else
    return predicate(next);
}
async function RETURN(t: {}) {
  await A();
  return t;

  function A(): Promise<number> {
    return new Promise((resolve, reject) => {
      resolve(0);
    });
  }
}
