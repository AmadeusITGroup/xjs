import * as assert from 'assert';
import { XjsTplFunction, XjsFragment } from '../../xjs/types';
import { parse, toString } from '../../xjs/parser';
import { $fragment, $template } from '../../xjs/xjs';

describe('toString', () => {
    const ctxt: any = { templateType: "$fragment", fragmentValidationMode: true };

    function str(root: XjsTplFunction | XjsFragment, indent = "            ") {
        return toString(root, indent);
    }

    it("should serialize fragments, elements and text nodes", async function () {
        const r = await parse($fragment`
            abc
            <div> def <span> xx </></>
            <!> ghi </>
            klm
        `, ctxt);

        assert.equal(str(r), `
            <!>
                 abc 
                <div>
                     def 
                    <span>
                         xx 
                    </>
                </>
                <!>
                     ghi 
                </>
                 klm 
            </>`, "1");
    });

    it("should serialize params", async function () {
        const r = await parse($fragment`
            <div foo bar='baz'   blah=123   xyz={expr} 
                [prop]={a.b.c}/>
            <*cpt disabled=false #xyz ##abc ##def="DEF"/>
            <@lib.deco #xyz prop=12.4>
                hello world
            </>
            text
            <@deco2 yes/>
            <!cdata foo={bar.baz}> Hello there </!cdata>
        `, ctxt);

        assert.equal(str(r), `
            <!>
                <@lib.deco #xyz prop=12.4>
                     hello world 
                </>
                <@deco2 yes/>
                <div foo bar='baz' blah=123 xyz={expr} [prop]={a.b.c}/>
                <*cpt disabled=false #xyz ##abc ##def='DEF'/>
                 text 
                <!cdata foo={bar.baz}> Hello there </!cdata>
            </>`, "1");

        const r2 = await parse($fragment`
            <div @deco @content={a.b.c}   />
            <*cpt @ddd(p1=1 p2="a'b'c" p3   p4={a.b.c})/>
        `, ctxt);

        assert.equal(str(r2), `
            <!>
                <div @deco @content={a.b.c}/>
                <*cpt @ddd( p1=1 p2='a\\'b\\'c' p3 p4={a.b.c})/>
            </>`, "2");
    });

    it("should serialize js statements and blocks", async function () {
        const r = await parse($fragment`
            <div>
                $if (a.b.c )   {
                    <span  />
                } else {
                    <*section>
                        <.header pos="top"> header </>
                        CONTENT
                    </>
                }
                $each(x.y, (item, idx) => {
                    {item}{idx}
                    $log("index", idx);
                });
            </div>
        `, ctxt);

        assert.equal(str(r), `
            <!>
                <div>
                    $if (a.b.c) {
                        <span/>
                    } else {
                        <*section>
                            <.header pos='top'>
                                 header 
                            </>
                             CONTENT 
                        </>
                    }
                    $each(x.y,(item,idx) => {
                         {item}{idx} 
                        $log("index", idx);
                    });
                </>
            </>`, "1");
    });

    it("should serialize $template strings and js blocks", async function () {
        const r = await parse($template`() => {
            $let x=1;
            some text
            $if (exp() ) {
                $exec x++;
                <div class={x}/>
            }
        }`);

        assert.equal(str(r), `
            () => {
                $let x=1;
                 some text 
                $if (exp() ) {
                    $exec x++;
                    <div class={x}/>
                }
            }`, "1");

        const r2 = await parse($template`  
        (a, b: string, c?, d?:boolean =false) => {
            $for (let i=0;10>i;i++) {
                <div class={"xx"+i}/>
            }
            $template foo(arg1:string, arg2=123) {
                <span class={arg1}/>
            }
        }`);

        assert.equal(str(r2), `
            (a, b:string, c?, d?:boolean = false) => {
                $for (let i=0;10>i;i++) {
                    <div class={"xx"+i}/>
                }
                $template foo (arg1:string, arg2 = 123) {
                    <span class={arg1}/>
                }
            }`, "1");
    });

    it("should serialize $fragment special chars", async function () {
        const r = await parse($fragment`
            <div> abc !< and !> and !{ and !} and !s and !n and !! and !$ and !/ and !_ def </>
        `, ctxt);

        assert.equal(str(r), `
            <!>
                <div>
                     abc !< and !> and !{ and !} and !s and !n and !! and !$ and !/ and !_ def 
                </>
            </>`, "1");
    });

    it("should serialize $fragment cdata", async function () {
        const r = await parse($fragment`
            <div> abc 
                <!cdata> hello !</!cdata> world </!cdata>
            def </>
        `, ctxt);

        assert.equal(str(r), `
            <!>
                <div>
                     abc 
                    <!cdata> hello !</!cdata> world </!cdata>
                     def 
                </>
            </>`, "1");
    });

    it("should serialize strings with no indent", async function () {
        const r = await parse($fragment`
            <div>
                $if (a.b.c )   {
                    <span  />
                } else {
                    <*section>
                        <.header pos="top"> header </>
                        CONTENT
                    </>
                }
                $each(x.y, (item, idx) => {
                    {item}{idx}
                    $log("index", idx);
                });
            </div>
        `, ctxt);

        assert.equal(str(r, ""), `<!><div>$if (a.b.c) {<span/>} else {<*section><.header pos='top'> header </> CONTENT </>}$each(x.y,(item,idx) => { {item}{idx} $log("index", idx);});</></>`, "1");
    });

});
