import * as assert from 'assert';
import { ast } from './utils';

describe('XJS $template parser', () => {
    it("should parse template functions", async function () {
        assert.equal(await ast.$template`() => {}`, `
            #tplFunction()
        ` , '1');

        assert.equal(await ast.$template`(a, b ) => {}`, `
            #tplFunction(a, b)
        ` , '2');

        assert.equal(await ast.$template`(a: string , b: boolean ) => {}`, `
            #tplFunction(a:string, b:boolean)
        ` , '3');

        assert.equal(await ast.$template`( $: MyParamClass) => {}`, `
            #tplFunction($:MyParamClass)
        ` , '4');

        assert.equal(await ast.$template`(a:xyz.SomeType) => {}`, `
            #tplFunction(a:xyz.SomeType)
        ` , '5');

        assert.equal(await ast.$template`(a, b?:string) => {}`, `
            #tplFunction(a, b?:string)
        ` , '6');

        assert.equal(await ast.$template`(a, b:string = "abcd") => {}`, `
            #tplFunction(a, b:string="abcd")
        ` , '7');
    });

    it("should parse the template function indentation", async function () {
        assert.equal(await ast.initIndent(`() => {}`), "", '1');
        assert.equal(await ast.initIndent(`() => {  
            // ...
        }`), "            ", '2');
        assert.equal(await ast.initIndent(`() => {
            <div/>
        }`,), "            ", '3');
        assert.equal(await ast.initIndent(`() => {
            <!/>
        }`,), "            ", '4');
        assert.equal(await ast.initIndent(`() => {
              # Hello #
        }`,), "              ", '5');
        assert.equal(await ast.initIndent(`() => {
                abc
                def
        }`), "                ", '6');
    });

    it("should parse simple text nodes", async function () {
        assert.equal(await ast.$template`() => {
            Hello World
        }`, `
            #tplFunction()
                #textNode " Hello World "
        ` , '1');

        assert.equal(await ast.$template`() => {
            Hello 
            World
        }`, `
            #tplFunction()
                #textNode " Hello World "
        ` , '2');

        assert.equal(await ast.$template`(a) => {
            # Hello {a+2} #
        }`, `
            #tplFunction(a)
                #textNode
                    " # Hello "
                    #expression {a+2}
                    " # "
        ` , '3');

        assert.equal(await ast.$template`(a) => {
            {a}{::a*2}
        }`, `
            #tplFunction(a)
                #textNode
                    " "
                    #expression {a}
                    ""
                    #expression {::a*2}
                    " "
        ` , '4');

        assert.equal(await ast.$template`(a) => {
            {a} +++
        }`, `
            #tplFunction(a)
                #textNode
                    " "
                    #expression {a}
                    " +++ "
        ` , '5');
    });

    it("should support special characters in text nodes", async function () {
        assert.equal(await ast.$template`() => {
            !< and !> and !{ and !} and !s and !n and !! and !$ and !/ and !_
        }`, `
            #tplFunction()
                #textNode " < and > and { and } and   and \n and ! and $ and / and   "
        `, "1")

        assert.equal(await ast.$template`() => {
            !z no spaces before and here -!> !z !<- and 

            here 
            
            !z
        }`, `
            #tplFunction()
                #textNode "no spaces before and here -><- and here"
        `, "2")

        assert.equal(await ast.$template`() => {
            {exp1}   {exp2} !z {exp3}{exp4}

            !z {exp5}
        }`, `
            #tplFunction()
                #textNode
                    " "
                    #expression {exp1}
                    " "
                    #expression {exp2}
                    ""
                    #expression {exp3}
                    ""
                    #expression {exp4}
                    ""
                    #expression {exp5}
                    " "
        `, "3")

        assert.equal(await ast.$template`() => {
            $foo() and $bar abc;
        }`, `
            #tplFunction()
                #textNode " $foo() and $bar abc; "
        `, "4")
    });

    it("should parse self-closing element nodes", async function () {
        assert.equal(await ast.$template`() => {
            <div/>
            <span  />
        }`, `
            #tplFunction()
                #element <div/>
                #element <span/>
        ` , '1');
    });

    it("should parse elements in element nodes", async function () {
        assert.equal(await ast.$template`() => {
            <div>
                <section>
                    <div/>
                    Some text
                </>
                <span/>
            </div>
            <span  />
        }`, `
            #tplFunction()
                #element <div>
                    #element <section>
                        #element <div/>
                        #textNode " Some text "
                    #element <span/>
                #element <span/>
        ` , '1');
    });

    it("should parse params", async function () {
        assert.equal(await ast.$template`() => {
            <div a=123 b = "abc" c  =true d   = false/>
        }`, `
            #tplFunction()
                #element <div a=123 b="abc" c=true d=false/>
        ` , '1');

        assert.equal(await ast.$template`() => {
            <div a="abc" disabled d=true important/>
        }`, `
            #tplFunction()
                #element <div a="abc" disabled d=true important/>
        ` , '2');

        assert.equal(await ast.$template`() => {
            <div a={1+2+3} b={:: foo() }/>
        }`, `
            #tplFunction()
                #element <div a={1+2+3} b={::foo()}/>
        ` , '3');

        assert.equal(await ast.$template`() => {
            <div aria-label="some label"/>
        }`, `
            #tplFunction()
                #element <div aria-label="some label"/>
        ` , '4');
    });

    it("should parse function params", async function () {
        assert.equal(await ast.$template`() => {
            <div f={()=>{abc();def();return 42}}/>
        }`, `
            #tplFunction()
                #element <div f={()=>{abc();def();return 42}}/>
        ` , '1');

        assert.equal(await ast.$template`() => {
            <div f={=>abc()}/>
        }`, `
            #tplFunction()
                #element <div f={()=>abc()}/>
        ` , '2');

        assert.equal(await ast.$template`() => {
            <div f={e=>abc(e)}/>
        }`, `
            #tplFunction()
                #element <div f={e=>abc(e)}/>
        ` , '3');

        assert.equal(await ast.$template`() => {
            <div f={(a,b)=>{abc(a,b); return 9;}}/>
        }`, `
            #tplFunction()
                #element <div f={(a,b)=>{abc(a,b); return 9;}}/>
        ` , '4');
    });

    it("should parse binding shortcuts", async function () {
        assert.equal(await ast.$template`() => {
            <div {title}/>
        }`, `
            #tplFunction()
                #element <div title={title}/>
        ` , '1');

        assert.equal(await ast.$template`() => {
            <div { title  }/>
        }`, `
            #tplFunction()
                #element <div title={title}/>
        ` , '2');

        assert.equal(await ast.$template`() => {
            <div {::title  }/>
        }`, `
            #tplFunction()
                #element <div title={::title}/>
        ` , '3');

        assert.equal(await ast.$template`() => {
            <div {[className]}/>
        }`, `
            #tplFunction()
                #element <div [className]={className}/>
        ` , '4');

        assert.equal(await ast.$template`() => {
            <div {[ className  ]}/>
        }`, `
            #tplFunction()
                #element <div [className]={className}/>
        ` , '5');

        assert.equal(await ast.$template`() => {
            <div {::[ className  ]}/>
        }`, `
            #tplFunction()
                #element <div [className]={::className}/>
        ` , '6');

        assert.equal(await ast.$template`() => {
            <*cpt {title}/>
        }`, `
            #tplFunction()
                #component <*cpt title={title}/>
        ` , '7');

        assert.equal(await ast.$template`() => {
            <*cpt>
                <.param {title}/>
            </>
        }`, `
            #tplFunction()
                #component <*cpt>
                    #paramNode <.param title={title}/>
        ` , '8');

        assert.equal(await ast.$template`() => {
            <div {title} {foo}/>
        }`, `
            #tplFunction()
                #element <div title={title} foo={foo}/>
        ` , '9');

        assert.equal(await ast.$template`() => {
            <div @foo(data="x" {title} {foo})/>
        }`, `
            #tplFunction()
                #element <div @foo(data="x" title={title} foo={foo})/>
        ` , '10');
    });

    it("should parse comments in params", async function () {
        assert.equal(await ast.$template`() => {
            <div a=123 /* comment 1 */ b = "abc" 
                c  =true // comment 2
                // comment 3
                d   = false/>
        }`, `
            #tplFunction()
                #element <div a=123 b="abc" c=true d=false/>
        ` , '1');
    });

    it("should parse properties", async function () {
        assert.equal(await ast.$template`() => {
            <div [prop]= 123 [b]={ abc(123 )}/>
        }`, `
            #tplFunction()
                #element <div [prop]=123 [b]={abc(123 )}/>
        ` , '1');
    });

    it("should parse labels", async function () {
        assert.equal(await ast.$template`() => {
            <div #foo #bar/>
            <*cpt #baz ##blah/>
        }`, `
            #tplFunction()
                #element <div #foo #bar/>
                #component <*cpt #baz ##blah/>
        ` , '1');

        assert.equal(await ast.$template`() => {
            <div #foo=123 #bar="abc"/>
            <*cpt #baz={expr()} ##blah={expr2()}/>
        }`, `
            #tplFunction()
                #element <div #foo=123 #bar="abc"/>
                #component <*cpt #baz={expr()} ##blah={expr2()}/>
        ` , '1');
    });

    it("should parse decorator params", async function () {
        assert.equal(await ast.$template`() => {
            <div @foo @important/>
        }`, `
            #tplFunction()
                #element <div @foo @important/>
        ` , '1');

        assert.equal(await ast.$template`() => {
            <div @bar=123 @baz={someExpr(1, 2, 3)}/>
        }`, `
            #tplFunction()
                #element <div @bar=123 @baz={someExpr(1, 2, 3)}/>
        ` , '2');

        assert.equal(await ast.$template`() => {
            <div @foo(a=1 b={123 / 3} @disabled @bar=2) @bar=4/>
        }`, `
            #tplFunction()
                #element <div @foo(a=1 b={123 / 3} @disabled @bar=2) @bar=4/>
        ` , '3');
    });

    it("should parse components", async function () {
        assert.equal(await ast.$template`() => {
            <div>
                <*foo p1=123 @class(active={expr()})>
                    <div/>
                    Some text
                </*foo>
                <*bar blah/>
                <*b.message>
                    <*warning/>
                </>
            </div>
        }`, `
            #tplFunction()
                #element <div>
                    #component <*foo p1=123 @class(active={expr()})>
                        #element <div/>
                        #textNode " Some text "
                    #component <*bar blah/>
                    #component <*b.message>
                        #component <*warning/>
        ` , '1');
    });

    it("should parse decorator nodes", async function () {
        assert.equal(await ast.$template`() => {
            <div @highlight>
                <@b.tooltip @class(dark={e()}) position="top" sync = false>
                    Rich content
                </>
                Div content
            </div>
        }`, `
            #tplFunction()
                #element <div @highlight node:@b.tooltip>
                    #decoratorNode <@b.tooltip[utils] @class(dark={e()}) position="top" sync=false>
                        #textNode " Rich content "
                    #textNode " Div content "
        ` , '1');
    });

    it("should parse param nodes", async function () {
        assert.equal(await ast.$template`() => {
            <*b.section>
                <.header class="big">
                    <b> Rich header content </b>
                    <.sidePanel>
                        <button class="cool"/>
                    </>
                </>
                Section content
                <.footer> some info </>
            </>
        }`, `
            #tplFunction()
                #component <*b.section>
                    #paramNode <.header class="big">
                        #element <b>
                            #textNode " Rich header content "
                        #paramNode <.sidePanel>
                            #element <button class="cool"/>
                    #textNode " Section content "
                    #paramNode <.footer>
                        #textNode " some info "
        ` , '1');
    });

    // it("should parse spread expressions", async function () {
    //     assert.equal(await ast.$template`() => {
    //         <div {... expr(123)   }/>
    //     }`, `
    //         #tplFunction()
    //             #element <div {... expr(123)   }/>
    //     ` , '1');

    //     assert.equal(await ast.$template`() => {
    //         <div {...[ expr(123)   ]}/>
    //     }`, `
    //         #tplFunction()
    //             #element <div {...[ expr(123)   ]}/>
    //     ` , '2');
    // });

    // it("should parse params in text nodes", async function () {
    //     assert.equal(await ast.$template`() => {
    //         <div>
    //             # (#foo @i18n="abc") Hello World #
    //         </div>
    //     }`, `
    //         #tplFunction()
    //             #element <div>
    //                 #textNode(#foo @i18n="abc") " Hello World "
    //     ` , '1');
    // });

    // it("should parse elements with name expressions", async function () {
    //     assert.equal(await ast.$template`() => {
    //         <{expr()} a="valueA"/>
    //     }`, `
    //         #tplFunction()
    //             #element <{expr()} a="valueA"/>
    //     ` , '1');

    //     assert.equal(await ast.$template`() => {
    //         <.{::expr()}>
    //         </>
    //     }`, `
    //         #tplFunction()
    //             #paramNode <.{::expr()}>
    //     ` , '2');
    // });

    it("should parse $let js statements", async function () {
        assert.equal(await ast.$template`() => {
            abc$let x = 123;def
        }`, `
            #tplFunction()
                #textNode " abc"
                #jsStatement
                    let x = 123;
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$template`() => {
            $let foo='bar';
            // comment
            $let y = "abc";
            !$let z;
        }`, `
            #tplFunction()
                #jsStatement
                    let foo='bar';
                #jsStatement
                    let y = "abc";
                #textNode " $let z; "
        ` , '2');

        assert.equal(await ast.$template`() => {
            $let foo='bar', baz={a:"AA", b:42};
            <div>
                // comment
                <span/>
                $let foo = "abc",
                    bar = 123;
                <div class={foo} />

            </div>
            $let y = 3;
        }`, `
            #tplFunction()
                #jsStatement
                    let foo='bar', baz={a:"AA", b:42};
                #element <div>
                    #element <span/>
                    #jsStatement
                        let foo = "abc",
                        bar = 123;
                    #element <div class={foo}/>
                #jsStatement
                    let y = 3;
        ` , '3');
    });

    it("should parse $exec js statements", async function () {
        assert.equal(await ast.$template`() => {
            abc$exec x = 123 + foo({a:"b"});def
        }`, `
            #tplFunction()
                #textNode " abc"
                #jsStatement
                    x = 123 + foo({a:"b"});
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$template`() => {
            $let y=123;
            // comment
            $exec y++;
            !$exec ...
        }`, `
            #tplFunction()
                #jsStatement
                    let y=123;
                #jsStatement
                    y++;
                #textNode " $exec ... "
        ` , '2');
    });

    it("should parse $log js statements", async function () {
        assert.equal(await ast.$template`() => {
            abc$log (x, y+42, "...");def
        }`, `
            #tplFunction()
                #textNode " abc"
                #jsStatement
                    console.log(x, y+42, "...");
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$template`() => {
            $log("abc");
            // comment
            Some text
            $log ("def", foo) ;
            !$log ...
        }`, `
            #tplFunction()
                #jsStatement
                    console.log("abc");
                #textNode " Some text "
                #jsStatement
                    console.log("def", foo);
                #textNode " $log ... "
        ` , '2');
    });

    it("should parse $if js blocks", async function () {
        assert.equal(await ast.$template`(a) => {
            abc$if (a) {
                <div>
                    hello
                </div>
            }def
        }`, `
            #tplFunction(a)
                #textNode " abc"
                #jsBlock
                    if (a) {
                        #element <div>
                            #textNode " hello "
                    }
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$template`(a, b) => {
            $if (a) {
                <div/>
            } else if (b) {
                <span/>
            } else {
                Done!
            }
        }`, `
            #tplFunction(a, b)
                #jsBlock
                    if (a) {
                        #element <div/>
                    }
                #jsBlock
                    else if (b) {
                        #element <span/>
                    }
                #jsBlock
                    else {
                        #textNode " Done! "
                    }
        ` , '2');

        assert.equal(await ast.$template`(a, b) => {
            $if (a) {
                case A
            } else {
                $exec foo();
                case else
            }
        }`, `
            #tplFunction(a, b)
                #jsBlock
                    if (a) {
                        #textNode " case A "
                    }
                #jsBlock
                    else {
                        #jsStatement
                            foo();
                        #textNode " case else "
                    }
        ` , '3');
    });

    it("should parse $for js blocks", async function () {
        assert.equal(await ast.$template`(a) => {
            abc$for (let i=0;10>i;i++) {
                <div class={"x"+i}>
                    hello
                </div>
            }def
        }`, `
            #tplFunction(a)
                #textNode " abc"
                #jsBlock
                    for (let i=0;10>i;i++) {
                        #element <div class={"x"+i}>
                            #textNode " hello "
                    }
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$template`(a, b) => {
            $for (let =0;items.length>i;i++) {
                $let item = items[i];
                <div>
                    Item #{i+1}
                </>
            }
            !$for (end)
        }`, `
            #tplFunction(a, b)
                #jsBlock
                    for (let =0;items.length>i;i++) {
                        #jsStatement
                            let item = items[i];
                        #element <div>
                            #textNode
                                " Item #"
                                #expression {i+1}
                                " "
                    }
                #textNode " $for (end) "
        ` , '2');

        assert.equal(await ast.$template`(a) => {
            $for (let i=0;10>i;i++) {<div class={"x"+i}/>}
        }`, `
            #tplFunction(a)
                #jsBlock
                    for (let i=0;10>i;i++) {
                        #element <div class={"x"+i}/>
                    }
        ` , '3');
    });

    it("should parse $each js blocks", async function () {
        assert.equal(await ast.$template`(a) => {
            abc$each (items, (item, index, isLast) => {
                <div class={"x"+index}>
                    hello
                </div>
            } ) ;def
        }`, `
            #tplFunction(a)
                #textNode " abc"
                #jsBlock
                    each(items,(item, index, isLast) => {
                        #element <div class={"x"+index}>
                            #textNode " hello "
                    });
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$template`(a, b) => {
            $each ( a.getItems()  , ( item , index , isLast ) => {
                <div>
                    Item #{i+1}
                </>
            });
            !$each (end)
        }`, `
            #tplFunction(a, b)
                #jsBlock
                    each(a.getItems(),( item , index , isLast ) => {
                        #element <div>
                            #textNode
                                " Item #"
                                #expression {i+1}
                                " "
                    });
                #textNode " $each (end) "
        ` , '2');
    });

    it("should parse $template js blocks", async function () {
        assert.equal(await ast.$template`(a) => {
            abc$template foo (arg1, arg2:string) {
                <div class={"x"+index}>
                    hello
                </div>
            }def
        }`, `
            #tplFunction(a)
                #textNode " abc"
                #tplFunction foo (arg1, arg2:string)
                    #element <div class={"x"+index}>
                        #textNode " hello "
                #textNode "def "
        ` , '1');

        assert.equal(await ast.$template`(a, b) => {
            some text
            $template details(i) {
                <div> detail {i} </>
            }
            !$template (end)
        }`, `
            #tplFunction(a, b)
                #textNode " some text "
                #tplFunction details (i)
                    #element <div>
                        #textNode
                            " detail "
                            #expression {i}
                            " "
                #textNode " $template (end) "
        ` , '2');
    });

    it("should properly handle object literals", async function () {
        assert.equal(await ast.$template`(a,b) => {
            $let x =  { a:a, b:b };
            <div/>
        }`, `
            #tplFunction(a, b)
                #jsStatement
                    let x =  { a:a, b:b };
                #element <div/>
        ` , '1');

        assert.equal(await ast.$template`(a,b) => {
            $let x;
            $if (a) {
                $exec x = {
                    a:a, 
                    b:b
                };
                $exec a+=b;
            }
        }`, `
            #tplFunction(a, b)
                #jsStatement
                    let x;
                #jsBlock
                    if (a) {
                        #jsStatement
                            x = {
                            a:a, 
                            b:b
                            };
                        #jsStatement
                            a+=b;
                    }
        ` , '2');

        assert.equal(await ast.$template`(a,b) => {
            $let x;
            $if (a) {
                // indent initializer
                $exec x = {
                    a: { a: a}, 
                    b:b
                };
                <div/>
            }
        }`, `
            #tplFunction(a, b)
                #jsStatement
                    let x;
                #jsBlock
                    if (a) {
                        #jsStatement
                            x = {
                            a: { a: a}, 
                            b:b
                            };
                        #element <div/>
                    }
        ` , '3');
    });

    it("should support optional template arguments", async function () {
        assert.equal(await ast.$template`(header?:IvContent) => {
            $if (header) {
                <div class="header"/>
            }
        }`, `
            #tplFunction(header?:IvContent)
                #jsBlock
                    if (header) {
                        #element <div class="header"/>
                    }
        ` , '1');

        assert.equal(await ast.$template`(foo:string, title?) => {
            $if (title) {
                <div class="title"/>
            }
        }`, `
            #tplFunction(foo:string, title?)
                #jsBlock
                    if (title) {
                        #element <div class="title"/>
                    }
        ` , '2');
    });

    it("should support type arrays in template params", async function () {
        assert.equal(await ast.$template`(foo: FooClass, bar: BarClass[], baz: x.BazClass[][]) => {
            Hello
        }`, `
            #tplFunction(foo:FooClass, bar:BarClass[], baz:x.BazClass[][])
                #textNode " Hello "
        ` , '1');
    });

    it("should support default values for template parameters", async function () {
        assert.equal(await ast.$template`(foo="") => {
            Hello
        }`, `
            #tplFunction(foo="")
                #textNode " Hello "
        ` , '1');

        assert.equal(await ast.$template`(idx1 = 12.3, idx2:number =123, foo:string="bar", foo2= 'bar2', baz:boolean = false, blah:any=true) => {
            Hello
        }`, `
            #tplFunction(idx1=12.3, idx2:number=123, foo:string="bar", foo2='bar2', baz:boolean=false, blah:any=true)
                #textNode " Hello "
        ` , '2');

        // assert.equal(await ast.$template`(foo = func("abc", 123), bar = new SuperBar(123) ) => {
        //     # Hello #
        // }`, `
        //     #tplFunction()
        //         #textNode " Hello "
        // ` , '3');
    });

    it("should support comments in template arguments", async function () {
        assert.equal(await ast.$template`($api:HelloAPI, name /* comment */) => {
            Hello
        }`, `
            #tplFunction($api:HelloAPI, name)
                #textNode " Hello "
        ` , '1');
    });

    it("should support comments in params", async function () {
        assert.equal(await ast.$template`() => {
            <div 
                // comment
                    foo="bar">
                Hello
            </div>
        }`, `
            #tplFunction()
                #element <div foo="bar">
                    #textNode " Hello "
        ` , '1');
    });

    it("should support 2-way binding expressions", async function () {
        assert.equal(await ast.$template`() => {
            <*cpt foo={=a.b.c}/>
        }`, `
            #tplFunction()
                #component <*cpt foo={2b:a.b.c}/>
        ` , '1');
    });

    it("should support single quote for string values", async function () {
        assert.equal(await ast.$template`() => {
            <div class='abc' [title]='def'>
                <*b.section title='hello'>
                    <.header class='big'>
                        <b> Rich header content </b>
                        <.sidePanel>
                            <button class='cool'/>
                        </>
                    </>
                    Section content
                </>
            </div>
        }`, `
            #tplFunction()
                #element <div class="abc" [title]="def">
                    #component <*b.section title="hello">
                        #paramNode <.header class="big">
                            #element <b>
                                #textNode " Rich header content "
                            #paramNode <.sidePanel>
                                #element <button class="cool"/>
                        #textNode " Section content "
        ` , '1');
    });

    it("should parse child fragments", async function () {
        assert.equal(await ast.$template`() => {
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
        }`, `
            #tplFunction()
                #element <div>
                    #element <span>
                        #textNode " Hello World "
                    #fragment <! @foo @bar="baz">
                        #component <*foo>
                            #textNode "ABC DEF G"
                        #component <*bar>
                            #paramNode <.header/>
                            #textNode " Hello again "
                #fragment <!>
                    #textNode " text "
        `, "1")
    });

    it("should parse cdata nodes", async function () {
        assert.equal(await ast.$template`() => {
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
        }`, `
            #tplFunction()
                #element <div>
                    #element <span>
                        #textNode " Hello World "
                    #cdata <!cdata @foo @bar="baz">

                    <*foo>ABC DEF    G</*foo>
                    </!cdata> // escaped
                    <*bar>
                        <.header  />
                        Hello again
                    </>
                
                #cdata <!cdata>

                text \\n \\s xyz
            
        `, "1")

    });

    // todo special chars in text node
    // todo @@preprocessor
    // TODO: support function call and new initialization in template args?
});
