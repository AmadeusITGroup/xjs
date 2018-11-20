
let normalTemplateString2 = `
    This text should not be impacted
    <div> by the xts highlighter </div>
`;

let someTemplate2 = `@template (arg: string, alert) => {
    if (true) {
        <div foo="bar" bar=123 paw={ expr()+123+ 2%4 } @b:important >
            if (true) {
                # hello {expr(wer + 123)+123} 
                
                    world
                #
            }
            <:alert p:className="" class="the class" > </:alert>
        </div>
    }

    if (i < 123) {
        <></>
    }
    
    <:b.alert>
        if (arg === 123) {
            # Hello \% Brave \` \`
            New <div/>
            World #
        }
    </:b.alert>

    // sub-component call with data nodes
    <:tabbar>
       <$tab id="a"> // $tab is a value node
           <$title> <b> # Some fancy title # </b> </$title>
           # Tab A content here rewew #
           <$footer> % footer text % </> // % is not valid
       </$tab>
       if (someCondition) {
           <$tab id="b" title={getTitle()} >
               # Tab B content here #
           </>
       }
    </:tabbar>

    // single elt
    <single-elt/>
    <single-elt> # Hello \# World # </single-elt>
    
    // sample attributes with values
    <div a="a \" string" a2='another \' string' b=12 b2=12.32 b3=.5 
    c=true c2=false d={2+34} d2 = {someFunction(1,2,"3") + 42}     d3={::expr()}/>

    // sample attributes with no values
    <div foo bar baz=123/>
    <input disabled value="abc"/>

    // sample function attributes
    <div onclick = (e)=>{doSomething(e)}/>
    <div onclick = function(e:Event){doSomething(e)}/>
    <div onclick = ()=>{doSomething();let x=123;return expr(x)} title="hi"/>
    <div onclick = function(){doSomething();let x=123;return expr(x)} title="hi"/>
    
    // sample attributes with xmlns prefix
    <div a:foo b:baz=123/>

    // attribute with map name 
    <div p:style.backgroundColor={getColor()} a.b.c></div>

    // sub-template call on local scope
    <:localTemplate> </:localTemplate> // localTemplate is a variable accessible in the local JS scope
    <:foo a="abc"/>


    // simple text node
    # Hello #

    // simple text node multi-line
    # Hello
      World #
    
    // text node with inline expression + one-time binding
    # hello {12+32  + foo(someArg)} 
    {::expr(123+35, "aaa", arg3)} 
    world #
    
    // no-arguments attribute decorator
    <div @defer @b:important @host/>

    // comment in attributes
    <div a=123 // some comments
        b="abc" /* another comment */ hello="world"/>

    // attribute decorators with multiple arguments
    <div @b.tooltip(
            title={getTooltipTitle()} 
            position="top" 
            important
        ) [className]={e()}/> // className is a property (default = attribute)

    // attribute decorator with value argument
    for (let i=0;10>i;i++) {
        <div @trackBy={expr(i)}> </div>
    }

    // node decorators
    if (someExpr()) {
        <div>
            <@b:tooltip important position="top">
                <:title> # Some title content here # </>
                if (true) {}
            </@b:tooltip>
        </div>
    }

    // spread operator
    <div {...{att1: a, att2:b}} {...expr(123)} {...myVar}/>
    # Hello {...expr()} {p:...expr()} # // note: this should be rejected by the compiler but is valid for TM
    <div {::...expr()} /> // one-time spread on attributes

    // spread operator on properties
    <span {p:...expr()}/>
    <div {::p:...expr()} /> // one-time spread on properties

    // 2-way binding
    <input type="text" @model={=this.someProp}/>

    // local refs #foo #foo[] #foo[{expr()}]
    <div #foo title="123"/>
    <div #foo[] @host/>
    <div #foo[{expr(123)}] important bar=234/>

    // fragments
    for (let i=0;10>i;i++) {
        <@trackBy={expr(i)} #col[{i}]>
            <div> # Begin # </div>
            <div> # End # </div>
        </>
    }
    <>
        // fragment
    </>
    <#foo @detached>
        // named fragment with @detached decorator
    </>


    let bar = function () {

    }

    // inline template definition
    let foo = template (a:Z, b:string):x // foo
    {
        // a
        
    }

    <div att = template () {expr()} 
        bb=123 ></div>

    // inline XJS functions as content
    <b:list>
       <:item key=1 c = template{}> Item 1</>
       <:item key=2> Item 2</>
       <:separator/>
       <:item key=3> Item 3</>
       <:itemTemplate a=123 @content = template(a, b:string, d:number = 3) {
             if(key===2) {
               <div class="item special"> #Special item: {content}# </div>
             } else {
               <div class="item"> #{content}# </div>
             }
          } 
          another="attribute"
        />
    </>

    <div> # End # </div>

}`;

let x2 = function () {

}

let bar2 = `@template () => {
    <div></div>
}`

class Foo2 {
    x = "re";
    superNiceProp = 42;

    render = `@template (foo) => {
        <div @host a={this.x}> 
            # {this.superNiceProp} #
        </div>
    }`;
}



// xx could be a different template engine...
let baz2 = `@template (name:string) => {
    let foo=123;
    for (let i=0;10:i;i++) {
        <li #myList[i] @tooltip(title="abcd" position=1) a:blah={2+4}>
            <@tooltip />
            # bar {1+2} #
            let bar = 123;
        </li>
    }
    <div>
}`


