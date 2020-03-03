# XJS Parser

XJS is provided with a parser that produces an Abstract Syntax Tree from a template string. This parse should be typically used in a file pre-processor to replace the template string with some TypeScript code.

The parser API is the following

```js
// xjs/parser.ts
async function parse(tpl: string, filePath = "", lineOffset = 0, columnOffset = 0): Promise<XjsTplFunction>
```

where
- tpl is the template string
- filePath is a string that refers to the file containing the template. This will be used to generate proper errors.
- lineOffset is the offset of the first template line, which is also only used for errors. By default the template considers that the template string starts on the first line of the template file - so if you don't pass any value, the compilation errors may show an invalid line number. As example, if the first template line is on line number 10 of the template file, the lineOffset value should be 10-1 = 9
- columnOffset: same as lineOffset, but for the first character of the template string. In the example below the columnOffset value is 7 as the first back-tick character (i.e. `) is on column 7.

all types information can be found in [xjs/types.ts][]


Example:
```js
parse(`() => {
    <div>
        <section>
            <div/>
            # Some text #
        </>
        <span/>
    </div>
    <span  />
}`, 'foo/bar/file.ts', 9, 7);
```

More examples can be found in the test files: [xjsparser.spec][] and [error.spec][]


[xjsparser.spec]: ../src/test/xjsparser.spec.ts
[error.spec]: ../src/test/error.spec.ts
[xjs/types.ts]: ../src/xjs/types.ts