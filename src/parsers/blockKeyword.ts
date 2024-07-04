import { Token, SyntaxError, UnhandledError, isNext, convertBlock, converted, indentCount, } from "../convert";
import { convertRightSide } from "./rightSide";
import { Type } from "./typeAndVariable";

export { convertBlockKeyword };


/**
 * keywordsOfBlockOrMethodに含まれるものは事前にmethodとしての使用がされていないことを確認
 * @param tokens keywordから始まるtokens
 * @param converted 
 */
function convertBlockKeyword(tokens: Token[], insertIndex: number, assigningType: null | true | Type, indentLevel: number, changeToYieldReturn = false): number {
  if (tokens.length === 0)
    throw new UnhandledError();
  if (tokens[0].category !== 'keyword')
    throw new UnhandledError(tokens[0]);

  let i = 0;
  let keyword = tokens[0];
  while (true) {
    if (keyword.category !== 'keyword')
      throw new UnhandledError(keyword);
    if (keyword.text === 'elif')
      converted.push('else if');
    else if (keyword.text === 'do') {
      if (isNext(token => token.text === 'while', true, i, tokens) === false)
        throw new SyntaxError(keyword, 'Must be while after do');
      converted.push('do');
      const doIndex = converted.length;
      i += 3;
      const lengthBefore = converted.length;
      convertToEndOfKeywordWithExpr();
      const lengthAfter = converted.length;
      const isBlock = convertBlockOfKeyword();
      if (converted[converted.length - 1] === '}\r\n') {
        converted.pop();
        converted.push('}');
      }
      const toMove = converted.splice(lengthBefore, lengthAfter - lengthBefore);
      if (isBlock === false) {
        converted.push(' '.repeat(indentLevel * indentCount), '}')
        converted.splice(doIndex, 0, '{');
      }
      converted.push(' while');
      converted.push(...toMove);
      converted.push(';\r\n');

      return i;
    } else
      converted.push(keyword.text);

    i++;

    if (keyword.kind === 'keyword.block-with-expr') {
      convertToEndOfKeywordWithExpr();
      convertBlockOfKeyword();
    } else {
      convertToEndOfKeywordWithoutExpr();
      convertBlockOfKeyword();
    }

    if (keyword.text === 'if' || keyword.text === 'elif') {
      const nextIndex = isNext(() => true, true, i, tokens, false, true) as { result: boolean, index: number };
      if (nextIndex.index === -1)
        throw new SyntaxError(tokens[i]);
      const next = tokens[nextIndex.index];
      if (next.text === 'else') {
        keyword = next;
        i = nextIndex.index;
      } else if (next.text === 'elif') {
        keyword = next;
        i = nextIndex.index;
      } else {
        return i;
      }
    } else if (keyword.text === 'try') {
      const nextIndex = isNext(() => true, true, i, tokens, false, true) as { result: boolean, index: number };
      if (nextIndex.index === -1)
        throw new SyntaxError(tokens[i]);
      const next = tokens[nextIndex.index];
      if (next.text === 'finally') {
        keyword = next;
        i = nextIndex.index;
      } else if (next.text === 'catch') {
        keyword = next;
        i = nextIndex.index;
      } else {
        return i;
      }
    } else {
      return i;
    }
    converted.push(' '.repeat(indentLevel * indentCount));

    function convertToEndOfKeywordWithExpr() {
      converted.push(' (');
      const startIndex = isNext(() => true, true, i - 1, tokens, false, true) as { result: boolean, index: number };
      if (startIndex.index === -1)
        throw new SyntaxError(tokens[i]);
      if (tokens[startIndex.index].text === '{' || tokens[startIndex.index].text === ';') {
        if (keyword.text === 'catch') {
          converted.pop();
          i = startIndex.index;
          if (tokens[startIndex.index].text === ';') {
            for (let j = i + 1; j < tokens.length; j++) {
              if (tokens[j].text === ';')
                i = j;
              else
                break;
            }
          } else {
            i--;
          }
          return;
        }
        throw new SyntaxError(tokens[i - 1], 'Missing expression');
      }
      if (startIndex.index === i)
        throw new SyntaxError(tokens[i]);
      const endAt = convertRightSide(tokens.slice(startIndex.index), insertIndex, null, false, indentLevel);
      if (converted[converted.length - 1] === ';\r\n')
        converted.pop();
      converted.push(')');
      i = endAt.endAt + startIndex.index;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].text === ';')
          i = j;
        else
          break;
      }

      if (keyword.text === 'catch') {
        const nextIndex = isNext(() => true, true, i, tokens, false, true) as { result: boolean, index: number };
        if (nextIndex.index === -1)
          throw new SyntaxError(tokens[i]);
        const next = tokens[nextIndex.index];
        if (next.text === '*') {
          converted.push(' when (');
          const nextNextIndex = isNext(() => true, true, nextIndex.index, tokens, false, true) as { result: boolean, index: number };
          if (nextNextIndex.index === -1)
            throw new SyntaxError(tokens[i]);
          const endAt = convertRightSide(tokens.slice(nextNextIndex.index), insertIndex, null, false, indentLevel);
          if (converted[converted.length - 1] === ';\r\n')
            converted.pop();
          converted.push(')');
          i = endAt.endAt + nextNextIndex.index;
          for (let j = i + 1; j < tokens.length; j++) {
            if (tokens[j].text === ';')
              i = j;
            else
              break;
          }
        }
      }
    }
    function convertToEndOfKeywordWithoutExpr() {
      let nextIndex = isNext(() => true, true, i - 1, tokens, false, true) as { result: boolean, index: number };
      if (nextIndex.index === -1)
        throw new SyntaxError(tokens[i]);
      let next = tokens[nextIndex.index];
      if (next.text === ';') {
        while (true) {
          if (next.text === ';') {
            nextIndex = isNext(() => true, true, nextIndex.index, tokens, false, true) as { result: boolean, index: number };
            if (nextIndex.index === -1)
              throw new SyntaxError(tokens[i]);
            next = tokens[nextIndex.index];
          } else {
            break;
          }
        }
      }
      i = nextIndex.index - 1;
    }

    function convertBlockOfKeyword(): boolean {
      const nextIndex = isNext(() => true, true, i, tokens, false, true) as { result: boolean, index: number };
      if (nextIndex.index === -1)
        throw new SyntaxError(tokens[i]);
      const next = tokens[nextIndex.index];
      if (next.text === '{') {
        let braceCount = 1;
        let rightBraceIndex = -1;
        for (let j = nextIndex.index + 1; j < tokens.length; j++) {
          if (tokens[j].text === '{')
            braceCount++;
          else if (tokens[j].text === '}')
            braceCount--;
          if (braceCount === 0) {
            rightBraceIndex = j;
            break;
          }
        }
        if (rightBraceIndex === -1)
          throw new SyntaxError(tokens[i]);

        converted.push(' {\r\n');
        convertBlock(tokens.slice(nextIndex.index + 1, rightBraceIndex), 'fn', indentLevel + 1, false, changeToYieldReturn);
        converted.push(' '.repeat(indentLevel * indentCount));
        converted.push('}\r\n');

        i = rightBraceIndex;
        return true;
      } else {
        if (keyword.text === 'try' || keyword.text === 'catch' || keyword.text === 'finally')
          converted.push(' {\r\n');
        else
          converted.push('\r\n');
        const endAt = convertBlock(tokens.slice(nextIndex.index), 'fn', indentLevel + 1, true, changeToYieldReturn);

        i = endAt + nextIndex.index;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].text === ';')
            i = j;
          else
            break;
        }

        if (keyword.text === 'try' || keyword.text === 'catch' || keyword.text === 'finally') {
          converted.push(' '.repeat(indentLevel * indentCount));
          converted.push('}\r\n');
        }

        return false;
      }
    }
  }
}

// const keywordsOfBlockWithExpr = new Set(['for', 'foreach', 'while', 'elif', 'else', 'if', 'catch', 'switch', 'fixed', 'lock', 'do']);
// const keywordsOfBlockWithoutExpr = new Set(['try', 'finally']);
// const keywordsOfBlockOrMethod = new Set(['checked', 'unchecked']);
