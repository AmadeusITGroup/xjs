
// xx template engine interface: XJS should not be bound to a template engine (like JSX)
const xx = {
    template: function (s: string) { }
}

const normalTemplateString = `hello world`;

const foo = xx.template(`(state: MyStateType) => {
    // tag names
    <div/>
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
    <!></>

    // text nodes
    # Hello World #
     # some text  
      on 2 lines #
      # some text with a \#! #
      # &lt; &nbsp; &#160; # // html entities are not supported: use UTF-8 instead!
    # Hello {getName()} {1+2+3} #

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
    // param spread
    <span {...expr()} {...[ expr() ]} {...{a:213, b:234}}/>

    // decorators
    <div @class={{foo:isTrue(), bar:!isTrue(), baz:1}} @defer @foo.bar={expr()} @bar.baz/>
    <div @disabled(foo={123} abc) disabled />
    <! @foo=123> </>

    // sub-component with property nodes
    const className = "main";
    <*b.tabBar @host(class={className} @foo)>
       <.tab id="a">
           <.title @tooltip(position="top" text={getMainTooltip()})> 
               <div class="main_tab"> # Main tab (A) # </div> 
            </.title>
           # (#foo @i18n(id="contentA" gender={getGender()})) Hello {getTitle()} {getName()} #
           <.footer> # footer text # </> 
       </.tab>
       if (someCondition) {
           <.tab id="b">
               # Tab B content here #
           </>
       }
    </*b.tabBar>

    # (#myNode @i18n(ref=123 gender={getGender()})) Some string that depends 
     on gender (@foo -> invalid here: must at the beginning of the string) #
    
    // Dynamic attributes 
    <div>
        if (test()) {
            <.title @value="Some title"/>
            <.{someName()} @value={someValue()}/>
            // note: properties cannot be created/deleted dynamically as they are not part of the DOM
        }
    </div>

    // Dynamic nodes
    <{getName()} class="foo"> # Content # </>
    <{dynamicElt}/>
    <.{someNameRef}/>
    <div @content={getContent()}/> // Dynamic content as VDOM or HTML string (will be parsed)
    <div [innerHTML]={getHTML()}/>  // Dynamic content as string (will be parsed)
    <div [textContent]={getText()}/>  // Dynamic content as text
    <! @content={getContent()}/>   // Dynamic content into a fragment
    <div @class(foo={expr()} bar={expr2()}) />

    // Fragments
    <!> # Simple fragment # </>
    <! #foo @detached> # Detached fragment (not immediately inserted) # </>

    // attribute decorators with multiple arguments
    <div @b.tooltip(
        title={getTooltipTitle()} 
        position="top" 
        important
    ) [className]={e()}/>

    <*list>
        <@tooltip position="top"> # Tooltip content as HTML {expr(1+2)} # </> // node decorator
        <.item key=1> #Item 1# </.item>
        <.item key=2> #Item 2# </>
        <.separator/>
        <.item key=3> #Item 3# </>
        <.itemTemplate @value={anotherTemplateRef} />
    </*list>

    // invalid case validation
    <div \important \bar=123 \[foo] \@decorator a.b \#foo />
}`);

const sectionSample = xx.template(`() => {
    # Here is a section sample #
    <*section open=true>
        <.title> <b> # The great section # </b> </.title>
        # Some content here #
    </>
}`);

export const section = xx.template(`(open:boolean, title:ContentNodes, content, $) => { // content = reserved name
    <div @host class="section">
        if (title) {
            <h1 class="title"> <! @innerHTML={title} /> </h1> // fragment with dynamic content
        }
        if (open) {
            <div class="content" @innerHTML={content}/>
        }
    </div>
}`);

class SomeClass {
    x = "re";
    superNiceProp = 42;

    render = xx.template(`(foo) => {
        <div @host a={this.x}> 
            # {this.superNiceProp} #
        </div>
    }`);
}
