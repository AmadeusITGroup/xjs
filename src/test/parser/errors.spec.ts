import * as assert from 'assert';
import { parse } from '../../xjs/parser';
import { XjsError } from '../../xjs/types';

describe('Parsing errors', () => {
    let fullErrorMode = true;

    beforeEach(() => {
        fullErrorMode = true;
        err.filePath = "";
        err.lineOffset = 0;
        err.colOffset = 32;
        err.templateType = "$template";
    });

    let err = {
        filePath: "",
        lineOffset: 0,
        colOffset: 32,
        templateType: "$template",

        // this api allows to trigger the vs-code text mate completion
        async $template(tpl: TemplateStringsArray) {
            try {
                await parse(tpl[0], {
                    fileId: this.filePath,
                    line1: 1 + this.lineOffset,
                    col1: 1 + this.colOffset,
                    templateType: this.templateType as any
                });
            } catch (err) {
                let e = err as XjsError;
                if (e.kind === "#Error") {
                    if (!fullErrorMode) {
                        let fileInfo = e.file ? " in " + e.file : "";
                        return `${e.description} at line #${e.line}${fileInfo}`;
                    } else {
                        let ls = "\n            ";
                        return `${ls}    ${e.description}`
                            + `${ls}    File: ${e.file} - Line ${e.line} / Col ${e.column}`
                            + `${ls}    Extract: >> ${e.lineExtract} <<`
                            + `${ls}`;
                    }
                }
                console.log("Non-xjs error: ", err);
                return "Non-xjs error";
            }
            return 'ok';
        },
        $template2: async function (s: TemplateStringsArray) { return '' },
        $fragment: async function (s: TemplateStringsArray) {
            this.templateType = "$fragment";
            const r = this.$template(s);
            this.templateType = "$template";
            return r
        },
    }
    err.$template2 = err.$template; // to avoid highlighting for wrong templates

    it("should be raised for invalid template functions", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template``,
            "Invalid $template: Empty template at line #1",
            "1");


        assert.equal(
            await err.$template`<div/>`,
            "Invalid $template: Invalid $template function at line #1",
            "2");

        assert.equal(
            await err.$template`(a, b) {
            }`,
            "Invalid template function: Unexpected characters '{\\n' instead of '=>' at line #1",
            "3");

        assert.equal(
            await err.$template`(a b) => {
            }`,
            "Invalid template arguments: ')' expected instead of 'b' at line #1",
            "4");

        assert.equal(
            await err.$template`(a, b) => 
                let x=3;
            }`,
            "Invalid template function: '{' expected instead of 'l' at line #2",
            "5");

        assert.equal(
            await err.$template`(a, b) => 
                
            }`,
            "Invalid template function: '{' expected instead of '}' at line #3",
            "6");

        assert.equal(
            await err.$template` 
                
             `,
            "Invalid $template: Empty template at line #3",
            "7");
    });

    it("should be raised for invalid node names", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template`() => {
                <d.d/>
            }`,
            "Invalid element: Invalid character in element identifier: '.' at line #2",
            "1");

        assert.equal(
            await err.$template`() => {
                <*d.1d/>
            }`,
            "Invalid component: Invalid component reference: 'd.1d' at line #2",
            "2");

        assert.equal(
            await err.$template`() => {
                <.d1.d/>
            }`,
            "Invalid param node: Invalid identifier: 'd1.d' at line #2",
            "3");

        assert.equal(
            await err.$template`() => {
                <@w1.1.abc/>
            }`,
            "Invalid decorator node: Invalid decorator node reference: 'w1.1.abc' at line #2",
            "4");

        assert.equal(
            await err.$template`() => {
                <hello-world/>
            }`,
            "ok",
            "5");
    });

    it("should be raised for invalid expression nodes", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template2`() => {
                <div title = {expr( />
            }`,
            "Invalid expression: '}' expected instead of End of Content at line #3",
            "1");

        assert.equal(
            await err.$template`() => {
                <{foo()} bar=123/>
            }`,
            "Invalid element: Invalid character '{' at line #2",
            "2");
    });

    it("should be raised for text nodes", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template2`() => {
                Hello {exp
                <div>
            }`,
            "Invalid template function: '}' expected instead of End of Content at line #4",
            "1");

        assert.equal(
            await err.$template2`() => {
                Hello !{ expr Some other text } xyz..
            }`,
            "Invalid $template: Invalid character 'x' at line #2",
            "2");

        assert.equal(
            await err.$template2`() => {
                Hello {expr ( abc} xyz..
            }`,
            "Invalid expression: '}' expected instead of End of Content at line #3",
            "3");
    });

    it("should be raised for invalid params", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template`() => {
                <div adf.w=123/>
            }`,
            "Invalid param: Invalid character '.' at line #2",
            "1");

        assert.equal(
            await err.$template`() => {
                <div adf=w1/>
            }`,
            "Invalid param: Invalid param value: 'w' at line #2",
            "2");

        assert.equal(
            await err.$template2`() => {
                <div adf=123 /* />
            }`,
            "Invalid param: Unexpected End of Content at line #3",
            "3");

        assert.equal(
            await err.$template2`() => {
                <div adf=123 
            }`,
            "Invalid param: Invalid character '}' at line #3",
            "4");

        assert.equal(
            await err.$template`() => {
                <div adf=123. />
            }`,
            "Invalid param: Invalid number at line #2",
            "5");
    });

    it("should be raised for invalid event listener", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template`() => {
                <div click(e)={doSomething()}/>
            }`,
            "Invalid param: Invalid character '(' at line #2",
            "1");
    });

    it("should be raised for invalid decorator params", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template`() => {
                <div @1deprecated/>
            }`,
            "Invalid decorator: Invalid character '1' at line #2",
            "1");

        assert.equal(
            await err.$template`() => {
                <div @foo(1bar=1)/>
            }`,
            "Invalid param: Invalid character '1' at line #2",
            "2");

        assert.equal(
            await err.$template`() => {
                <div @foo(bax@r=1)/>
            }`,
            "Invalid param: Invalid character '@' at line #2",
            "3");
    });

    it("should be raised for invalid labels", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template`() => {
                <div #d.d/>
            }`,
            "Invalid label: Invalid name 'd.d' at line #2",
            "1");

        assert.equal(
            await err.$template`() => {
                <div #foo #bar[] #baz/>
            }`,
            "Invalid param: Invalid character '[' at line #2",
            "2");

        assert.equal(
            await err.$template`() => {
                <div ##foo/>
            }`,
            "Invalid label: Forward label 'foo' can only be used on components at line #2",
            "3");
    });

    it("should be raised for invalid tag closing", async function () {
        fullErrorMode = false;
        assert.equal(
            await err.$template`() => {
                <div>
                    Hello
                </span>
            }`,
            "Invalid element: End tag </span> doesn't match start tag <div> at line #4",
            "1");

        assert.equal(
            await err.$template`() => {
                <div>
                    Hello
                </>
            }`,
            "ok",
            "2");

        assert.equal(
            await err.$template`() => {
                <div>
                    <div>
                        Hello
                    </span>
                </div>
            }`,
            "Invalid element: End tag </span> doesn't match start tag <div> at line #5",
            "3");

        assert.equal(
            await err.$template`() => {
                <! foo="bar">
                    <span> # Hello # </>
            }`,
            "Invalid fragment: Unexpected characters '}' instead of '</' at line #4",
            "4");

        assert.equal(
            await err.$template`() => {
                <*cpt>
                    <span> # Hello # </>
                </.cpt>
            }`,
            "Invalid component: End tag </.cpt> doesn't match start tag <*cpt> at line #4",
            "5");

        fullErrorMode = true;
        err.filePath = "myFile.ts";
        assert.equal(
            await err.$template`() => {
                $if (test()) {
                    <div>
                    // comment here
                }
                </div>
            }`, `
                Invalid element: Unexpected characters '}\\n' instead of '</'
                File: myFile.ts - Line 5 / Col 17
                Extract: >> } <<
            `, "6");

        assert.equal(
            await err.$template`() => {
                </div>
            }`, `
                Invalid template function: '}' expected instead of '<'
                File: myFile.ts - Line 2 / Col 17
                Extract: >> </div> <<
            `, "7");

        assert.equal(
            await err.$template`() => {
                <div foo="ABC" >
                    <span / >
                </div>
            }`, `
                Invalid element: Unexpected characters '/ ' instead of '/>'
                File: myFile.ts - Line 3 / Col 27
                Extract: >> <span / > <<
            `, "8");
    });

    it("should be raised with line offset and file name", async function () {
        err.filePath = "my-file.ts";
        err.lineOffset = 10;
        fullErrorMode = false;
        assert.equal(
            await err.$template`() => {
                <div>
                    # Hello #
                </span>
            }`,
            "Invalid element: End tag </span> doesn't match start tag <div> at line #14 in my-file.ts",
            "1");

        assert.equal(
            await err.$template`() => {
                <!! foo="bar"/>
            }`,
            "Invalid fragment: Invalid character in fragment identifier: '!' at line #12 in my-file.ts",
            "2");
    });

    it("should be raised for optional arguments in invalid order", async function () {
        err.filePath = "my-file.ts";
        err.lineOffset = 10;
        err.colOffset = 32;
        assert.equal(
            await err.$template`(a:string, b?:boolean, c:number) => {
                <div/>
            }`, `
                Invalid template arguments: Optional arguments must be in last position
                File: my-file.ts - Line 11 / Col 56
                Extract: >> (a:string, b?:boolean, c:number) => { <<
            `, "1");
    });

    it("should be raised for invalid cdata", async function () {
        err.filePath = "my-file.ts";
        err.lineOffset = 10;
        err.colOffset = 32;
        assert.equal(
            await err.$template2`() => {
                <div foo=12>
                    <!cdata> xyz
                </>
            }`, `
                Invalid cdata section: end marker '</!cdata>' not found
                File: my-file.ts - Line 13 / Col 21
                Extract: >> <!cdata> xyz <<
            `, "1");
    });

    it("should be raised for forbidden tags in $template", async function () {
        err.filePath = "file.ts";

        assert.equal(
            await err.$template`() => {
                <div foo=12>
                    <script language="JavaScript"> 
                        // script
                    </>
                </>
            }`, `
                Invalid element: Invalid tag name 'script'
                File: file.ts - Line 3 / Col 22
                Extract: >> <script language="JavaScript"> <<
            `, "1");

        assert.equal(
            await err.$template`() => {
                <div foo=12>
                    <iframe src="https://google.com"> 
                        ...
                    </>
                </>
            }`, "ok", "2");
    });

    it("should be raised for forbidden tags in $fragment", async function () {
        err.filePath = "file.ts";
        assert.equal(
            await err.$fragment`
                <div foo=12>
                    <script language="JavaScript"> 
                        // script
                    </>
                </>
            `, `
                Invalid element: Invalid tag name 'script'
                File: file.ts - Line 3 / Col 22
                Extract: >> <script language="JavaScript"> <<
            `, "1");

        assert.equal(
            await err.$fragment`
                <div foo=12>
                    <iframe src="https://google.com"> 
                        ...
                    </>
                </>
            `, `
                Invalid element: Invalid tag name 'iframe'
                File: file.ts - Line 3 / Col 22
                Extract: >> <iframe src="https://google.com"> <<
            `, "2");

        assert.equal(
            await err.$fragment`
                <div foo=12>
                    <frameset> 
                        ...
                    </>
                </>
            `, `
                Invalid element: Invalid tag name 'frameset'
                File: file.ts - Line 3 / Col 22
                Extract: >> <frameset> <<
            `, "3");

        assert.equal(
            await err.$fragment`
                <div foo=12>
                    <frame> 
                        ...
                    </>
                </>
            `, `
                Invalid element: Invalid tag name 'frame'
                File: file.ts - Line 3 / Col 22
                Extract: >> <frame> <<
            `, "4");
    });

    it("should be raised for wrong expressions in $fragment", async function () {
        err.filePath = "file.ts";

        assert.equal(
            await err.$fragment`
                <div foo=12 bar={a()*2}/>
            `, `
                Invalid expression: Invalid reference path 'a()*2'
                File: file.ts - Line 2 / Col 34
                Extract: >> <div foo=12 bar={a()*2}/> <<
            `, "1");

        assert.equal(
            await err.$fragment`
                <div foo=12>
                    Hello {x.y/z}
                </>
            `, `
                Invalid expression: Invalid reference path 'x.y/z'
                File: file.ts - Line 3 / Col 28
                Extract: >> Hello {x.y/z} <<
            `, "2");

        assert.equal(
            await err.$fragment`
                <div @foo(bar={x*123})>
                    Hello {x.y}
                </>
            `, `
                Invalid expression: Invalid reference path 'x*123'
                File: file.ts - Line 2 / Col 32
                Extract: >> <div @foo(bar={x*123})> <<
            `, "3");

        assert.equal(
            await err.$fragment`
                $if (func+x(a,b)) {
                    ...
                }
            `, `
                Invalid $if statement: ')' expected instead of '+'
                File: file.ts - Line 2 / Col 26
                Extract: >> $if (func+x(a,b)) { <<
            `, "4");

        assert.equal(
            await err.$fragment`
                abc
                $log(a, "some text", x*2);
                def
            `, `
                Invalid $log argument: ')' expected instead of '*'
                File: file.ts - Line 3 / Col 39
                Extract: >> $log(a, "some text", x*2); <<
            `, "5");

        assert.equal(
            await err.$fragment`
                abc
                $each(a.b(x), (item) => {
                    ...
                });
                def
            `, `
                Invalid $each argument: ',' expected instead of '('
                File: file.ts - Line 3 / Col 26
                Extract: >> $each(a.b(x), (item) => { <<
            `, "5");

        assert.equal(
            await err.$fragment`
                abc
                $each(a.b, (item, foo.idx) => {
                    ...
                });
                def
            `, `
                Invalid $each argument: Invalid function argument 'foo.idx'
                File: file.ts - Line 3 / Col 35
                Extract: >> $each(a.b, (item, foo.idx) => { <<
            `, "6");
    });
});