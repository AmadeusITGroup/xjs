import * as assert from 'assert';
import { XjsParamHost, XjsPreProcessorCtxt, XjsParam, XjsParamDictionary, XjsElement, XjsTplFunction } from "../../xjs/types";
import { addParam, createParam, createText, parse, XjsParserContext } from '../../xjs/parser';
import { $fragment, $template } from '../../xjs/xjs';
import { stringify } from './utils';

describe('Xjs pre-processors', () => {

    beforeEach(() => {
        context.templateType = "$fragment";
    });

    // simple pre-processor to add a new param
    // supports 2 parameters: name and value: @@newParam(name="x" value="y")
    function newParam() {
        return {
            setup(target: XjsParamHost, params: XjsParamDictionary) {
                const value: any = params.value ? params.value.value : undefined;
                if (value === "$$error1") {
                    (ctxt as any).foo.bar(); // runtime error
                }
            },
            process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
                const name = params.name ? "" + params.name.value || "" : "", value: any = params.value ? params.value.value : undefined;

                if (name === "") {
                    ctxt.error("name is mandatory");
                } else if (value === undefined) {
                    throw "value is mandatory";
                } else if (value === "$$error2") {
                    (ctxt as any).foo.bar(); // runtime error
                }
                addParam(createParam(name, value), target);
            }
        }
    }

    // inject 2 text nodes before and after - no args (orphan)
    function surround() {
        return {
            process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
                const p = ctxt.parent;
                if (p && (p.kind === "#element" || p.kind === "#fragment")) {
                    const ch = p.content!,
                        targetIndex = ch.indexOf(target as any),
                        t1 = createText(["BEFORE"]), t2 = createText(["AFTER"]);
                    ch.splice(targetIndex, 1, t1, target as any, t2);
                    if (params.value === undefined) {
                        addParam(createParam("noSurroundParams", undefined, true), target);
                    }
                }
            }
        }
    }

    // add a param with the nbr of siblings - suffix can be passed as default value
    function siblings() {
        return {
            process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
                // $$default is the default param - e.g. 123 in @@siblings=123
                let suffix = params["$$default"] ? params["$$default"].value || "" : "", count = 0;

                const p = ctxt.parent;
                if (p && (p.kind === "#element" || p.kind === "#fragment")) {
                    count = p.content ? p.content.length : 0;
                }
                if (target.kind === "#element") {
                    suffix = ":" + (target as XjsElement).name + suffix;
                }
                addParam(createParam("siblings" + (params["$$default"] ? 1 : 0) + ":" + count + suffix, undefined, true), target);
            }
        }
    }

    // add parser context information as params
    function ctxt() {
        return {
            process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
                addParam(createParam("fileId", ctxt.fileId), target);
            }
        }
    }

    // add a reference to @@newSurround
    function addRef() {
        return {
            setup(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
                ctxt.preProcessors["@@newSurround"] = surround;
            }
        }
    }

    // traces
    let TRACE_LOG: string[] = [];
    function trace() {
        return {
            setup(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
                TRACE_LOG.push("@@trace setup: " + (target.params![0] as XjsParam).value + "/" + params["$$default"].value);
            },

            process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
                TRACE_LOG.push("@@trace process: " + (target.params![0] as XjsParam).value + "/" + params["$$default"].value);
            }
        }
    }

    const context: XjsParserContext = {
        fileId: "src/test/parser/preprocessors.spec.ts",
        col1: 42,
        preProcessors: {
            "@@newParam": newParam,
            "@@surround": surround,
            "@@siblings": siblings,
            "@@ctxt": ctxt,
            "@@addRef": addRef,
            "@@trace": trace
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

    it("should work on fragments, elements, components, param nodes and decorators in $fragment", async function () {
        assert.equal(stringify(await parse($fragment`
            Hello
            <! @@newParam(name="x" value="y")>
                World
            </>
        `, context)), `
            #fragment <!>
                #textNode " Hello "
                #fragment <! x="y">
                    #textNode " World "
        `, "1");

        assert.equal(stringify(await parse($fragment`
            Hello
            <div @@newParam(name="x" value="y")> World </div>
        `, context)), `
            #fragment <!>
                #textNode " Hello "
                #element <div x="y">
                    #textNode " World "
        `, "2");

        assert.equal(stringify(await parse($fragment`
            Hello
            <*cpt a="b" @@newParam(name="x" value=123) c=42> World </>
        `, context)), `
            #fragment <!>
                #textNode " Hello "
                #component <*cpt a="b" c=42 x=123>
                    #textNode " World "
        `, "3");

        assert.equal(stringify(await parse($fragment`
            <*cpt bar="baz">
                <.foo @@newParam(name="x" value=false)> World </>
            </>
        `, context)), `
            #fragment <!>
                #component <*cpt bar="baz">
                    #paramNode <.foo x=false>
                        #textNode " World "
        `, "4");
    });

    it("should work on cdata (+ pp with multiple params)", async function () {
        assert.equal(stringify(await parse($fragment`
            Hello
            <!cdata @@newParam(name="x" value=false)>
                World..
            x</!cdata>
        `, context)), `
            #fragment <!>
                #textNode " Hello "
                #cdata <!cdata x=false>

                World..
            x
        `, "1");
    });

    it("should be able to replace a node with other nodes (+ pp with no params)", async function () {
        assert.equal(stringify(await parse($fragment`
            Hello
            <div @@surround foo="bar"> World </div>
        `, context)), `
            #fragment <!>
                #textNode " Hello "
                #textNode "BEFORE"
                #element <div foo="bar" noSurroundParams>
                    #textNode " World "
                #textNode "AFTER"
        `, "1");
    });

    it("should be applied in sequence in reverse order (+ pp with default value)", async function () {
        assert.equal(stringify(await parse($fragment`
            <div @@siblings="!!" @@surround foo="bar"> Hello </div>
        `, context)), `
            #fragment <!>
                #textNode "BEFORE"
                #element <div foo="bar" noSurroundParams siblings1:3:div!!>
                    #textNode " Hello "
                #textNode "AFTER"
        `, "1");

        assert.equal(stringify(await parse($fragment`
            <div foo="bar" @@surround @@siblings> Hello </div>
        `, context)), `
            #fragment <!>
                #textNode "BEFORE"
                #element <div foo="bar" siblings0:1:div noSurroundParams>
                    #textNode " Hello "
                #textNode "AFTER"
        `, "2");
    });

    it("should be able to add new pre-processor references", async function () {
        // @@addRef will add a reference to @@newSurround (=@@surround)
        assert.equal(stringify(await parse($fragment`
            <div @@newSurround @@addRef> Hello </div>
        `, context)), `
            #fragment <!>
                #textNode "BEFORE"
                #element <div noSurroundParams>
                    #textNode " Hello "
                #textNode "AFTER"
        `, "1");
    });

    it("should have access to parser context", async function () {
        assert.equal(stringify(await parse($fragment`
            <div @@ctxt> Hello </div>
        `, context)), `
            #fragment <!>
                #element <div fileId="src/test/parser/preprocessors.spec.ts">
                    #textNode " Hello "
        `, "1");
    });

    it("should support setup() and process()", async function () {
        TRACE_LOG = [];
        await parse($fragment`
            <div @@trace="a" id="div1"> 
                <div @@trace="b" id="div2"> 
                    Hello
                </div>
            </div>
            <div @@trace="c" id="div3"/> 
        `, context);
        assert.deepEqual(TRACE_LOG, [
            "@@trace setup: div1/a",
            "@@trace setup: div2/b",
            "@@trace setup: div3/c",
            "@@trace process: div3/c",
            "@@trace process: div2/b",
            "@@trace process: div1/a"
        ], "1");
    });

    it("should work on $template templates", async function () {
        context.templateType = "$template";
        assert.equal(stringify(await parse($template`(name) => {
            <div @@newParam(name="hello" value="world")> Hello {name} </div>
        }`, context)), `
            #tplFunction(name)
                #element <div hello="world">
                    #textNode
                        " Hello "
                        #expression {name}
                        " "
        `, "1");
    });

    it("should raise errors for invalid params", async function () {
        assert.equal(await error($fragment`
            <*cpt @@newParam(foo='bar')/>
        `), `
            XJS: Invalid $fragment: @@newParam: name is mandatory
            Line 2 / Col 19
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <*cpt @@newParam(foo='bar')/> <<
            `, "1");

        assert.equal(await error($fragment`
            <*cpt @@newParam(name='bar')/>
            `), `
            XJS: Invalid $fragment: Error in @@newParam.process(): value is mandatory
            Line 2 / Col 19
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <*cpt @@newParam(name='bar')/> <<
            `, "2");
    });

    it("should raise errors for undefined pre-processor", async function () {
        assert.equal(await error($fragment`
            <! @@foo/>
        `), `
            XJS: Invalid fragment: Undefined pre-processor '@@foo'
            Line 2 / Col 16
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <! @@foo/> <<
            `, "1");
    });

    it("should raise errors if labels are used on pre-processors", async function () {
        assert.equal(await error($fragment`
            <*cpt @@newParam(name='foo' value="bar" #blah)/>
        `), `
            XJS: Invalid label: Labels cannot be used on pre-processors
            Line 2 / Col 53
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <*cpt @@newParam(name='foo' value="bar" #blah)/> <<
            `, "1");
    });

    it("should raise errors if pre-processors are used on pre-processors & decorators", async function () {
        assert.equal(await error($fragment`
            <.title @@newParam(name='foo' @@surround value="bar")/>
        `), `
            XJS: Invalid param: @@surround cannot be used in this context
            Line 2 / Col 43
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <.title @@newParam(name='foo' @@surround value="bar")/> <<
            `, "1");

        assert.equal(await error($fragment`
            <.title @deco(name='foo' @@surround value="bar")/>
        `), `
            XJS: Invalid param: @@surround cannot be used in this context
            Line 2 / Col 38
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <.title @deco(name='foo' @@surround value="bar")/> <<
            `, "2");

        assert.equal(await error($fragment`
            <div>
                <@deco name='foo' @@surround/>
            </>
        `), `
            XJS: Invalid param: @@surround cannot be used in this context
            Line 3 / Col 35
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <@deco name='foo' @@surround/> <<
            `, "3");
    });

    it("should raise runtime errors during pre-processor execution", async function () {
        assert.equal(await error($fragment`
            <div @@newParam(name='foo' value='$$error1')/>
        `), `
            XJS: Invalid element: Error in @@newParam.setup(): Cannot read property 'bar' of undefined
            Line 2 / Col 18
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <div @@newParam(name='foo' value='$$error1')/> <<
            `, "1");

        assert.equal(await error($fragment`
            <div @@newParam(name='foo' value='$$error2')/>
        `), `
            XJS: Invalid $fragment: Error in @@newParam.process(): Cannot read property 'bar' of undefined
            Line 2 / Col 18
            File: src/test/parser/preprocessors.spec.ts
            Extract: >> <div @@newParam(name='foo' value='$$error2')/> <<
            `, "2");
    });
});
