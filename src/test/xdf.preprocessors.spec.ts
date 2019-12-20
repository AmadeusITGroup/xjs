import { XdfParserContext } from './../xdf/parser';
import { XdfPreProcessorCtxt, addParam, createXdfText, XdfParamDictionary } from './../xdf/ast';
import * as assert from 'assert';
import { XdfFragment, XdfParam, XdfParamHost } from '../xdf/ast'
import { parse } from '../xdf/parser';

describe('XDF pre-processors', () => {
    const shift = '            ';

    function str(xf: XdfFragment) {
        let s = xf.toString();
        return s.replace(/\n/g, "\n" + shift);
    }

    // simple pre-processor to add a new param
    // supports 2 parameters: name and value: @@newParam(name="x" value="y")
    function newParam() {
        return {
            process(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                let name = params.name ? params.name.value || "" : "", value: any = params.value ? params.value.value : undefined;

                if (name === "") {
                    ctxt.error("name is mandatory");
                } else if (value === undefined) {
                    throw "value is mandatory";
                }
                addParam(target, name, value);
            }
        }
    }

    // inject 2 text nodes before and after - no args (orphan)
    function surround() {
        return {
            process(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                let p = ctxt.parent;
                if (p && (p.kind === "#element" || p.kind === "#fragment")) {
                    let ch = p.children!, targetIndex = ch.indexOf(target as any);
                    let t1 = createXdfText("BEFORE"), t2 = createXdfText("AFTER");
                    ch.splice(targetIndex, 1, t1, target as any, t2);
                    if (params.value === undefined) {
                        addParam(target, "noSurroundParams");
                    }
                }
            }
        }
    }

    // add a param with the nbr of siblings - suffix can be passed as default value
    function siblings() {
        return {
            process(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                let suffix = params.value ? params.value.value || "" : "", count = 0;

                let p = ctxt.parent;
                if (p && (p.kind === "#element" || p.kind === "#fragment")) {
                    count = p.children ? p.children.length : 0;
                }
                if (target.kind === "#element") {
                    suffix = ":" + target.name + suffix;
                }

                addParam(target, "siblings" + (params.value ? 1 : 0) + ":" + count + suffix);
            }
        }
    }

    // add parser context information as params
    function ctxt() {
        return {
            process(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                addParam(target, "fileId", ctxt.fileId);
            }
        }
    }

    // add a reference to @@newSurround
    function addRef() {
        return {
            setup(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                ctxt.preProcessors["@@newSurround"] = surround;
            }
        }
    }

    // traces
    let TRACE_LOG: string[] = [];
    function trace() {
        return {
            setup(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                TRACE_LOG.push("@@trace setup: " + target.params![0].value + "/" + params.value.value);
            },

            process(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                TRACE_LOG.push("@@trace process: " + target.params![0].value + "/" + params.value.value);
            }
        }
    }

    const context: XdfParserContext = {
        fileId: "src/test/xdf.preprocessors.spec.ts",
        preProcessors: {
            "@@newParam": newParam,
            "@@surround": surround,
            "@@siblings": siblings,
            "@@ctxt": ctxt,
            "@@addRef": addRef,
            "@@trace": trace
        }
    }

    const padding = '                ';

    async function error(xdf: string) {
        try {
            let xf = await parse(xdf, context);
            // console.log("xf=",xf)
        } catch (err) {
            return "\n" + padding + err.replace(/\n/g, "\n" + padding) + "\n" + padding;
        }
        return "NO ERROR";
    }

    it("should work on fragments, elements, components, param nodes and decorators", async function () {
        assert.equal(str(await parse(`
            Hello
            <! @@newParam(name="x" value="y")>
                World
            </>
        `, context)), `
             Hello 
            <! x='y'> World </!>
            `, "1");

        assert.equal(str(await parse(`
            Hello
            <div @@newParam(name="x" value="y")> World </div>
        `, context)), `
             Hello 
            <div x='y'> World </div>
            `, "2");

        assert.equal(str(await parse(`
            Hello
            <*cpt a="b" @@newParam(name="x" value=123) c=42> World </>
        `, context)), `
             Hello 
            <*cpt a='b' c=42 x=123> World </*cpt>
            `, "3");

        assert.equal(str(await parse(`
            <*cpt bar="baz">
                <.foo @@newParam(name="x" value=false)> World </>
            </>
        `, context)), `
            <*cpt bar='baz'>
              <.foo x=false> World </.foo>
            </>
            `, "4");

        assert.equal(str(await parse(`
            <div @deco(a="b" @@newParam(name="x" value=42) c="d")/>
        `, context)), `
            <div @deco(a='b' c='d' x=42)/>
            `, "5");

        // assert.equal(str(parse(`
        //     <@deco a="b" @@newParam(name="x" value=42) c="d"/>
        // `, processors)), `
        //     <>
        //     `, "6");
    });

    it("should work on cdata (+ pp with multiple params)", async function () {
        assert.equal(str(await parse(`
            Hello
            <!cdata @@newParam(name="x" value=false)>
                World..
            </!cdata>
        `, context)), `
             Hello 
            <!cdata x=false>
                            World..
                        </!cdata>
            `, "1");
    });

    it("should be able to replace a node with other nodes (+ pp with no params)", async function () {
        assert.equal(str(await parse(`
            Hello
            <div @@surround foo="bar"> World </div>
        `, context)), `
             Hello 
            BEFORE
            <div foo='bar' noSurroundParams>
               World 
            </>
            AFTER
            `, "1");
    });

    it("should be applied in sequence (+ pp with default value)", async function () {
        assert.equal(str(await parse(`
            <div @@surround foo="bar" @@siblings="!!"> Hello </div>
        `, context)), `
            BEFORE
            <div foo='bar' noSurroundParams siblings1:3:div!!>
               Hello 
            </>
            AFTER
            `, "1");

        assert.equal(str(await parse(`
            <div foo="bar" @@siblings @@surround> Hello </div>
        `, context)), `
            BEFORE
            <div foo='bar' siblings0:1:div noSurroundParams>
               Hello 
            </>
            AFTER
            `, "2");
    });

    it("should be able to add new pre-processor references", async function () {
        // @@addRef will add a reference to @@newSurround (=@@surround)
        assert.equal(str(await parse(`
            <div @@addRef @@newSurround> Hello </div>
        `, context)), `
            BEFORE
            <div noSurroundParams> Hello </div>
            AFTER
            `, "1");
    });

    it("should have access to parser context", async function () {
        assert.equal(str(await parse(`
            <div @@ctxt> Hello </div>
        `, context)), `
            <div fileId='src/test/xdf.preprocessors.spec.ts'>
               Hello 
            </>
            `, "1");
    });

    it("should support setup() and process()", async function () {
        TRACE_LOG = [];
        await parse(`
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
            "@@trace process: div2/b",
            "@@trace process: div1/a",
            "@@trace setup: div3/c",
            "@@trace process: div3/c"
        ], "1");
    });

    it("should be able to raise errors for invalid params", async function () {
        assert.equal(await error(`
                <*cpt @@newParam(foo='bar')/>
            `), `
                XDF: @@newParam: name is mandatory
                Line 2 / Col 23
                File: src/test/xdf.preprocessors.spec.ts
                Extract: >> <*cpt @@newParam(foo='bar')/> <<
                `, "1");

        assert.equal(await error(`
                <*cpt @@newParam(name='bar')/>
            `), `
                XDF: Error in @@newParam process() execution: value is mandatory
                Line 2 / Col 23
                File: src/test/xdf.preprocessors.spec.ts
                Extract: >> <*cpt @@newParam(name='bar')/> <<
                `, "2");
    });

    it("should be raise errors for undefined pre-processor", async function () {
        assert.equal(await error(`
                <! @@foo/>
            `), `
                XDF: Undefined pre-processor '@@foo'
                Line 2 / Col 20
                File: src/test/xdf.preprocessors.spec.ts
                Extract: >> <! @@foo/> <<
                `, "1");
    });

    it("should raise errors if labels are used on pre-processors", async function () {
        assert.equal(await error(`
                <*cpt @@newParam(name='foo' value="bar" #blah)/>
            `), `
                XDF: Labels cannot be used on pre-processors
                Line 2 / Col 23
                File: src/test/xdf.preprocessors.spec.ts
                Extract: >> <*cpt @@newParam(name='foo' value="bar" #blah)/> <<
                `, "1");
    });

    it("should raise errors if pre-processors are used on pre-processors", async function () {
        assert.equal(await error(`
                <.title @@newParam(name='foo' @@surround value="bar")/>
            `), `
                XDF: Pre-processors cannot be used on pre-processors: check @@surround
                Line 2 / Col 47
                File: src/test/xdf.preprocessors.spec.ts
                Extract: >> <.title @@newParam(name='foo' @@surround value="bar")/> <<
                `, "1");
    });
});
