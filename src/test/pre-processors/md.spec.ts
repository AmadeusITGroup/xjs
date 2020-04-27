import * as assert from 'assert';
import { parse, XjsParserContext } from '../../xjs/parser';
import { $fragment } from '../../xjs/xjs';
import { stringify } from '../parser/utils';
import { md } from '../../pre-processors/md';

describe('@@ts', () => {

    const context: XjsParserContext = {
        fileId: "src/test/pre-processors/md.spec.ts",
        col1: 45,
        preProcessors: {
            "@@md": md
        },
        templateType: "$fragment"
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

    it("should work on basic md content", async function () {
        assert.equal(stringify(await parse($fragment`
            abc<!cdata @@md>
                Hello World
            </!cdata>def
        `, context)), `
            #fragment <!>
                #textNode " abc"
                #element <div class="md">
                    #element <pre>
                        #element <code>
                            #textNode " Hello World"
                #textNode "def "
        `, "1");
    });

    it("should support the class param (explicit + default)", async function () {
        assert.equal(stringify(await parse($fragment`
            <!cdata @@md="hello">
# Main title
## Second title
Some text
            </!cdata>def
        `, context)), `
            #fragment <!>
                #element <div class="md hello">
                    #element <h1 id="main-title">
                        #textNode "Main title"
                    #element <h2 id="second-title">
                        #textNode "Second title"
                    #element <p>
                        #textNode "Some text"
                #textNode "def "
        `, "1");


        assert.equal(stringify(await parse($fragment`
            Some code <!cdata @@md(class="code")>    foo="bar" </!cdata> !<-- here
        `, context)), `
            #fragment <!>
                #textNode " Some code "
                #element <div class="md code">
                    #element <pre>
                        #element <code>
                            #textNode "foo=&quot;bar&quot; "
                #textNode " <-- here "
        `, "2");
    });

    it("should raise errors when not used on <!cdata> sections", async function () {
        assert.equal(await error($fragment`
            <div @@md> abc </div>
        `), `
            XJS: Invalid $fragment: @@md: Pre-processor can only run on <!cdata> elements
            Line 2 / Col 18
            File: src/test/pre-processors/md.spec.ts
            Extract: >> <div @@md> abc </div> <<
            `, "1");

        assert.equal(await error($fragment`
            <!cdata @@md>
text...
<div class="foo"> // invalid XHTML
            </!cdata>
        `), `
            XJS: Invalid element: Unexpected characters 'End of Content' instead of '</'
            Line 3 / Col 1
            File: [@@md inline HTML]
            Extract: >>  <<
            `, "2");
    });
});
