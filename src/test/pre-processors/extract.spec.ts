import * as assert from 'assert';
import { extract } from '../../pre-processors/extract';
import { join } from 'path';
import { parse, XjsParserContext } from '../../xjs/parser';
import { $fragment, $template } from '../../xjs/xjs';
import { stringify } from '../parser/utils';

describe('@@extract', () => {

    beforeEach(() => {
        context.templateType = "$fragment";
    });

    const context: XjsParserContext = {
        fileId: join(__dirname, "extract.spec.ts"),
        col1: 45,
        preProcessors: {
            "@@extract": extract
        },
        templateType: "$fragment"
    }

    const padding = '            ';

    async function error(xjs: string) {
        try {
            await parse(xjs, context);
        } catch (err) {
            return "\n" + padding + err.message.replace(/\n/g, "\n" + padding)
                .replace(/File\:.*/, "File: ...")
                .replace(/File not found\:.*/, "File not found: ...") + "\n" + padding;
        }
        return "NO ERROR";
    }

    it("should extract sections in the middle of a file", async function () {
        assert.deepEqual(stringify(await parse($fragment`
            AA
            <! @@extract="resources/sample1.ts#sectionA" />
            BB
        `, context)), `
            #fragment <!>
                #textNode " AA "
                #fragment <!>
                    #element <div class="extract ts_code">
                        #element <div>
                            #element <span class="hr">
                                #textNode "function"
                            #textNode " "
                            #element <span class="hf">
                                #textNode "foo"
                            #textNode "() {"
                        #element <div>
                            #textNode "    "
                            #element <span class="hc">
                                #textNode "// comment with <span>"
                        #element <div>
                            #textNode "    "
                            #element <span class="hk">
                                #textNode "return"
                            #textNode " "
                            #element <span class="hs">
                                #textNode "\"bar\""
                            #textNode ";"
                        #element <div>
                            #textNode "}"
                #textNode " BB "
        `, '1');
    });

    it("should extract sections at the end or a file", async function () {
        assert.deepEqual(stringify(await parse($fragment`
            <span> BEGINNING </span>
            <*cpt @@extract="./resources/sample1.ts#sectionC" />
            <div> abc </>
            <span> END </span>
        `, context)), `
            #fragment <!>
                #element <span>
                    #textNode " BEGINNING "
                #component <*cpt>
                    #element <div class="extract ts_code">
                        #element <div>
                            #element <span class="hr">
                                #textNode "class"
                            #textNode " "
                            #element <span class="ht">
                                #textNode "TheClass"
                            #textNode " {"
                        #element <div>
                            #textNode "    "
                            #element <span class="hf">
                                #textNode "method"
                            #textNode "() {"
                        #element <div>
                            #textNode " "
                        #element <div>
                            #textNode "        "
                            #element <span class="hk">
                                #textNode "return"
                            #textNode " "
                            #element <span class="hn">
                                #textNode "123"
                            #textNode ";"
                        #element <div>
                            #textNode "    }"
                        #element <div>
                            #textNode "}"
                #element <div>
                    #textNode " abc "
                #element <span>
                    #textNode " END "
        `, '1');
    });

    it("should support the trim attribute", async function () {
        // trim's default is true
        assert.deepEqual(stringify(await parse($fragment`
            <div @@extract(section="./resources/sample1.ts#sectionA" trim=false) />
        `, context)), `
            #fragment <!>
                #element <div class="extract ts_code">
                    #element <div>
                        #textNode " "
                    #element <div>
                        #element <span class="hr">
                            #textNode "function"
                        #textNode " "
                        #element <span class="hf">
                            #textNode "foo"
                        #textNode "() {"
                    #element <div>
                        #textNode "    "
                        #element <span class="hc">
                            #textNode "// comment with <span>"
                    #element <div>
                        #textNode "    "
                        #element <span class="hk">
                            #textNode "return"
                        #textNode " "
                        #element <span class="hs">
                            #textNode ""bar""
                        #textNode ";"
                    #element <div>
                        #textNode "}"
                    #element <div>
                        #textNode " "
        `, '1');
    });

    it("should be able to merge multiple adjacent sections", async function () {
        // trim's default is true
        assert.deepEqual(stringify(await parse($fragment`
            <div @@extract(section="./resources/sample1.ts#a>>d" trim=false) />
        `, context)), `
            #fragment <!>
                #element <div class="extract ts_code">
                    #element <div>
                        #element <span class="hr">
                            #textNode "const"
                        #textNode " "
                        #element <span class="hv">
                            #textNode "a"
                        #textNode " "
                        #element <span class="hk">
                            #textNode "="
                        #textNode " "
                        #element <span class="hs">
                            #textNode ""b""
                        #textNode ";"
                    #element <div>
                        #element <span class="hk">
                            #textNode "if"
                        #textNode " ("
                        #element <span class="hv">
                            #textNode "a"
                        #textNode ") {"
                    #element <div>
                        #textNode "    "
                        #element <span class="hf">
                            #textNode "foo"
                        #textNode "();"
                    #element <div>
                        #textNode "}"
                    #element <div>
                        #element <span class="hc">
                            #textNode "// last"
        `, '1');
    });

    it("should work on $template templates", async function () {
        context.templateType = "$template";

        assert.equal(stringify(await parse($template`() => {
            abc<div @@extract="./resources/sample1.ts#sectionF"/>def
        }`, context)), `
            #tplFunction()
                #textNode " abc"
                #element <div class="extract ts_code">
                    #element <div>
                        #element <span class="hr">
                            #textNode "const"
                        #textNode " "
                        #element <span class="hv">
                            #textNode "xyz"
                        #textNode " "
                        #element <span class="hk">
                            #textNode "="
                        #textNode " "
                        #element <span class="hs">
                            #textNode "\` Some stuff "
                            #element <span class="hn">
                                #textNode "\\\`"
                            #textNode "here"
                            #element <span class="hn">
                                #textNode "\\\`"
                            #textNode " \`"
                        #textNode ";"
                #textNode "def "
        `, "1");
    });

    it("should support template highlighting", async function () {
        assert.deepEqual(stringify(await parse($fragment`
            <div @@extract="./resources/sample3.ts#template-section" />
        `, context)), `
            #fragment <!>
                #element <div class="extract ts_code">
                    #element <div>
                        #element <span class="hr">
                            #textNode "interface"
                        #textNode " "
                        #element <span class="ht">
                            #textNode "IFoo"
                        #textNode " {"
                    #element <div>
                        #textNode "    "
                        #element <span class="hv">
                            #textNode "x"
                        #element <span class="hk">
                            #textNode ":"
                        #textNode " "
                        #element <span class="hy">
                            #textNode "boolean"
                        #textNode ";"
                    #element <div>
                        #textNode "}"
                    #element <div>
                        #element <span class="hr">
                            #textNode "const"
                        #textNode " "
                        #element <span class="hv">
                            #textNode "tpl"
                        #textNode " "
                        #element <span class="hk">
                            #textNode "="
                        #textNode " "
                        #element <span class="hf">
                            #textNode "$template"
                        #textNode "\`("
                        #element <span class="hv">
                            #textNode "a"
                        #element <span class="hk">
                            #textNode ":"
                        #element <span class="hy">
                            #textNode "string"
                        #textNode ") "
                        #element <span class="hr">
                            #textNode "=>"
                        #textNode " "
                        #element <span class="hd">
                            #textNode "{"
                    #element <div>
                        #textNode "    "
                        #element <span class="hp">
                            #textNode "<"
                        #element <span class="hg">
                            #textNode "div"
                        #textNode " "
                        #element <span class="ho">
                            #textNode "class"
                        #element <span class="hk">
                            #textNode "="
                        #element <span class="hs">
                            #textNode ""abc""
                        #element <span class="hp">
                            #textNode ">"
                        #textNode " text "
                        #element <span class="hd">
                            #textNode "{"
                        #element <span class="hv">
                            #textNode "a"
                        #element <span class="hd">
                            #textNode "}"
                        #textNode " "
                        #element <span class="hp">
                            #textNode "<"
                        #element <span class="hp">
                            #textNode "/"
                        #element <span class="hp">
                            #textNode ">"
                    #element <div>
                        #element <span class="hd">
                            #textNode "}"
                        #textNode "\`;"
        `, '1');
    });

    it("should properly manage errors", async function () {
        assert.equal(await error($fragment`
            <div @@extract/>
        `), `
            XJS: Invalid $fragment: @@extract: Missing file path
            Line 2 / Col 18
            File: ...
            Extract: >> <div @@extract/> <<
            `, "1");

        assert.equal(await error($fragment`
            <div @@extract="./resources/sample1.ts"/>
        `), `
            XJS: Invalid $fragment: @@extract: Missing section name in file path
            Line 2 / Col 18
            File: ...
            Extract: >> <div @@extract="./resources/sample1.ts"/> <<
            `, "2");

        assert.equal(await error($fragment`
            <div @@extract="/resources/sample1.ts#sectionA"/>
        `), `
            XJS: Invalid $fragment: @@extract: File path must be relative
            Line 2 / Col 18
            File: ...
            Extract: >> <div @@extract="/resources/sample1.ts#sectionA"/> <<
            `, "3");

        assert.equal(await error($fragment`
            <div @@extract="resources/sample2.ts#sectionE"/>
        `), `
            XJS: Invalid $fragment: @@extract: Invalid file content: 'sectionD' is defined twice
            Line 2 / Col 18
            File: ...
            Extract: >> <div @@extract="resources/sample2.ts#sectionE"/> <<
            `, "4");

        assert.equal(await error($fragment`
            <div @@extract="resources/invalid.ts#sectionE"/>
        `), `
            XJS: Invalid $fragment: @@extract: File not found: ...
            Line 2 / Col 18
            File: ...
            Extract: >> <div @@extract="resources/invalid.ts#sectionE"/> <<
            `, "5");

        assert.equal(await error($fragment`
            <div @@extract="resources/sample1.ts#sectionE"/>
        `), `
            XJS: Invalid $fragment: @@extract: Section not found 'sectionE'
            Line 2 / Col 18
            File: ...
            Extract: >> <div @@extract="resources/sample1.ts#sectionE"/> <<
            `, "6");

        assert.equal(await error($fragment`
            <!cdata @@extract="resources/sample1.ts#sectionA"></!cdata>
        `), `
            XJS: Invalid $fragment: @@extract: Only elements, fragments, components or param nodes can be used as host
            Line 2 / Col 20
            File: ...
            Extract: >> <!cdata @@extract="resources/sample1.ts#sectionA"></!cdata> <<
            `, "7");

        assert.equal(await error($fragment`
            <div @@extract="resources/sample1.ts#sectionA">
                Hello world
            </div>
        `), `
            XJS: Invalid $fragment: @@extract: Host cannot contain child elements
            Line 2 / Col 17
            File: ...
            Extract: >> <div @@extract="resources/sample1.ts#sectionA"> <<
            `, "8");

        assert.equal(await error($fragment`
            <div @@extract="resources/sample1.ts#section@#$"/>
        `), `
            XJS: Invalid $fragment: @@extract: Invalid section name 'section@#$'
            Line 2 / Col 18
            File: ...
            Extract: >> <div @@extract="resources/sample1.ts#section@#$"/> <<
            `, "9");
    });
});
