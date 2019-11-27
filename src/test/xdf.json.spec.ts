import * as assert from 'assert';
import { stringify, json } from '../xdf/json';
import { XdfParamHost, XdfParamDictionary, XdfPreProcessorCtxt, createXdfText, addParam } from '../xdf/ast';

describe('XDF JSON converter', () => {

    // inject 2 text nodes before and after - no args (orphan)
    function surround() {
        return {
            process(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                let p = ctxt.parent;
                if (p && (p.kind === "#element" || p.kind === "#fragment")) {
                    let ch = p.children!, targetIndex = ch.indexOf(target as any);
                    let t1 = createXdfText(" BEFORE "), t2 = createXdfText(" AFTER ");
                    ch.splice(targetIndex, 1, t1, target as any, t2);
                    if (params.value === undefined) {
                        addParam(target, "noSurroundParams");
                    }
                }
            }
        }
    }

    it("should transform simple files with no @@json instructions", function () {
        assert.deepEqual(stringify(`
            Hello
            <div class="foo" @deco1 @deco2="blah">
                "World"
            </div>
        `), `{"content":"Hello <div class='foo' @deco1 @deco2='blah'> \\"World\\" </>"}`, '1');

        assert.deepEqual(json(``), {}, '2');

        assert.deepEqual(json(`


        `), {}, '3');

        assert.deepEqual(json(`   `), {}, '4');

        assert.deepEqual(json(`
            <div class="foo"> aaa </>
            <*cpt prop=123> 
                bbb
                <.foo prop=false>ccc</>
            </>
            <!> ddd </>
        `), {
            content: "<div class='foo'> aaa </><*cpt prop=123> bbb <.foo prop=false>ccc</></> ddd"
        }, '5');
    });

    it("should allow to change the root target", function () {
        assert.deepEqual(json(`
            <div @@json="some.path" class="foo" @deco> Hello </div>
        `), {
            "some": {
                "path": "<div class='foo' @deco> Hello </>"
            }
        }, '1');

        assert.deepEqual(json(`
            <! @@json="a.b.c">
                Hello
                <div> World </>
                !
            </>
        `), {
            "a": {
                "b": {
                    "c": "Hello <div> World </> !"
                }
            }
        }, '2');
    });

    it("should support absolute target on child elements", function () {
        assert.deepEqual(json(`
            <div @@json="some.path" class="foo" @deco> 
                Hello 
            </div>
            Blah blah // -> default content
        `), {
            "content": "Blah blah",
            "some": {
                "path": "<div class='foo' @deco> Hello </>"
            }
        }, '1');

        assert.deepEqual(json(`
            <! @@json="a.b"> 
                AAA 
                <div @@json="c.d"> BBB </>
            </>
        `), {
            a: {
                b: "AAA"
            },
            c: {
                d: "<div> BBB </>"
            }
        }, '2');

        assert.deepEqual(json(`
            <*cpt @@json="a.b."> 
                AAA 
                <*cpt @@json="c.d."> BBB </>
            </>
        `), {
            a: {
                b: {
                    content: "<*cpt> AAA </>"
                }
            },
            c: {
                d: {
                    content: "<*cpt> BBB </>"
                }
            }
        }, '3');

        assert.deepEqual(json(`
            <*cpt @@json="a.b."> 
                AAA
                <!cdata @@json="c"> "BBB" </!cdata>
                CCC
            </>
        `), {
            a: {
                b: {
                    content: "<*cpt> AAA  CCC </>"
                }
            },
            c: "<!cdata> \"BBB\" </!cdata>"
        }, '4');
    });

    it("should relative targets on child elements", function () {
        assert.deepEqual(json(`
            <div @@json=".some.path" class="foo" @deco> 
                Hello 
                <div @@json=".foo"> FOO </>
            </div>
            Blah blah // -> default content
        `), {
            "content": "Blah blah",
            "some": {
                "foo": "<div> FOO </>",
                "path": "<div class='foo' @deco> Hello </>"
            }
        }, '1');

        assert.deepEqual(json(`
            <div @@json=".some.path." class="foo" @deco> 
                Hello 
                <div @@json=".foo"> FOO </>
            </div>
        `), {
            some: {
                path: {
                    content: "<div class='foo' @deco> Hello </>",
                    foo: "<div> FOO </>"
                }
            }
        }, '2');

        assert.deepEqual(json(`
            <! @@json=".a.">
                <div @@json=".some.path." class="foo" @deco> 
                    Hello 
                    <div @@json=".foo"> FOO </div>
                </div>
                <*cpt @@json=".d.e"> BAR </>
            </>
        `), {
            "a": {
                "d": {
                    "e": "<*cpt> BAR </>"
                },
                "some": {
                    "path": {
                        "content": "<div class='foo' @deco> Hello </>",
                        "foo": "<div> FOO </>"
                    }
                }
            }
        }, '3');
    });

    it("should support array paths", function () {
        assert.deepEqual(json(`
            <div @@json="a.b[]"> AAA </div>
            <div @@json="a.b[]"> BBB </div>
            <! @@json="a.b[]"></> // will be ignored
            <*cpt @@json="a.b[]"> CCC </>
        `), {
            a: {
                b: [
                    "<div> AAA </>",
                    "<div> BBB </>",
                    "<*cpt> CCC </>"
                ]
            }
        }, '1');

        assert.deepEqual(json(`
            <! @@json="a[].">
                <! @@json=".content"> ABC </>
                <span @@json=".c"> 1.1 </>
                <span @@json=".d"> 1.2 </>
            </!>
            <! @@json="a[].">
                <span @@json=".c"> 2.1 </>
                <span @@json=".d"> 2.2 </>
            </!>
        `), {
            a: [{
                content: "ABC",
                c: "<span> 1.1 </>",
                d: "<span> 1.2 </>"
            }, {
                c: "<span> 2.1 </>",
                d: "<span> 2.2 </>"
            }]
        }, '2');

        assert.deepEqual(json(`
            <! @@json="a.">
                <! @@json=".b[]">
                    AAA
                </>
            </>
            <! @@json="a.b[].">
                <span @@json=".c"> 2.1 </>
                <span @@json=".d"> 2.2 </>
            </>
        `), {
            a: {
                b: [
                    "AAA",
                    {
                        c: "<span> 2.1 </>",
                        d: "<span> 2.2 </>"
                    }
                ]
            }
        }, '3');
    });

    it("should work with other pre-processors", function () {
        assert.deepEqual(json(`
            <span> BEGINNING </span>
            <div @@surround @@json="a.b"> ABCD </>
            <span> END </span>
        `, { preProcessors: { "@@surround": surround } }), {
            a: {
                b: "<div noSurroundParams> ABCD </>"
            },
            content: "<span> BEGINNING </> BEFORE  AFTER <span> END </>"
        }, '1');
    });

    it("should be able to export as a string with ES export", function () {
        assert.deepEqual(stringify(`
            <! @@json(export="default")>
                <div class='foo' @deco = 123> "ABCD" </div>
            </>
        `), `export default {"content":"<div class='foo' @deco=123> \\"ABCD\\" </>"};`, '1');

        assert.deepEqual(stringify(`
            <! @@json(export="foo" target="main.xdf")>
                AAA
                <div> BBB 
                    <span> CCC </>
                </div>
                DDD
            </>
        `), `export const foo={"main":{"xdf":"AAA <div> BBB <span> CCC </></> DDD"}};`, '2');
    });

    describe('Errors', () => {
        const padding = '                ';

        function error(xdf: string) {
            try {
                json(xdf, { fileId: "/a/b/theFile.xdf" });
            } catch (err) {
                return "\n" + padding + err.replace(/\n/g, "\n" + padding) + "\n" + padding;
            }
            return "NO ERROR";
        }

        it("should be raised for invalid targets", function () {
            assert.equal(error(`
                <div @@json="a..b.c"> Hello </div>
            `), `
                XDF: @@json: Invalid target value 'a..b.c'
                Line 2 / Col 22
                File: /a/b/theFile.xdf
                Extract: >> <div @@json="a..b.c"> Hello </div> <<
                `, "1");

            assert.equal(error(`
                <div @@json="a.b[].c"> Hello </div>
            `), `
                XDF: @@json: Invalid target value 'a.b[].c'
                Line 2 / Col 22
                File: /a/b/theFile.xdf
                Extract: >> <div @@json="a.b[].c"> Hello </div> <<
                `, "2");

            assert.equal(error(`
                <div @@json="a.b.[]"> Hello </div>
            `), `
                XDF: @@json: Invalid target value 'a.b.[]'
                Line 2 / Col 22
                File: /a/b/theFile.xdf
                Extract: >> <div @@json="a.b.[]"> Hello </div> <<
                `, "3");
        });

        it("should be raised if other pre-processors are not found", function () {
            assert.equal(error(`
                <div @@json="a.b.c" 
                @@foo> Hello </div>
            `), `
                XDF: Undefined pre-processor '@@foo'
                Line 3 / Col 17
                File: /a/b/theFile.xdf
                Extract: >> @@foo> Hello </div> <<
                `, "1");
        });

        it("should be raised for invalid export", function () {
            assert.equal(error(`
                <div @@json(export="123")> ABC </div>
            `), `
                XDF: @@json: Invalid export value: '123'
                Line 2 / Col 29
                File: /a/b/theFile.xdf
                Extract: >> <div @@json(export="123")> ABC </div> <<
                `, "1");

            assert.equal(error(`
                <span>
                    <div @@json(export="abc")> ABC </div>
                </>
            `), `
                XDF: @@json: 'export' can only be used on root container
                Line 3 / Col 33
                File: /a/b/theFile.xdf
                Extract: >> <div @@json(export="abc")> ABC </div> <<
                `, "2");
        });

        it("should be raised for invalid usage", function () {
            assert.equal(error(`
                <div @foo(@@json='abc')> ABC </div>
            `), `
                XDF: @@json: Pre-processor cannot be used in #decorator
                Line 2 / Col 22
                File: /a/b/theFile.xdf
                Extract: >> <div @foo(@@json='abc')> ABC </div> <<
                `, "1");

            assert.equal(error(`
                <div @@json="a[]">
                    <! @@json=".b"> Some content </>
                </>
            `), `
                XDF: @@json: Relative paths ('.b') cannot be used in array string items
                Line 3 / Col 24
                File: /a/b/theFile.xdf
                Extract: >> <! @@json=".b"> Some content </> <<
                `, "2");

            assert.equal(error(`
                <div @@json="a">
                    <! @@json=".b"> Some content A </>
                    <! @@json=".b"> Some content B </>
                </>
            `), `
                XDF: @@json: Value cannot be set twice in '.b'
                Line 4 / Col 24
                File: /a/b/theFile.xdf
                Extract: >> <! @@json=".b"> Some content B </> <<
                `, "3");
        });
    });

    // TODO support export on any node (provided that target is absolute) to support multiple exports
});
