import { XdfParserContext } from './../xdf/parser';
import { XdfPreProcessorCtxt, addParam, createXdfText } from './../xdf/ast';
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
    function newParam(target: XdfParamHost, params: XdfParam[], ctxt: XdfPreProcessorCtxt) {
        let name = "", value: any = undefined;
        for (let p of params) {
            if (p.name === "name") {
                name = p.value || "";
            } else if (p.name === "value") {
                value = p.value;
            }
        }
        if (name === "") {
            ctxt.error("name is mandatory");
        } else if (value === undefined) {
            throw "value is mandatory";
        }
        addParam(target, name, value);
        if (params.length !== 2) {
            ctxt.error("Invalid number of parameters: " + params.length);
        }
    }

    // inject 2 text nodes before and after - no args (orphan)
    function surround(target: XdfParamHost, params: XdfParam[], ctxt: XdfPreProcessorCtxt) {
        let p = ctxt.parent;
        if (p.kind === "#element" || p.kind === "#fragment") {
            let ch = p.children!, targetIndex = ch.indexOf(target as any);
            let t1 = createXdfText("BEFORE"), t2 = createXdfText("AFTER");
            ch.splice(targetIndex, 1, t1, target as any, t2);
            if (params.length === 0) {
                addParam(target, "noSurroundParams");
            }
        }
    }

    // add a param with the nbr of siblings - suffix can be passed as default value
    function siblings(target: XdfParamHost, params: XdfParam[], ctxt: XdfPreProcessorCtxt) {
        let suffix = "", count = 0;
        for (let p of params) {
            if (p.name === "value") {
                suffix = p.value || suffix;
            }
        }

        let p = ctxt.parent;
        if (p.kind === "#element" || p.kind === "#fragment") {
            count = p.children ? p.children.length : 0;
        }
        if (target.kind === "#element") {
            suffix = ":" + target.name + suffix;
        }

        addParam(target, "siblings" + params.length + ":" + count + suffix);
    }

    // add parser context information as params
    function ctxt(target: XdfParamHost, params: XdfParam[], ctxt: XdfPreProcessorCtxt) {
        addParam(target, "fileName", ctxt.fileName);
        addParam(target, "filePath", ctxt.filePath);
    }

    // add a reference to @@newSurround
    function addRef(target: XdfParamHost, params: XdfParam[], ctxt: XdfPreProcessorCtxt) {
        ctxt.preProcessors["@@newSurround"] = surround;
    }

    const context: XdfParserContext = {
        fileName: "xdf.preprocessors.spec.ts",
        filePath: "src/test/xdf.preprocessors.spec.ts",
        preProcessors: {
            "@@newParam": newParam,
            "@@surround": surround,
            "@@siblings": siblings,
            "@@ctxt": ctxt,
            "@@addRef": addRef
        }
    }

    const padding = '                ';

    function error(xdf: string) {
        try {
            let xf = parse(xdf, context);
            // console.log("xf=",xf)
        } catch (err) {
            return "\n" + padding + err.replace(/\n/g, "\n" + padding) + "\n" + padding;
        }
        return "NO ERROR";
    }

    it("should work on fragments, elements, components, param nodes and decorators", function () {
        assert.equal(str(parse(`
            Hello
            <! @@newParam(name="x" value="y")>
                World
            </>
        `, context)), `
             Hello 
            <! x='y'> World </!>
            `, "1");

        assert.equal(str(parse(`
            Hello
            <div @@newParam(name="x" value="y")> World </div>
        `, context)), `
             Hello 
            <div x='y'> World </div>
            `, "2");

        assert.equal(str(parse(`
            Hello
            <*cpt a="b" @@newParam(name="x" value=123) c=42> World </>
        `, context)), `
             Hello 
            <*cpt a='b' c=42 x=123> World </*cpt>
            `, "3");

        assert.equal(str(parse(`
            <*cpt bar="baz">
                <.foo @@newParam(name="x" value=false)> World </>
            </>
        `, context)), `
            <*cpt bar='baz'>
              <.foo x=false> World </.foo>
            </>
            `, "4");

        assert.equal(str(parse(`
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

    it("should work on cdata (+ pp with multiple params)", function () {
        assert.equal(str(parse(`
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

    it("should be able to replace a node with other nodes (+ pp with no params)", function () {
        assert.equal(str(parse(`
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

    it("should be applied in sequence (+ pp with default value)", function () {
        assert.equal(str(parse(`
            <div @@surround foo="bar" @@siblings="!!"> Hello </div>
        `, context)), `
            BEFORE
            <div foo='bar' noSurroundParams siblings1:3:div!!>
               Hello 
            </>
            AFTER
            `, "1");

        assert.equal(str(parse(`
            <div foo="bar" @@siblings @@surround> Hello </div>
        `, context)), `
            BEFORE
            <div foo='bar' siblings0:1:div noSurroundParams>
               Hello 
            </>
            AFTER
            `, "2");
    });

    it("should be able to add new pre-processor references", function () {
        // @@addRef will add a reference to @@newSurround (=@@surround)
        assert.equal(str(parse(`
            <div @@addRef @@newSurround> Hello </div>
        `, context)), `
            BEFORE
            <div noSurroundParams> Hello </div>
            AFTER
            `, "1");
    });

    it("should have access to parser context", function () {
        assert.equal(str(parse(`
            <div @@ctxt> Hello </div>
        `, context)), `
            <div fileName='xdf.preprocessors.spec.ts' filePath='src/test/xdf.preprocessors.spec.ts'>
               Hello 
            </>
            `, "1");
    });

    it("should be able to raise errors for invalid params", function () {
        assert.equal(error(`
                <*cpt @@newParam(foo='bar')/>
            `), `
                XDF: @@newParam: name is mandatory
                Line 2 / Col 23
                Extract: >> <*cpt @@newParam(foo='bar')/> <<
                `, "1");

        assert.equal(error(`
                <*cpt @@newParam(name='bar')/>
            `), `
                XDF: Error in @@newParam execution: value is mandatory
                Line 2 / Col 23
                Extract: >> <*cpt @@newParam(name='bar')/> <<
                `, "2");
    });

    it("should be raise errors for undefined pre-processor", function () {
        assert.equal(error(`
                <! @@foo/>
            `), `
                XDF: Undefined pre-processor '@@foo'
                Line 2 / Col 20
                Extract: >> <! @@foo/> <<
                `, "1");
    });

    it("should raise errors if labels are used on pre-processors", function () {
        assert.equal(error(`
                <*cpt @@newParam(name='foo' value="bar" #blah)/>
            `), `
                XDF: Labels cannot be used on pre-processors
                Line 2 / Col 23
                Extract: >> <*cpt @@newParam(name='foo' value="bar" #blah)/> <<
                `, "1");
    });

    it("should raise errors if pre-processors are used on pre-processors", function () {
        assert.equal(error(`
                <.title @@newParam(name='foo' @@surround value="bar")/>
            `), `
                XDF: Pre-processors cannot be used on pre-processors: check @@surround
                Line 2 / Col 47
                Extract: >> <.title @@newParam(name='foo' @@surround value="bar")/> <<
                `, "1");
    });
});
