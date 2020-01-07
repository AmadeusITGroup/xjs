import * as assert from 'assert';
import { createXtrFragment, addElement, addText, XtrFragment, addParam, addDecorator, addLabel, addComponent, addParamNode, addFragment, addCData } from '../xtr/ast'
import { parse, XtrParserContext } from '../xtr/parser';
import { xtr } from '../xtr/xtr';

describe('XTR', () => {
    const shift = '                ';

    function str(xf: XtrFragment) {
        let s = xf.toString("", "  ", false, true);
        return s.replace(/\n/g, "\n" + shift);
    }

    describe('Tree', () => {
        it("should support element and text nodes", function () {
            let xf = createXtrFragment(),
                e1 = addElement(xf, "div"),
                e2 = addElement(e1, "span");
            addText(e2, " AAA ");
            e2 = addElement(e1, "span");
            addText(e2, " BBB ");
            e1 = addElement(xf, "section");
            addText(e1, "Some 'text' in the section");
            addText(xf, "Some text at the end");

            assert.equal(str(xf), xtr`
                <div>
                  <span> AAA </span>
                  <span> BBB </span>
                </>
                <section>Some 'text' in the section</section>
                Some text at the end
                `, "1");
        });

        it("should support child fragments", function () {
            let xf = createXtrFragment(),
                e1 = addElement(xf, "div"),
                e2 = addElement(e1, "span");
            addText(e2, " AAA ");
            let f1 = addFragment(e1);
            e2 = addElement(f1, "span");
            addText(e2, " BBB ");
            let f2 = addFragment(xf);
            e1 = addElement(f2, "section");
            addText(e1, "Some 'text' in the section");
            addText(f2, "Some text at the end of f2");

            assert.equal(str(xf), xtr`
                <div>
                  <${"span"}> AAA </span>
                  <!>
                    <span> ${"BBB"} </span>
                  </>
                </>
                <!>
                  <section>Some 'text' in the section</section>
                  Some text at the end of f2
                </>
                `, "1");
        });

        it("should support attributes, properties, decorators and labels", function () {
            let xf = createXtrFragment(),
                e1 = addElement(xf, "div"),
                e2 = addElement(e1, "input");

            addParam(e1, "title", "some 'title'");
            addParam(e1, "className", "main", true);
            addParam(e1, "type", "text");
            addParam(e2, "class", xf.ref("mainClass"));
            addParam(e2, "disabled");
            addParam(e2, "maxLength", 123, true);

            e2 = addElement(e1, "span");
            addDecorator(e2, xf.ref("foo"));
            addDecorator(e2, xf.ref("bar"), false);
            addDecorator(e2, xf.ref("baz"), xf.ref("decoRef"));
            addLabel(e2, "lblA");
            addLabel(e2, "lblB", "someLabel");
            addLabel(e2, "lblC", xf.ref("lblRef"));

            e2 = addElement(e1, "div");
            let d = addDecorator(e2, xf.ref("deco"));
            addParam(d, "p1", "text");
            addParam(d, "p2", xf.ref("p2Ref"));
            addParam(d, "p3");
            addLabel(d, "xyz");
            addDecorator(d, xf.ref("foo"));

            assert.equal(str(xf), xtr`
                <div title='some \\'title\\'' [className]='main' type='text'>
                  <input class={mainClass} ${"disabled"} [maxLength]=123/>
                  <span @foo @bar=false @baz={decoRef} #lblA #lblB='someLabel' #lblC={lblRef}/>
                  <div @deco(p1='text' p2={p2Ref} p3 #xyz @foo)/>
                </>
                `, "1");
        });

        it("should support components and param nodes", function () {
            let xf = createXtrFragment(),
                e1 = addElement(xf, "div");

            let e2 = addComponent(e1, xf.ref("x.cpt"));
            addParam(e2, "p1", "someValue");
            addLabel(e2, "lbl");
            let e3 = addParamNode(e2, "header");
            addText(e3, " Header ");
            e3 = addParamNode(e2, "footer");
            addDecorator(e3, xf.ref("deco"));
            addParam(e3, "mode", xf.ref("displayMode"));
            let e4 = addElement(e3, "div");
            addText(e4, " Footer ");
            addText(e2, "Content");

            assert.equal(str(xf), xtr`
                <div>
                  <*x.cpt p1='someValue' #lbl>
                    <.header> Header </.header>
                    <.footer @deco mode={displayMode}>
                      <div> Footer </div>
                    </>
                    Content
                  </>
                </>
                `, "1");
        });

        it("should support cdata", function () {
            let xf = createXtrFragment(),
                e1 = addElement(xf, "div"),
                e2 = addElement(e1, "span");
            addText(e2, " AAA ");
            addCData(e1, "cdata #1");
            addCData(xf, "cdata #2: <section> Hello M </section>");

            assert.equal(str(xf), xtr`
                <div>
                  <span> AAA </span>
                  <!cdata>cdata #1</!cdata>
                </>
                <!cdata>cdata #2: <section> Hello M </section></!cdata>
                `, "1");
        });
    });

    describe('Parser', () => {
        it("should parse simple text nodes", async function () {
            assert.equal(str(await parse('Hello  World\n(!)')), xtr`
                Hello World
                (!!)
                `, "1")

            // test \n and \s or \ (non breaking space): note str adds some spaces at the beginning of each line
            // which results in a strange display
            assert.equal(str(await parse(xtr`\
                !s                     Special chars!nNew line

                !sx !< !/ !! !a
                `)), xtr`
                  Special chars
                New line
                
                 x !< !/ !! !!a 
                `, "2")
        });

        it("should parse elements", async function () {
            assert.equal(str(await parse(xtr`
                <div>
                    <span> Hello World     </span>
                    <*foo>ABC DEF    ${"G"}</*foo>

                    <${"*bar"}>
                        <.header  />
                        Hello again
                    </>
                </>
            `)), xtr`
                <div>
                  <span> Hello World </span>
                  <*foo>ABC DEF G</*foo>
                  <*bar>
                    <.header/>
                     Hello again 
                  </>
                </>
                `, "1")
        });

        it("should manage escaped <", async function () {
            assert.equal(str(await parse(xtr`
                <div>
                    aaa
                    !<!cdata> hello
                    // this comment will disappear
                    !<span> Hello World     !</span>
                    <*foo>ABC DEF    ${"G"}</*foo>

                    !<*bar/>
                    abc
                    def
                    !<${"*abc"} x={y} />
                    !// not a comment
                        <.header  />
                        Hello again
                    !</>
                </div>
            `)), xtr`
                <div>
                   aaa
                !<!!cdata> hello
                !<span> Hello World !<!/span> 
                  <*foo>ABC DEF G</*foo>
                   !<*bar!/>
                abc
                def
                !<*abc x={y} !/>
                !/!/ not a comment 
                  <.header/>
                   Hello again
                !<!/> 
                </>
                `, "1"); // TODO: review space management...

            assert.equal(str(await parse(xtr`
                <div>
                    !<!cdata> hi
                </div>
            `)), xtr`
                <div> !<!!cdata> hi </div>
                `, "2");
            
            assert.equal(str(await parse(xtr`
                <div>
                    !<div>
                </div>
            `)), xtr`
                <div> !<div> </div>
                `, "3");
            
            assert.equal(str(await parse(xtr`
                <div>
                    !</div>
                </div>
            `)), xtr`
                <div> !<!/div> </div>
                `, "4");
        });

        it("should parse comments", async function () {
            assert.equal(str(await parse(xtr`
                <div>
                    // first comment
                    some text
                    /* second
                    comment */
                    <span> Hello World     </span>
                    // <*foo // another comment
                </>
            `)), xtr`
                <div>
                   some text 
                  <span> Hello World </span>
                </>
                `, "1");

            assert.equal(str(await parse(xtr`
                <div // comment
                  class="foo">
                  <span /* another 
                  comment */> Hello World </span>
                </>
            `)), xtr`
                <div class='foo'>
                  <span> Hello World </span>
                </>
                `, "2");

            assert.equal(str(await parse(xtr`
                <div @class(// comment
                  value=123 /* comment */)>
                  <span/*xyz*/class="abc"> Hello World </span>
                </>
            `)), xtr`
                <div @class(value=123)>
                  <span class='abc'> Hello World </span>
                </>
                `, "3");
        });

        it("should parse child fragments", async function () {
            assert.equal(str(await parse(xtr`
                <div>
                    <span> Hello World     </span>
                    <! @foo @bar="baz">
                        <*foo>ABC DEF    G</*foo>
    
                        <*bar>
                            <.header  />
                            Hello again
                        </>
                    </!>
                </div>
                <!>
                    text
                </>
            `)), xtr`
                <div>
                  <span> Hello World </span>
                  <! @foo @bar='baz'>
                    <*foo>ABC DEF G</*foo>
                    <*bar>
                      <.header/>
                       Hello again 
                    </>
                  </>
                </>
                <!> text </!>
                `, "1")
        });

        it("should parse params, decorators and labels", async function () {
            assert.equal(str(await parse(xtr`
                <div foo="bar" disabled baz='abc'>
                    <span baz='a b \\'c\\' d' x=true   
                        y  =  false/>
                    <span @title> Hello </span>
                    <span #foo   #bar = 'xxx'>
                        <div _foo=123  bar=12.345 ba_z = +123 blah=-42/>
                        <div #xyz = {blah}  @required/>
                        <div @title @foo={ xyz }  @bar(a="b" c=123) @blah(  a=123  @abc   )  @baz(@foo)   />
                    </span>
                </>
            `)), xtr`
                <div foo='bar' disabled baz='abc'>
                  <span baz='a b \\'c\\' d' x=true y=false/>
                  <span @title> Hello </span>
                  <span #foo #bar='xxx'>
                    <div _foo=123 bar=12.345 ba_z=123 blah=-42/>
                    <div #xyz={blah} @required/>
                    <div @title @foo={xyz} @bar(a='b' c=123) @blah(a=123 @abc) @baz(@foo)/>
                  </>
                </>
                `, "1")
        });

        it("should parse cdata nodes", async function () {
            assert.equal(str(await parse(xtr`
                <div>
                    <span> Hello World     </span>
                    <!cdata @foo @bar="baz">
                        <*foo>ABC DEF    G</*foo>
                        !</!cdata> // escaped
                        <*bar>
                            <.header  />
                            Hello again
                        </>
                    </!cdata>
                </>
                <!cdata>
                    text \\n \\s xyz
                </!cdata>
            `)), `
                <div>
                  <span> Hello World </span>
                  <!cdata @foo @bar='baz'>
                                        <*foo>ABC DEF    G</*foo>
                                        !</!cdata> // escaped
                                        <*bar>
                                            <.header  />
                                            Hello again
                                        </>
                                    </!cdata>
                </>
                <!cdata>
                                    text \\n \\s xyz
                                </!cdata>
                `, "1")
        });
    });

    describe('Parser errors', () => {
        const padding = '                ';

        async function error(xtr: string, ctxt?: XtrParserContext) {
            try {
                let xf = await parse(xtr, ctxt);
                // console.log("xf=",xf)
            } catch (err) {
                const msg = typeof err === 'string' ? err : err.message || "" + err;
                return "\n" + padding + msg.replace(/\n/g, "\n" + padding) + "\n" + padding;
            }
            return "NO ERROR";
        }

        it("should be raised for invalid identifiers", async function () {
            assert.equal(await error(xtr`
                <*cp-t foo&=123/>
            `), `
                XTR: Invalid character: '-'
                Line 2 / Col 21
                Extract: >> <*cp-t foo&=123/> <<
                `, "1");

            assert.equal(await error(xtr`
                <*cpt @foo+bar/>
            `), `
                XTR: Invalid character: '+'
                Line 2 / Col 27
                Extract: >> <*cpt @foo+bar/> <<
                `, "2");
        });

        it("should support line1 and col1 offsets", async function () {
            assert.equal(await error(xtr`
                // somme comment
                <*cp-t foo=123/>
            `, { fileId: "/fileA.ts", line1: 356, col1: 42 }), `
                XTR: Invalid character: '-'
                Line 358 / Col 21
                File: /fileA.ts
                Extract: >> <*cp-t foo=123/> <<
                `, "1");

            assert.equal(await error(xtr`<*cp-t foo=123/>`, { fileId: "/fileA.ts", line1: 366, col1: 42 }), `
                XTR: Invalid character: '-'
                Line 366 / Col 46
                File: /fileA.ts
                Extract: >> <*cp-t foo=123/> <<
                `, "2");
        });

        it("should be raised for unexpected characters", async function () {
            assert.equal(await error(xtr`
                <div>
                    <span / >
                </div>
            `), `
                XTR: '>' expected instead of ' '
                Line 3 / Col 28
                Extract: >> <span / > <<
                `, "1");

            assert.equal(await error(xtr`
                <div>
                    <span />
                <div>
            `), `
                XTR: '<' expected instead of End of Content
                Line 5 / Col 13
                Extract: >>  <<
                `, "2");
        });

        it("should be raised for invalid param value", async function () {
            assert.equal(await error(xtr`
                <div foo=12. >
                    <span / >
                </div>
            `), `
                XTR: Invalid number
                Line 2 / Col 29
                Extract: >> <div foo=12. > <<
                `, "1");

            assert.equal(await error(xtr`
                <div foo=12.3.4 >
                    <span / >
                </div>
            `), `
                XTR: Invalid character: '.'
                Line 2 / Col 30
                Extract: >> <div foo=12.3.4 > <<
                `, "2");

            assert.equal(await error(xtr`
                <div foo=ABC >
                    <span / >
                </div>
            `), `
                XTR: Invalid parameter value: 'A'
                Line 2 / Col 26
                Extract: >> <div foo=ABC > <<
                `, "2");
        });

        it("should be raised for invalid end tags", async function () {
            assert.equal(await error(xtr`
                <div foo=12>
                    <span />
                </dix>
            `), `
                XTR: End tag </dix> doesn't match <div>
                Line 4 / Col 19
                Extract: >> </dix> <<
                `, "1");
        });

        it("should be raised for invalid cdata end", async function () {
            assert.equal(await error(`
                <div foo=12>
                    <!cdata>
                </dix>
            `), `
                XTR: Invalid cdata section: end marker '</!cdata>' not found
                Line 3 / Col 21
                Extract: >> <!cdata> <<
                `, "1");
        });
    });
});
