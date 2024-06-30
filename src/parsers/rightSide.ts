import { SyntaxError, UnhandledError, Token, isNext, isMethodKeyword, operators, removeEmptyWords, isExprKeyword, convertBlock, converted, indentCount } from "../convert";
import { convertSwitch } from "./switch";
import { Type, convertType, parseFunctionType, parseType } from "./typeAndVariable";

export { convertRightSide, noSpacesOperators, withSpacesOperators, noLeftSpacesRightSpaceOperators, leftSpaceNoRightSpacesOperators };


const lambdaInputConnectOperators = new Set(['.', ',', '(', ')', '?', ':', '-', '/', '=>', '~', '#', '::']);
const noSpacesOperators = new Set(['.', '(', ')', '<', '>', '[', ']', '++', '--', '!', '?.', '!.', '::', '@', '$']);
const withSpacesOperators = new Set(['?', ':', '=', '+', '+=', '-', '-=', '*', '*=', '/', '/=', '%', '%=', '??', '??=', '<<', '<<=', '>>', '>>=', '>>>', '>>>=', '&', '&=', '^', '^=', '|', '|=', '==', '!=', '<=', '>=', '<', '>', '&&', '||', '=>']);
const noLeftSpacesRightSpaceOperators = new Set([',', ';', '{']);
const leftSpaceNoRightSpacesOperators = new Set(['}']);
/**
 * 
 * @param tokens 
 * @param converted 
 * @param assigningVar 変数に代入する形式であるかどうか、代入する場合は{ name: 変数の名前, type: trueならば型推論可能、そうでない場合は変数の型 }、代入しない場合はnull
 * @param canBlockSwitch switchを式ではなくブロックの形に変換できるかどうか（式: a switch {}、ブロック: switch(a) {}）
 * @param insertIndex 自動生成の関数を挿入するconvertedにおけるインデックス
 * @param convertBlockFunc 
 * @param indentLevel 
 * @param indentCount 
 * @returns 
 */
function convertRightSide(tokens: Token[], insertIndex: number, assigningType: null | true | Type, indentLevel: number, changeToYieldReturn = false): {
  endAt: number;
  isConst: boolean;
} {
  let lastBoundaryIndex = converted.length;
  let isConst = true;
  const spaceIndexes: Set<number> = new Set();

  let endAt = parseExpr(tokens, false, false);
  if (converted[converted.length - 1] !== ';') {
    converted.push(';\r\n');
  }

  const spaceIndexesArray = Array.from(spaceIndexes);
  spaceIndexesArray.sort((a, b) => a - b);
  for (let i = spaceIndexesArray.length - 1; i >= 0; i--) {
    const index = spaceIndexesArray[i];
    if (index === 0)
      continue;
    converted.splice(index, 0, ' ');
  }

  return { endAt, isConst };

  function parseExpr(tokens: Token[], isInArgs = false, earlyReturn = false): number {
    const initialConvertedLength = converted.length;
    let isInTuple = false;
    let isAsync = false;
    let isAfterFn = 0;
    let afterFnIndex = 0;
    let currentIsSpace = false;
    let previousIsSpace = false;

    for (let i = 0; i < tokens.length; i++) {
      const current = tokens[i];

      previousIsSpace = currentIsSpace;

      if (current.category === 'space') {
        currentIsSpace = true;
        continue;
      } else {
        currentIsSpace = false;
      }

      if (current.category === 'line_break' || current.category === 'comment') {
        continue;
      }

      isAfterFn--;
      if (current.text === ';' || current.text === ',' || current.text === '{' || current.text === '}') {
        if (current.text === ',' && isInArgs === false) {
          if (isInTuple) {
            converted.push(')');
            isInTuple = false;
          }
          converted.push(',');
          spaceIndexes.add(converted.length);
          lastBoundaryIndex = converted.length;
          continue;
        }
        if (isInTuple) {
          if (converted[converted.length - 1] === ',') {
            converted.pop();
          }
          converted.push(')');
        }
        lastBoundaryIndex = converted.length;
        if (current.text === '{' || current.text === '}')
          return i - 1;
        return i;
      } else if (isMethodKeyword(current.kind) || isExprKeyword(current.kind)) {
        if (current.text === 'default' && isNext(token => token.category === undefined || token.category === 'context_keyword' || token.text === '(', true, i, tokens) === false) {
          converted.push('default');
          lastBoundaryIndex = converted.length - 1;
        } else if (current.kind === 'keyword.block-or-method' && (isNext(token => token.text === ';' || token.text === '{', true, i, tokens))) {
          converted.push(current.text);
          converted.push(' {');
        } else {
          const isMethod = isMethodKeyword(current.kind);
          let fnStartIndex = converted.length;
          isConst = false;
          converted.push(current.text);
          if (isMethod)
            converted.push('(');
          else
            converted.push(' ');
          lastBoundaryIndex = converted.length;
          const firstArgIndex = isNext(() => true, true, i, tokens, false, true) as { result: boolean, index: number };
          if (firstArgIndex.index === -1)
            throw new SyntaxError(tokens[i - 1]);
          i = firstArgIndex.index - 1;

          let pushPeriod = false;
          if (tokens[firstArgIndex.index].text === ';') {
            i = firstArgIndex.index;
            if (isMethod && earlyReturn === false && isNext(token => token.category === 'context_keyword' || token.category === undefined, false, firstArgIndex.index, tokens)) {
              converted.push(')', '.');
              pushPeriod = true;
            } else {
              if (isMethod)
                converted.push(')');
            }
          } else {
            while (true) {
              i += parseExpr(tokens.slice(i + 1), true) + 1;
              if (tokens.length <= i) {
                break;
              }
              pushPeriod = false;
              if (tokens[i].text === ',') {
                converted.push(',');
                spaceIndexes.add(converted.length);
                lastBoundaryIndex = converted.length;
              } else if (tokens[i].text === ';') {
                if (isMethod && earlyReturn === false && isNext(token => token.category === 'context_keyword' || token.category === undefined, false, i, tokens)) {
                  converted.push(')', '.');
                  pushPeriod = true;
                } else {
                  if (isMethod)
                    converted.push(')');
                }
                break;
              }
            }
          }
          if (isInArgs && isNext(token => token.text !== ';', true, i, tokens)) {
            converted.push(',');
            spaceIndexes.add(converted.length);
          }

          if (isInArgs === false && !pushPeriod) {
            isAfterFn = 1;
            afterFnIndex = i;
          }

          lastBoundaryIndex = fnStartIndex;
        }
      } else if (current.text === '(') {
        const isNextTilde = isNext(token => token.text === '~', true, i, tokens, false, true) as { result: boolean, index: number };
        if (isNextTilde.result) {
          converted.push('(', '~');
          i = isNextTilde.index;
          lastBoundaryIndex = converted.length;
          continue;
        }
        let parenthesisCount = 1;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].text === '(') {
            parenthesisCount++;
          } else if (tokens[j].text === ')') {
            parenthesisCount--;
            if (parenthesisCount === 0) {
              const leftParenthesisIndexAtConverted = converted.length;
              const previousConvertedLength = converted.length;
              converted.push('(');
              lastBoundaryIndex = converted.length;
              i += parseExpr(tokens.slice(i + 1, j)) + 1;
              if (converted[leftParenthesisIndexAtConverted + 1] === '(' && converted[converted.length - 1] === ')') {
                shiftSpaceIndexes(leftParenthesisIndexAtConverted);
                converted.splice(leftParenthesisIndexAtConverted, 1);
              } else {
                converted.push(')');
              }
              lastBoundaryIndex = previousConvertedLength;
              break;
            }
          }
        }
      } else if (current.text === '#') {
        isConst = false;
        if (tokens.length === i - 1) {
          converted.push('[', ']');
        } else if (isNext(token => token.category !== 'operator' || token.text === '++' || token.text === '--', true, i, tokens)) {
          converted.push('[');
          lastBoundaryIndex = converted.length;
          while (true) {
            i += parseExpr(tokens.slice(i + 1), false, true) + 1;
            if (tokens.length <= i) {
              break;
            }
            if (tokens[i].text === ',') {
              converted.push(',');
              spaceIndexes.add(converted.length);
              lastBoundaryIndex = converted.length;
            } else if (tokens[i].text === ';') {
              if (earlyReturn === false && isNext(token => token.category === 'context_keyword' || token.category === undefined, false, i, tokens)) {
                converted.push(']', '.');
              } else {
                converted.push(']');
              }
              break;
            }
          }

          if (isInArgs === false) {
            isAfterFn = 1;
            afterFnIndex = i;
          }
        } else {
          converted.push('[', ']');
        }
      } else if (current.text === '~') {
        isConst = false;
        if (isInTuple === false) {
          converted.splice(lastBoundaryIndex, 0, '(');
          if (isAsync === false)
            shiftSpaceIndexes(lastBoundaryIndex);
          isInTuple = true;
        }
        converted.push(',');
        spaceIndexes.add(converted.length);
      } else if (current.text === '=>') {
        isConst = false;
        let parenthesesCount = 0;
        let isBroken = false;
        for (let j = i - 1; j >= 0; j--) {
          if (operators.includes(tokens[j].text) && lambdaInputConnectOperators.has(tokens[j].text) === false && tokens[j].text !== 'async') {
            if (parenthesesCount === 0) {
              shiftSpaceIndexes(j + 1);
              converted.splice(j + 1, 0, '(');
              lastBoundaryIndex = j + 1;

              if (isInTuple) {
                if (converted[converted.length - 1] === ',') {
                  converted.pop();
                }
                converted.push(')');
                isInTuple = false;
              }
              isBroken = true;
              break;
            }
            if (tokens[j].text === '(') {
              parenthesesCount--;
            } else if (tokens[j].text === ')') {
              parenthesesCount++;
            }
          }
        }
        if (isBroken === false) {
          if (converted[initialConvertedLength] === 'async') {
            shiftSpaceIndexes(initialConvertedLength + 2);
            converted.splice(initialConvertedLength + 1, 0, '(');
            lastBoundaryIndex = initialConvertedLength;
          } else {
            shiftSpaceIndexes(initialConvertedLength);
            converted.splice(initialConvertedLength, 0, '(');
            lastBoundaryIndex = initialConvertedLength;
          }

          if (isInTuple) {
            if (converted[converted.length - 1] === ',') {
              converted.pop();
            }
            converted.push(')');
            isInTuple = false;
          }
        }

        converted.push(')', '=>');
        spaceIndexes.add(converted.length - 1);

        const next = isNext(token => token.text === '{', true, i, tokens, false, true) as { result: boolean, index: number };
        if (next.result) {
          spaceIndexes.add(converted.length);
          converted.push('{\r\n');
          let braceCount = 1;
          let endBraceIndex = -1;
          for (let j = next.index + 1; j < tokens.length; j++) {
            if (tokens[j].text === '{') {
              braceCount++;
            } else if (tokens[j].text === '}') {
              braceCount--;
              if (braceCount === 0) {
                endBraceIndex = j;
                break;
              }
            }
          }
          if (endBraceIndex === -1)
            throw new SyntaxError(tokens[i], 'Missing right brace');
          convertBlock(tokens.slice(i + 1, endBraceIndex), 'fn', indentLevel + 1, false, false);
          converted.push(' '.repeat(indentLevel * indentCount));
          converted.push('}');
          i = endBraceIndex;
        }
      } else if (current.text === 'fn' && current.category === 'keyword' && isNext(token => token.text === ':' || token.text === '?', true, i, tokens, false, false) === true) {
        isConst = false;
        let nullable = false;
        if (tokens.length > i + 1 && tokens[i + 1].text === '?') {
          nullable = true;
          i++;
        }
        const nextToFn = isNext(token => token.text === ':', true, i, tokens, true) as { result: boolean, item: Token | null };
        if (nextToFn.result && nextToFn.item) {
          const nextToFnIndex = tokens.indexOf(nextToFn.item);
          if (nextToFnIndex === -1) {
            throw new UnhandledError(tokens[i]);
          }
          const removed = removeEmptyWords(tokens.slice(nextToFnIndex + 1), true);
          const fnType = parseFunctionType(removed, false, false, false, true);
          if (nullable)
            fnType.type.nullable = true;
          converted.push(convertType(fnType.type, false, false));
          const endTokenIndex = tokens.indexOf(removed[fnType.endAt - 1]);
          if (endTokenIndex === -1) {
            throw new UnhandledError(removed[fnType.endAt - 1]);
          }
          i = endTokenIndex;
        } else {
          throw new SyntaxError(current);
        }
      } else if (current.text === ':') {
        isConst = false;
        const removed = removeEmptyWords(tokens.slice(i + 1), true);
        const type = parseType(removed, false, true, false);
        if (type.type === null || type.endAt === 0)
          throw new SyntaxError(removed[0], 'Missing type');
        converted.splice(converted.length - 1, 0, convertType(type.type, false, false));
        spaceIndexes.add(converted.length - 1);
        i = tokens.findIndex(token => token.id === removed[type.endAt - 1].id);
      } else if (isAfterFn === 0 && ((current.category !== 'operator' && current.kind !== 'keyword.operator') || current.text === '{' || current.text === '}' || current.text === '(' || current.text === ')')) {
        return afterFnIndex;
      } else if (current.text === 'async') {
        converted.push('async');
        lastBoundaryIndex = converted.length;
        spaceIndexes.add(converted.length);
        isAsync = true;
      } else if (current.text === 'switch') {
        let braceCount = 0;
        let endBraceIndex = -1;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].text === '{') {
            braceCount++;
          } else if (tokens[j].text === '}') {
            braceCount--;
            if (braceCount === 0) {
              endBraceIndex = j;
              break;
            }
          }
        }
        if (endBraceIndex === -1)
          throw new SyntaxError(tokens[i], 'Missing right brace');

        const endAt = convertSwitch(tokens.slice(i, endBraceIndex + 1), insertIndex, assigningType, indentLevel, false);
        i = endAt;
      } else {
        if (current.category === undefined || current.category === 'keyword' || current.category === 'context_keyword')
          isConst = false;
        converted.push(current.text);

        if (previousIsSpace)
          spaceIndexes.add(converted.length - 1);
      }

      if (withSpacesOperators.has(converted[converted.length - 1])) {
        spaceIndexes.add(converted.length - 1);
        spaceIndexes.add(converted.length);
      }
      else if (noLeftSpacesRightSpaceOperators.has(converted[converted.length - 1])) {
        spaceIndexes.add(converted.length);
      } else if (leftSpaceNoRightSpacesOperators.has(converted[converted.length - 1])) {
        spaceIndexes.add(converted.length - 1);
      }
    }

    if (isInTuple) {
      if (converted[converted.length - 1] === ',') {
        converted.pop();
      }
      converted.push(')');
    }

    lastBoundaryIndex = converted.length;
    return tokens.length;
  }

  function shiftSpaceIndexes(start: number, shift = 1) {
    const spaceIndexesArray = Array.from(spaceIndexes);
    spaceIndexesArray.sort((a, b) => a - b);
    if (shift > 0) {
      for (let i = spaceIndexesArray.length - 1; i >= 0; i--) {
        const index = spaceIndexesArray[i];
        if (index >= start) {
          spaceIndexes.delete(index);
          spaceIndexes.add(index + shift);
        }
      }
    } else {
      for (let i = 0; i < spaceIndexesArray.length; i++) {
        const index = spaceIndexesArray[i];
        if (index >= start) {
          spaceIndexes.delete(index);
          spaceIndexes.add(index + shift);
        }
      }
    }
  }
}
