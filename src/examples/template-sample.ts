function $template(strings: TemplateStringsArray, ...keys: any[]): () => object {
    return function () {
        return {};
    }
}

const hello = $template `(name) => {
    <div> Hello {name}! </div>
}`;

const normalTemplateString = `hello world`;

const foo = $template`(state: MyStateType) => {
    This is some text

    // tag names
    <div foo="bar" bar={expr()+3}/> Text again
    <div> </div>
    <section /* comment */ />
    <a-b
        // comment
    > </a-b>
    <*foo> </>
    <*foo.bar> </*foo.bar>
    <.item> </.item>
    <@abc.def> </>
    <!></!> // fragment
    <! a=123></>
    !<abc/> // escaped <

    // text nodes
    Hello World
     some text  
     on 2 lines 
     some text with a #!
     &lt; &nbsp; &#160;  // html entities are not supported: use UTF-8 instead!
    Hello {getName(123, "abc")} 1+2+3
    // a
    !{no expr!} // escaped {

    // attributes
    <div class = "the_good_life"/>
    <span foo=123 bar=true baz="xyz" 
        // comment
        foo2 = 123.42 bar2 = false 
        someFunction={=>{doSomething();doSomethingElse();return 42}}
    />
    <span foo={a*2+123} bar="abc" aria-label="some label"/>
    <span bar='abc' aria-label='some label' [title]='single-quote value'/>
    <section title={::getTitle()} /> // one-time binding expression
    <foo @onclick(listener={e=>doSomething(e)} options={{passive:true}})
        @onmousemove={e=>$ctl.doSomething(e)}
        @onkeypress={=>foo()}
        />

    // no values attributes
    <div important disabled foo=123 />
    // properties
    <div [foo]=123 [baz]={expr()}/>
    // label attributes
    <div #foo #baz3 #blah/>
    <span #foo={bar()} ##fwd="abc"/>
    <*cpt ##bar2/>
    // binding shortcuts
    <span {title} {::title} {:: title} {[className ]} {::[className]}/>
    // bi-directional binding
    <span @model={=a.b.c}/> // TODO: only valid with a.b[a][2].c
    // param spread: not supported yet
    // <span {...expr()} {...[ expr() ]} {...{a:213, b:234}}/>

    // decorators
    <div @class={{foo:isTrue(), bar:!isTrue(), baz:1}} @defer @foo.bar={expr()} @bar.baz/>
    <div @disabled(foo={123} abc) disabled />
    <! @foo=123> </>

    // escape chars
    !< and !> and !{ and !} and !s and !n and !! and !$ and !z and !_ and !/
    !// no comment

    // sub-component with property nodes
    $let className = "main";
    <*b.tabBar @host(class={className} @foo)>
       <.tab id="a">
           <.title @tooltip(position="top" text={getMainTooltip()})> 
               <div class="main_tab"> Main tab (A) </div> 
            </.title>
            Hello {getTitle()} {getName()}
           <.footer> footer text </> 
       </.tab>
       $if (someCondition) {
           $let foo = "blah";
           <.tab id="b">
               Tab B content here
           </>
       }
    </*b.tabBar>

    !<!cdata att=123> // escaped

    // cdata
    <!cdata>
        CDATA values
        Special chars: {}<>!s!n$ (ignored)
        $if (foo) {bar}
        <div> Everything here is considered as a string </div>
        // including comments
        <!cdata>
        !</!cdata> // escaped cdata end
    </!cdata>
    
    // Dynamic attributes 
    <div>
        $if (test()) {
            <.title @value="Some title"/>
            <.someName @value={someValue()}/>
            // note: properties cannot be created/deleted dynamically as they are not part of the DOM
        }
    </div>

    // Dynamic nodes: not supported
    // <{getName()} class="foo"> Content </>
    // <{dynamicElt}/>
    // <.{someNameRef}/>
    <div @content={getContent()}/> // Dynamic content as VDOM or HTML string (will be parsed)
    <div [innerHTML]={getHTML()}/>  // Dynamic content as string (will be parsed)
    <div [textContent]={getText()}/>  // Dynamic content as text
    <! @content={getContent()}/>   // Dynamic content into a fragment
    <div @class(foo={expr()} bar={expr2()}) />

    // Fragments
    <!> Simple fragment </>
    <! #foo @detached> Detached fragment (not immediately inserted) </>

    // attribute decorators with multiple arguments
    <div @b.tooltip(
        title={getTooltipTitle()} 
        position="top" 
        important
    ) [className]={e()}/>

    <*list>
        <@tooltip position="top"> Tooltip content as HTML {expr(1+2)} </> // node decorator
        <.item key=1> Item 1 </.item>
        <.item key=2> Item 2 </>
        <.separator/>
        <.item key=3> Item 3 </>
        <.itemTemplate @value={anotherTemplateRef} />
    </*list>

    // JS statements
    $if (expr() + 42) {
        <div> Hello World </> 
    }
    $if (val) { Hello World }
    !$if (foo) !{!}
    $if (42) {
        some text
    } else if (123) {
        <div a="b"/>
        another text <b> in bold </b>
        $if (abc) {
            hi!
        }
    } else {
        yet another text <b> !!!!!! </b>
    }

    $for (let i=0;10>i;i++) /*comment*/ {
        <div title="hi"> Hello </>
    }
    !$for (let i=0;10>i;i++) // ignored

    $exec console.log("abc"); hello {world}
    !$exec foo.bar;

    $let x=123;
    $let y=someFunc("abc", "def") + 42 + foo({a:1, b:2}); some text
    $let a="a", b=expr(12), c, d:string, f:object={name:"the_name"};
    (some text)
    !$let foo=bar; // ignored

    $each(getItems(123), (item, index:number, isLast:boolean) => {abc
        //$trackBy(expr(item, index, isLast));?
        <div a="b"> ... </>
    });
    !$each(blah...) // ignored

    $log("hello");abc
    $log("a", someVar);
    !$log // ignored

    $template foo(arg1:string) {
        Hello world
        <div> some msg </>
    }
    !$template // ignored

    // pre-processor
    <div @@extract="someFile.ts#sectionA"/>

    // invalid case validation
    <div \important \bar=123 \[foo] \@decorator a.b \#foo />
}`;

const sectionSample = $template`() => {
    Here is a section sample
    <*section open=true>
        <.title> <b> The great section </b> </.title>
        Some content here
    </>
}`;

export const section = $template`(open:boolean, title:ContentNodes, content, $) => { // content = reserved name
    <div @host class="section">
        if (title) {
            <h1 class="title"> <! @innerHTML={title} /> </h1> // fragment with dynamic content
        }
        if (open) {
            <div class="content" @innerHTML={content}/>
        }
    </div>
}`;

class SomeClass {
    x = "re";
    superNiceProp = 42;

    render = $template`(foo) => {
        <div @host a={this.x}> 
            {this.superNiceProp}
        </div>
    }`;
}
