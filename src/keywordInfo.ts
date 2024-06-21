type Kind = 'Type' | 'Modifier' | 'Function' |'Operator';
// type Modifier = 'class' | 'fn' | 'prop' | 'this';
export const keywordInfo:
  {
    name: string;
    kind: Kind;
  }[] = [
    // Types
    {
      name: 'bool',
      kind: 'Type',
    },
    {
      name: 'byte',
      kind: 'Type',
    },
    {
      name: 'char',
      kind: 'Type',
    },
    {
      name: 'class',
      kind: 'Type',
    },
    {
      name: 'decimal',
      kind: 'Type',
    },
    {
      name: 'delegate',
      kind: 'Type',
    },
    {
      name: 'double',
      kind: 'Type',
    },
    {
      name: 'dynamic',
      kind: 'Type',
    },
    {
      name: 'enum',
      kind: 'Type',
    },
    {
      name: 'event',
      kind: 'Type',
    },
    {
      name: 'float',
      kind: 'Type',
    },
    {
      name: 'fn',
      kind: 'Type',
    },
    {
      name: 'int',
      kind: 'Type',
    },
    {
      name: 'interface',
      kind: 'Type',
    },
    {
      name: 'let',
      kind: 'Type',
    },
    {
      name: 'long',
      kind: 'Type',
    },
    {
      name: 'nint',
      kind: 'Type',
    },
    {
      name: 'nuint',
      kind: 'Type',
    },
    {
      name: 'object',
      kind: 'Type',
    },
    {
      name: 'record',
      kind: 'Type',
    },
    {
      name: 'sbyte',
      kind: 'Type',
    },
    {
      name: 'short',
      kind: 'Type',
    },
    {
      name: 'string',
      kind: 'Type',
    },
    {
      name: 'struct',
      kind: 'Type',
    },
    {
      name: 'uint',
      kind: 'Type',
    },
    {
      name: 'ulong',
      kind: 'Type',
    },
    {
      name: 'ushort',
      kind: 'Type',
    },

    // Modifiers
    {
      name: 'abstract',
      kind: 'Modifier',
    },
    {
      name: 'internal',
      kind: 'Modifier',
    },

    // Functions
    {
      name: 'break',
      kind: 'Function',
    },
  ];
//   const keywords = ['abstract', 'and', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'catch', 'char', 'checked', 'class', 'const', 'continue', 'ctor', 'decimal', 'default', 'delegate', 'do', 'double', 'dynamic', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finalizer', 'finally', 'fixed', 'float', 'fn', 'for', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'let', 'lock', 'long', 'nameof', 'namespace', 'new', 'nint', 'not', 'nuint', 'null', 'object', 'operator', 'or', 'out', 'override', 'params', 'partial', 'private', 'prop', 'protected', 'public', 'readonly', 'record', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while', 'with', 'yield'];
// const contextKeywords = ['add', 'args', 'get', 'global', 'init', 'notnull', 'remove', 'set', 'value', 'filed'];

// Modifier: abstract, 
/*
fn FUNCTION a: b: int, c: string => _, b: int => (e: int, f: string => _ => int) {}
fn FUNCTION a: b: int, c: int, d: string => _, b: int; => e: int, f: string => _ => int~string {}
fn FUNCTION Array-int/Array-(string/int) {}
fn FUNCTION Array<int, Array<string, int>> {}
fn FUNCTION a: int, b: _ => _ {}
fn FUNCTION _ => _ {}
*/
