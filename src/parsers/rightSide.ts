import { SyntaxError, UnhandledError, Token, isNext, isMethodKeyword, operators, removeEmptyWords } from "../convert";
import { convertType, parseFunctionType } from "./typeAndVariable";

export { convertRightSide };


const lambdaInputConnectOperator = ['.', ',', '(', ')', '?', ':', '-', '/', '=>', '~', '#', '::'];

function convertRightSide(tokens: Token[], converted: string[]): {
  endAt: number;
  isConst: boolean;
} {
  const initialConvertedLength = converted.length;
  let lastBoundaryIndex = converted.length;
  let isConst = true;

  const endAt = parseExpr(tokens, false, false);
  if (converted[converted.length - 1] !== ';') {
    converted.push(';\r\n');
    return { endAt: endAt + 1, isConst };
  }
  // ↓仮
  throw new SyntaxError(tokens[endAt], '; is needed at the end of the line')
  return { endAt, isConst };

  function parseExpr(tokens: Token[], isInArgs = false, earlyReturn = false): number {
    let isInTuple = false;

    for (let i = 0; i < tokens.length; i++) {
      const current = tokens[i];
      if (current.category === 'space' || current.category === 'line_break' || current.category === 'comment') {
        continue;
      } else if (current.text === ';' || current.text === ',') {
        if (current.text === ',' && isInArgs === false) {
          if (isInTuple) {
            converted.push(')');
            isInTuple = false;
          }
          converted.push(',');
          lastBoundaryIndex = converted.length;
          continue;
        }
        if (isInTuple) {
          if (converted[converted.length - 1] === ', ') {
            converted.pop();
          }
          converted.push(')');
        }
        lastBoundaryIndex = converted.length;
        return i;
      } else if (isMethodKeyword(current.kind)) {
        isConst = false;
        converted.push(current.text);
        converted.push('(');
        lastBoundaryIndex = converted.length;
        while (true) {
          i += parseExpr(tokens.slice(i + 1), true) + 1;
          if (tokens.length <= i) {
            break;
          }
          if (tokens[i].text === ',') {
            converted.push(', ');
            lastBoundaryIndex = converted.length;
          } else if (tokens[i].text === ';') {
            if (earlyReturn === false && isNext(token => token.category === 'context_keyword' || token.category === undefined, false, i, tokens)) {
              converted.push(')');
              converted.push('.');
            } else {
              converted.push(')');
            }
            break;
          }
        }
        if (isInArgs)
          converted.push(', ');
      } else if (current.text === '(') {
        const isNextTilde = isNext(token => token.text === '~', true, i, tokens, false, true) as { result: boolean, index: number };
        if (isNextTilde.result) {
          converted.push('(');
          converted.push('~');
          i = isNextTilde.index;
          lastBoundaryIndex = converted.length;
          continue;
        }
        let parenthesesCount = 1;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].text === '(') {
            parenthesesCount++;
          } else if (tokens[j].text === ')') {
            parenthesesCount--;
            if (parenthesesCount === 0) {
              const leftParenthesisIndexAtConverted = converted.length;
              converted.push('(');
              const previousConvertedLength = converted.length;
              i += parseExpr(tokens.slice(i + 1, j)) + 1;
              if (converted[leftParenthesisIndexAtConverted + 1] === '(' && converted[converted.length - 1] === ')') {
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
          converted.push('[]');
        } else if (isNext(token => token.category !== 'operator' || token.text === '++' || token.text === '--', true, i, tokens)) {
          converted.push('[');
          lastBoundaryIndex = converted.length;
          while (true) {
            i += parseExpr(tokens.slice(i + 1), false, true) + 1;
            if (tokens.length <= i) {
              break;
            }
            if (tokens[i].text === ',') {
              converted.push(', ');
              lastBoundaryIndex = converted.length;
            } else if (tokens[i].text === ';') {
              if (earlyReturn === false && isNext(token => token.category === 'context_keyword' || token.category === undefined, false, i, tokens)) {
                converted.push(']');
                converted.push('.');
              } else {
                converted.push(']');
              }
              break;
            }
          }
        } else {
          converted.push('[]');
        }
      } else if (current.text === '~') {
        isConst = false;
        if (isInTuple === false) {
          converted.splice(lastBoundaryIndex, 0, '(');
          isInTuple = true;
        }
        converted.push(', ');
      } else if (current.text === '=>') {
        isConst = false;
        let parenthesesCount = 0;
        for (let j = i - 1; j >= 0; j--) {
          if (operators.includes(tokens[j].text) && lambdaInputConnectOperator.includes(tokens[j].text) === false) {
            if (parenthesesCount === 0) {
              converted.splice(j + 1, 0, '(');
              lastBoundaryIndex = j + 1;
              break;
            }
            if (tokens[j].text === '(') {
              parenthesesCount--;
            } else if (tokens[j].text === ')') {
              parenthesesCount++;
            }
          }
          if (j === 0) {
            converted.splice(initialConvertedLength, 0, '(');
            lastBoundaryIndex = initialConvertedLength;
          }
        }
        converted.push(')');
        if (isInTuple) {
          if (converted[converted.length - 1] === ', ') {
            converted.pop();
          }
          converted.push(')');
          isInTuple = false;
        }
        converted.push('=>');
      } else if (current.text === 'fn' && current.category === 'keyword') {
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
          const endTokenIndex = tokens.indexOf(removed[fnType.endAt]);
          if (endTokenIndex === -1) {
            throw new UnhandledError(removed[fnType.endAt]);
          }
          i = endTokenIndex;
        } else {
          throw new SyntaxError(current);
        }
      } else {
        if (current.category === undefined || current.category === 'keyword' || current.category === 'context_keyword')
          isConst = false;
        converted.push(current.text);
      }
    }

    if (isInTuple) {
      if (converted[converted.length - 1] === ', ') {
        converted.pop();
      }
      converted.push(')');
    }
    lastBoundaryIndex = converted.length;
    return tokens.length;
  }
}
