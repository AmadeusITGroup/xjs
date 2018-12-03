
function template(strings) {

}

let normalTemplateString2 = template` (param1:string, param2:number) => {
    // element with static attribute (title) and property (className)
    <div title="some div" [className]="important"/>
    <div/>
    <div [someProp]=123.45 [anotherProp]=false /* inner comment */ disabled/>

    // element with dynamic attribute and property
    <div title={someStrExpr()+" "} [className]={someStrExpr()}/>

    // sample function properties
    <div click(e:Event)={doSomething(e);return expr(x);}/>

    // text node
    * some text node 
      on 2 lines *
    * some text node with a \*! *

    // localized text nodes and strings
    * !msg some text node *
    * #ref !msg some text node {param1} {param2} * // order may vary according to localization
    <div title="!theDivTitle some div" />

    // attribute decorators with multiple arguments
    <div @b.tooltip(
        title={getTooltipTitle()} 
        position="top" 
        important
    ) [className]={e()}/> // className is a property (default = attribute)

    // node decorators
    if (someExpr()) {
        <div>
            <@b.tooltip important position="top">
                <.title> * Some title content here * </.title>
                if (param1 = "a") {
                    * Some content *
                }
            </@b.tooltip>
        </div>
    }

    // sub component with content
    <$alert type="warning">
        * !alertMsg Some important message <div/> *
    </>

    // sub-component with data nodes
    <$tabBar>
       <.tab id="a"> // $tab is a value node
           <.title> <b> * Some fancy title * </b> </.title>
           * Tab A content here *
           <.footer> * footer text * </> 
       </.tab>
       if (someCondition) {
           <.tab id="b" title={getTitle()} >
               * Tab B content here *
           </>
       }
    </$tabBar>

    // inline XJS functions as content
    <$list>
        <.item key=1> *Item 1*</>
        <.item key=2> *Item 2* </>
        <.separator/>
        <.item key=3> *Item 3* </>
        <.itemTemplate a=123 another="attribute" @template(a, b:string, d:number = 3)={
            if (key===2) {
                <div class="item special"> *Special item: {content}* </div>
            } else {
                <div class="item"> *{content}* </div>
            }
        }/>
    </$list>

    // local refs #foo #foo[] #foo[{expr()}]
    <div #foo title="123"/>
    <div #foo[] @host/>
    <div #foo[{expr(123)}] important bar=234/>
    * #bar some text *

    // fragment
    <! @someAnnotation> * this text node is in a fragment *  </>
    <! @detached #foo> /* This is a detached fragment: it is not directly inserted in the DOM */ </>

    // detached fragment insertion
    <! @innerHTML={foo}/>
}`;

let expressions = template`() => {
    // 2-way binding
    <input type="text" @model={=this.someProp}/>

    // one-time binding expression
    <div title={::expr()}/>

    // spread operator
    <div {...{att1: a, att2:b}} {...expr(123)} {...myVar}/>
    <div {::...expr()} /> // one-time spread on attributes
    * Hello {...expr()} {...expr()} * // note: this should be rejected by the compiler but is valid for TM
    {{someExpr()}} // fully dynamic text node with only one expression

    // spread operator on properties
    <span [{...expr()}]/>
    <div [{::...expr()}] /> // one-time spread on properties
}`;

let sectionSample = template`() => {
    * Here is a section sample *
    <$section open=true>
        <.title> <b> * The great section * </b> </.title>
        * Some content here *
    </>
}`

export let section = template`(open:boolean, $content, $) => {
    let title = dataNode($, ".title");
    <div @host class="section">
        if (title) {
            <h1 class="title"> <! @innerHTML={title} /> </h1> // fragment with dynamic content
        }
        if (open) {
            <div class="content" @innerHTML={$content}/>
        }
    </div>
}`;

class Foo2 {
    x = "re";
    superNiceProp = 42;

    render = template` (foo) => {
        <div @host a={this.x}> 
            * {this.superNiceProp} *
        </div>
    }`;
}
