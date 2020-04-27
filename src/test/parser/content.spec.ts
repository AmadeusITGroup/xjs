import * as assert from 'assert';
import { ast } from './utils';

describe('XJS $fragment parser', () => {

    it("should support special characters in text nodes", async function () {
        assert.equal(await ast.$fragment`
            !< and !> and !{ and !} and !s and !n and !! and !$ and !/ and !_
        `, `
            #fragment <!>
                #textNode " < and > and { and } and   and \n and ! and $ and / and   "
        `, "1")

        assert.equal(await ast.$fragment`
            !z no spaces before and here -!> !z !<- and 

            here 
            
            !z
        `, `
            #fragment <!>
                #textNode "no spaces before and here -><- and here"
        `, "2")

        assert.equal(await ast.$fragment`
            {exp1}   {exp2} !z {exp3}{exp4}

            !z {exp5}
        `, `
            #fragment <!>
                #textNode
                    " "
                    #expression {#exp1}
                    " "
                    #expression {#exp2}
                    ""
                    #expression {#exp3}
                    ""
                    #expression {#exp4}
                    ""
                    #expression {#exp5}
                    " "
        `, "3")

        assert.equal(await ast.$fragment`
            $foo() and $bar abc;
        `, `
            #fragment <!>
                #textNode " $foo() and $bar abc; "
        `, "4")
    });

    it("should support ${expressions}", async function () {
        assert.equal(await ast.$fragment`
            (start) ${" abc <div/> "} (end)
        `, `
            #fragment <!>
                #textNode " (start) abc "
                #element <div/>
                #textNode " (end) "
        `, "1")
    });

    it("should ignore () => {} at start", async function () {
        assert.equal(await ast.$fragment`(a:string) => !{
            next line
        `, `
            #fragment <!>
                #textNode "(a:string) => { next line "
        `, "1")
    });

    it("should ignore unauthorized js statements", async function () {
        assert.equal(await ast.$fragment`
            $for (let i=0;10>i;i++)
            <!/>
            $template foo (arg1, arg2:string) 
            <!/>
            $let y=123;
            <!/>
            $exec y++;
        `, `
            #fragment <!>
                #textNode " $for (let i=0;10>i;i++) "
                #fragment <!/>
                #textNode " $template foo (arg1, arg2:string) "
                #fragment <!/>
                #textNode " $let y=123; "
                #fragment <!/>
                #textNode " $exec y++; "
        `, "1")
    });

    it("should support ref expressions", async function () {
        assert.equal(await ast.$fragment`
            abc {a.b.c} def
            <div class="x" title={d.e.f} {prop}/>
        `, `
            #fragment <!>
                #textNode
                    " abc "
                    #expression {#a.b.c}
                    " def "
                #element <div class="x" title={#d.e.f} prop={prop}/>
        `, "1")
    });

    it("should support refs for components and decorators", async function () {
        assert.equal(await ast.$fragment`
            <*lib.cptA arg="abc">
                Some content
            </>
        `, `
            #fragment <!>
                #component <*lib.cptA arg="abc">
                    #textNode " Some content "
        `, "1")

        assert.equal(await ast.$fragment`
            <div @x.deco @y.foo="bar">
                Some content
            </>
        `, `
            #fragment <!>
                #element <div @x.deco @y.foo="bar">
                    #textNode " Some content "
        `, "2")

        assert.equal(await ast.$fragment`
            <div>
                <@x.y.deco foo="bar"> 
                    Deco content
                </>
                Some content
            </>
        `, `
            #fragment <!>
                #element <div node:@x.y.deco>
                    #decoratorNode <@x.y.deco[utils] foo="bar">
                        #textNode " Deco content "
                    #textNode " Some content "
        `, "3")
    });

    it("should parse $if js blocks", async function () {
        assert.equal(await ast.$fragment`
            abc$if (a) {
                <div>
                    hello
                </div>
            }def
        `, `
            #fragment <!>
                #textNode " abc"
                #jsBlock [a]
                    if (a) {
                        #element <div>
                            #textNode " hello "
                    }
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$fragment`
            $if (a.b.c) {
                <div/>
            } else if (b.d) {
                <span/>
            } else {
                Done!
            }
        `, `
            #fragment <!>
                #jsBlock [a,b,c]
                    if (a.b.c) {
                        #element <div/>
                    }
                #jsBlock [b,d]
                    else if (b.d) {
                        #element <span/>
                    }
                #jsBlock
                    else {
                        #textNode " Done! "
                    }
        ` , '2');

        assert.equal(await ast.$fragment`
            $if (xx.yy) {
                case A
            } else {
                case else
            }
        `, `
            #fragment <!>
                #jsBlock [xx,yy]
                    if (xx.yy) {
                        #textNode " case A "
                    }
                #jsBlock
                    else {
                        #textNode " case else "
                    }
        ` , '3');
    });

    it("should parse $log js statements", async function () {
        assert.equal(await ast.$fragment`
            abc$log (tx, y.z, "...");def
        `, `
            #fragment <!>
                #textNode " abc"
                #jsStatement
                    log(tx, y.z, "...");
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$fragment`
            $log("abc");
            // comment
            Some text
            $log ("def", foo.bar,zz ) ;
            !$log ...
        `, `
            #fragment <!>
                #jsStatement
                    log("abc");
                #textNode " Some text "
                #jsStatement
                    log("def", foo.bar, zz);
                #textNode " $log ... "
        ` , '2');
    });

    it("should parse $each js blocks", async function () {
        assert.equal(await ast.$fragment`
            abc$each (items, (item, index, isLast) => {
                <div class={index}>
                    hello
                </div>
            } ) ;def
        `, `
            #fragment <!>
                #textNode " abc"
                #jsBlock [items, item, index, isLast]
                    each(items,(item,index,isLast) => {
                        #element <div class={#index}>
                            #textNode " hello "
                    });
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$fragment`
            $each ( items  , ( item /* comment */ , index :number , isLast: boolean  ) => {
                <div>
                    Item #{i}
                </>
            });
            !$each (end)
        `, `
            #fragment <!>
                #jsBlock [items, item, index, isLast]
                    each(items,(item,index,isLast) => {
                        #element <div>
                            #textNode
                                " Item #"
                                #expression {#i}
                                " "
                    });
                #textNode " $each (end) "
        ` , '2');
    });
});
