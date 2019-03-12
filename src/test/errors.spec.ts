import * as assert from 'assert';
import { parse } from '../parser/xjs-parser';
import { XjsError } from '../parser/types';

describe('Parsing errors', () => {

    let err = {
        // this api allows to trigger the vs-code text mate completion
        async template(tpl: string, filePath = "", lineOffset = 0) {
            try {
                await parse(tpl, filePath, lineOffset);
            } catch (err) {
                if (err.kind === "#xjsError") {
                    return err.message;
                }
                return "Non-xjs error: " + err.message;
            }
            return 'ok';
        },
        template2: async function (s: string) { return '' }
    }
    err.template2 = err.template; // to avoid highlighting for wrong templates

    it("should be raised for invalid template functions", async function () {
        assert.equal(
            await err.template(``),
            "Invalid template function - Empty template at line #1",
            "1");

        assert.equal(
            await err.template(`<div/>`),
            "Invalid template function - Invalid arrow function at line #1",
            "2");

        assert.equal(
            await err.template(`(a, b) {
            }`),
            "Invalid template function - Invalid arrow function at line #1",
            "3");

        assert.equal(
            await err.template(`(a b) => {
            }`),
            "Invalid template params - Unexpected token 'b' at line #1",
            "4");

        assert.equal(
            await err.template(`(a, b::string) => {
            }`),
            "Invalid template params - Unexpected token ':' at line #1",
            "5");

        assert.equal(
            await err.template(`(a, b) => 
                let x=3;
            }`),
            "Invalid template content - Invalid JS Block at line #2",
            "6");

        assert.equal(
            await err.template(`(a, b) => 
            }`),
            "Invalid template content - Invalid JS Block at line #2",
            "7");

        assert.equal(
            await err.template(`  `),
            "Invalid template function - Empty template at line #1",
            "8");
    });

    it("should be raised for invalid node names", async function () {
        assert.equal(
            await err.template(`() => {
                <d.d/>
            }`),
            "Invalid element (d.d) - Invalid name 'd.d' at line #2",
            "1");

        assert.equal(
            await err.template(`() => {
                <$d.1d/>
            }`),
            "Invalid component (d.1d) - Invalid name 'd.1d' at line #2",
            "2");

        assert.equal(
            await err.template(`() => {
                <.d1.d/>
            }`),
            "Invalid param node (d1.d) - Invalid name 'd1.d' at line #2",
            "3");

        assert.equal(
            await err.template(`() => {
                <@w1.1.abc/>
            }`),
            "Invalid decorator node (w1.1.abc) - Invalid name 'w1.1.abc' at line #2",
            "4");

        assert.equal(
            await err.template(`() => {
                <hello-world/>
            }`),
            "ok",
            "5");
    });

    it("should be raised for invalid expression nodes", async function () {
        assert.equal(
            await err.template2(`() => {
                <{foo(/> <div>
            }`),
            "Invalid expression (foo(/> <) - Unexpected end of template at line #3",
            "1");

        assert.equal(
            await err.template2(`() => {
                <div title = {expr( />
            }`),
            "Invalid expression (expr( />) - Unexpected end of template at line #3",
            "2");

        assert.equal(
            await err.template(`() => {
                <{foo()} bar=123/>
            }`),
            "ok",
            "3");
    });

    it("should be raised for text nodes", async function () {
        assert.equal(
            await err.template2(`() => {
                # Hello {exp #
                <div>
            }`),
            "Invalid text node - Unexpected end of template at line #4",
            "1");

        assert.equal(
            await err.template(`() => {
                # (1att=234) Hello {exp} #
            }`),
            "Invalid param - Invalid name '1att' at line #2",
            "2");

        assert.equal(
            await err.template2(`() => {
                # Hello { expr Some other text #
            }`),
            "Invalid text node - Unexpected end of template at line #3",
            "3");
    });

    it("should be raised for invalid params", async function () {
        assert.equal(
            await err.template(`() => {
                <div adf.w=123/>
            }`),
            "Invalid element (div) - Invalid param content 'adf.w=123' at line #2",
            "1");

        assert.equal(
            await err.template(`() => {
                <div adf=w1/>
            }`),
            "Invalid param - Invalid param value 'w1' at line #2",
            "2");

        assert.equal(
            await err.template2(`() => {
                <div adf=123 /* />
            }`),
            "Invalid comment - Unexpected end of template at line #3",
            "3");

        assert.equal(
            await err.template2(`() => {
                <div adf=123 
            }`),
            "Invalid element (div) - Invalid param content '}' at line #3",
            "4");
    });

    it("should be raised for invalid decorator params", async function () {
        assert.equal(
            await err.template(`() => {
                <div @1deprecated/>
            }`),
            "Invalid decorator - Invalid name '1deprecated' at line #2",
            "1");

        assert.equal(
            await err.template(`() => {
                <div @foo(1bar=1)/>
            }`),
            "Invalid param - Invalid name '1bar' at line #2",
            "2");
    });

    it("should be raised for invalid references", async function () {
        assert.equal(
            await err.template(`() => {
                <div #d.d/>
            }`),
            "Invalid reference - Invalid content '.d' at line #2",
            "1");

        assert.equal(
            await err.template(`() => {
                <div #d[expr()]/>
            }`),
            "Invalid reference - Invalid content '[' at line #2",
            "2");
    });

    it("should be raised for invalid tag closing", async function () {
        assert.equal(
            await err.template(`() => {
                <div>
                    # Hello #
                </span>
            }`),
            "Invalid end of element (div) - Name mismatch: 'span' instead of 'div' at line #4",
            "1");

        assert.equal(
            await err.template(`() => {
                <div>
                    # Hello #
                </>
            }`),
            "ok",
            "2");

        assert.equal(
            await err.template(`() => {
                <div>
                    <div>
                        # Hello #
                    </span>
                </div>
            }`),
            "Invalid end of element (div) - Name mismatch: 'span' instead of 'div' at line #5",
            "3");

        assert.equal(
            await err.template(`() => {
                <! foo="bar">
                    <span> # Hello # </>
            }`),
            "Invalid end of fragment - Unexpected token '}' at line #4",
            "4");

        assert.equal(
            await err.template(`() => {
                <{expr()}>
                    <span> # Hello # </>
                </{expr()}>
            }`),
            "Invalid end of element ({expr()}) - Unexpected token '{expr()}' at line #4",
            "5");

        assert.equal(
            await err.template(`() => {
                if (test()) {
                    <div>
                    // comment here
                }
                </div>
            }`),
            "Invalid end of element (div) - Unexpected token '}' at line #5",
            "6");

        assert.equal(
            await err.template(`() => {
                </div>
            }`),
            "Invalid tag - Unexpected token '/' at line #2",
            "8");
    });

    it("should be raised with line offset and file name", async function () {
        assert.equal(
            await err.template(`() => {
                <div>
                    # Hello #
                </span>
            }`, "my-file.ts", 10),
            "Invalid end of element (div) - Name mismatch: 'span' instead of 'div' at line #14 in my-file.ts",
            "1");

        assert.equal(
            await err.template(`() => {
                <!! foo="bar"/>
            }`, "my-file.ts", 10),
            "Invalid fragment - Invalid param content '!' at line #12 in my-file.ts",
            "2");
    });
});
