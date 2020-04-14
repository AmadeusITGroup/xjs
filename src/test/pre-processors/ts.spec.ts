import * as assert from 'assert';
import { tokenize, appendLineHighlightElts, ts } from '../../pre-processors/ts';
import { createFragment, createElement, parse, XjsParserContext } from '../../xjs/parser';
import { $content } from '../../xjs/xjs';
import { stringify } from '../parser/utils';

describe('@@ts', () => {

    const context: XjsParserContext = {
        fileId: "src/test/pre-processors/ts.spec.ts",
        col1: 45,
        preProcessors: {
            "@@ts": ts
        },
        templateType: "$content"
    }

    const padding = '            ';

    async function error(xjs: string) {
        try {
            await parse(xjs, context);
        } catch (err) {
            return "\n" + padding + err.message.replace(/\n/g, "\n" + padding) + "\n" + padding;
        }
        return "NO ERROR";
    }

    it("should tokenize ts content property", async function () {
        const tokens = await tokenize(`const foo=123;\n\n//comment`);
        assert.equal(tokens.length, 3, "3 lines");
        assert.equal(tokens[0].length, 6, "6 tokens in line 1");
        assert.equal(tokens[1].length, 1, "1 token in line 2");
        assert.equal(tokens[2].length, 2, "2 tokens in line 3");
    });

    it("should create proper line div elements", async function () {
        const src = `const foo=123;\n\n//comment`,
            lines = src.split('\n'),
            tokens = await tokenize(src);

        let main = createFragment();
        appendLineHighlightElts(lines[0], tokens[0], main);

        assert.equal(stringify(main), `
            #fragment <!>
                #element <div>
                    #element <span class="hr">
                        #textNode "const"
                    #textNode " "
                    #element <span class="hv">
                        #textNode "foo"
                    #element <span class="hk">
                        #textNode "="
                    #element <span class="hn">
                        #textNode "123"
                    #textNode ";"
        `, "1");

        main = createElement("div");
        appendLineHighlightElts(lines[1], tokens[1], main);
        appendLineHighlightElts(lines[2], tokens[2], main);

        assert.equal(stringify(main), `
            #element <div>
                #element <div>
                    #textNode " "
                #element <div>
                    #element <span class="hc">
                        #textNode "//"
                        #textNode "comment"
        `, "2");
    });

    it("should work on cdata sections", async function () {
        assert.equal(stringify(await parse($content`
            abc<!cdata @@ts>
                const x=123;

                function foo() {
                    return null;
                }
            </!cdata>def
        `, context)), `
            #fragment <!>
                #textNode " abc"
                #element <div class="ts_code">
                    #element <div>
                        #textNode "                "
                        #element <span class="hr">
                            #textNode "const"
                        #textNode " "
                        #element <span class="hv">
                            #textNode "x"
                        #element <span class="hk">
                            #textNode "="
                        #element <span class="hn">
                            #textNode "123"
                        #textNode ";"
                    #element <div>
                        #textNode " "
                    #element <div>
                        #textNode "                "
                        #element <span class="hr">
                            #textNode "function"
                        #textNode " "
                        #element <span class="hf">
                            #textNode "foo"
                        #textNode "("
                        #textNode ")"
                        #textNode " "
                        #textNode "{"
                    #element <div>
                        #textNode "                    "
                        #element <span class="hk">
                            #textNode "return"
                        #textNode " "
                        #element <span class="hn">
                            #textNode "null"
                        #textNode ";"
                    #element <div>
                        #textNode "                "
                        #textNode "}"
                #textNode "def "
        `, "1");
    });

    it("should support a trim parameter", async function () {
        assert.equal(stringify(await parse($content`
            <!cdata @@ts(trim=false)>

                const x=123;

                x++;

            </!cdata>
        `, context)), `
            #fragment <!>
                #element <div class="ts_code">
                    #element <div>
                        #textNode " "
                    #element <div>
                        #textNode " "
                    #element <div>
                        #textNode "                "
                        #element <span class="hr">
                            #textNode "const"
                        #textNode " "
                        #element <span class="hv">
                            #textNode "x"
                        #element <span class="hk">
                            #textNode "="
                        #element <span class="hn">
                            #textNode "123"
                        #textNode ";"
                    #element <div>
                        #textNode " "
                    #element <div>
                        #textNode "                "
                        #element <span class="hv">
                            #textNode "x"
                        #element <span class="hk">
                            #textNode "++"
                        #textNode ";"
                    #element <div>
                        #textNode " "
                    #element <div>
                        #textNode "            "
        `, "1");

        assert.equal(stringify(await parse($content`
            <!cdata @@ts(trim=true)>

                const x=123;

                x++;

            </!cdata>
        `, context)), `
            #fragment <!>
                #element <div class="ts_code">
                    #element <div>
                        #textNode "                "
                        #element <span class="hr">
                            #textNode "const"
                        #textNode " "
                        #element <span class="hv">
                            #textNode "x"
                        #element <span class="hk">
                            #textNode "="
                        #element <span class="hn">
                            #textNode "123"
                        #textNode ";"
                    #element <div>
                        #textNode " "
                    #element <div>
                        #textNode "                "
                        #element <span class="hv">
                            #textNode "x"
                        #element <span class="hk">
                            #textNode "++"
                        #textNode ";"
        `, "2");
    });

    it("should raise errors when not used on <!cdata> sections", async function () {
        assert.equal(await error($content`
            <div @@ts(trim=false)>

                const x=123;

                x++;

            </div>
        `), `
            XJS: Invalid $content: @@ts: pre-processor can only be used on <!cdata> sections
            Line 2 / Col 18
            File: src/test/pre-processors/ts.spec.ts
            Extract: >> <div @@ts(trim=false)> <<
            `, "1");
    });
});
