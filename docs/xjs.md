
# XJS syntax

<!-- Generated through https://ecotrust-canada.github.io/markdown-toc/ -->
  * [General philosophy](#general-philosophy)
  * [Template definition](#template-definition)
    + [$template vs. $content strings](#template-vs-content-strings)
    + [$template function arguments](#template-function-arguments)
    + [using $template strings](#using-template-strings)
    + [using $content strings](#using-content-strings)
  * [XML Element nodes](#xml-element-nodes)
    + [Component nodes](#component-nodes)
    + [Param nodes](#param-nodes)
    + [Decorator nodes](#decorator-nodes)
    + [Fragment nodes](#fragment-nodes)
    + [CDATA sections](#cdata-sections)
  * [Params, attributes and properties](#params--attributes-and-properties)
    + [Orphan params](#orphan-params)
    + [Literal values](#literal-values)
  * [Text nodes](#text-nodes)
    + [White spaces](#white-spaces)
    + [Encoding & special characters](#encoding---special-characters)
  * [Comments](#comments)
  * [Binding expressions](#binding-expressions)
    + [One-time evaluation (no-binding)](#one-time-evaluation--no-binding-)
    + [Bi-directional bindings](#bi-directional-bindings)
    + [Function expressions](#function-expressions)
    + [Shortcuts](#shortcuts)
  * [Decorators](#decorators)
    + [Built-in decorators vs. custom decorators](#built-in-decorators-vs-custom-decorators)
    + [Orphan decorators](#orphan-decorators)
    + [Decorators with a single value](#decorators-with-a-single-value)
    + [Decorators with multiple values](#decorators-with-multiple-values)
    + [Decorator nodes](#decorator-nodes-1)
  * [Labels](#labels)
    + [Simple labels](#simple-labels)
    + [Conditional labels](#conditional-labels)
    + [Forward labels](#forward-labels)
  * [JS statements](#js-statements)
    + [$if](#if)
    + [$for ($template only)](#for---template-only-)
    + [$each](#each)
    + [$let ($template only)](#let---template-only-)
    + [$exec ($template only)](#exec---template-only-)
    + [$log](#log)
    + [$template ($template only)](#template---template-only-)
  * [Content projection](#content-projection)
  * [Pre-processors](#pre-processors)

## General philosophy

As mentioned in the introduction, the general idea of XJS is to define new XML statements that can be used within specific *$template* or *$content* functions.

Like for [JSX][], these statements should be seen as shortcuts to a more complex code generation that would be painful to write by hand. For instance:

```typescript
const hello = $template`(name) => {
    <div class="hello" title={"hello "+name}>
        Hello {name}
    </div>
}`;
```

should be read as
```js
const hello = $tplFactory(({name}, $context) => {
    $context.startElement("div", {"class":"hello", "title":"hello "+name});
    $context.addText(" Hello ", name, " ");
    $context.endElement();
});
```

this is why some JS statements can be used in XJS templates. Indeed
```xml
$let xyz = expr2();
<div class="abc" title={xyz}>
    $if (xyz) {
        Hello {name}
    }
</div>
```
would translate as
```js
let xyz = expr2();
$context.startElement("div", {"class":"abc", "title":xyz});
if (xyz) {
    $context.addText(" Hello ", name, " ");
}
$context.endElement();
```

Notes: 
- to keep things simple, XJS only allows for a subset of the [JS statements](#js-statements).

- XJS doesn't provide any code generator by default in order to let template engine decide which optimization fits best their needs. However the general mental model - a sequential list of instructions - should be respected (cf. [ivy][] engine for a full XJS implementation)

- you will notice a '$context' variable in the previous generated code. The goal of this variable is to bind all instructions in a common context. This is why XJS instructions cannot be used anywhere in a typescript file and must be used in specific ***template functions*** that will provide this hidden context argument.


[JSX]: https://reactjs.org/docs/introducing-jsx.html
[ivy]: https://github.com/AmadeusITGroup/ivy

## Template definition

XJS templates are template strings (aka. backtick strings) tagged with a *$template* or *$content* function. 

**$template** strings are designed to define parametric templates and components. They have to be transformed into JavaScript at build time (like JSX), usually through a packager plugin (e.g. a webpack or rollup plugin). Note: this code generation has to be done by the template engine that uses XJS in order to let the engine tune the code according to its needs (cf. [ivy][] for a working example).

**$content** strings, on the other hand, are designed for content views that will be loaded (and potentially retrieved) dynamically. They will be parsed and interpreted dynamically at runtime. As a consequence, *$content* strings are meant to be **safe** and **sanitized** (so that they cannot be used to inject malicious code) and their syntax is more restrictive than for *$template* strings (cf. below).

As they are dynamic, *$template* strings start with an arrow function that corresponds to the template render function. The arguments of the arrow function correspond to the template arguments:

```typescript
// the template string is not highlighted here because markdown doesn't support the XJS grammar
const myTemplate = $template`(arg1, arg2:string) => {
    // template content
    arg1 and arg2 can be used in expressions: {arg1} and {doSomething(arg2)}
}`;
```

### $template vs. $content strings

Syntactically, *$template* and *$content* strings are almost identical, with theses only differences:
- *$template* strings must start with an arrow function definition (cf. next), whereas *$content* strings directly start with content (i.e. HTML/XML text or elements)
- *$template* strings are **static** and will be transformed into JS statements at build time, whereas *$content* strings are **dynamic** and will be kept as JS strings after the build completion. They will be parsed and interpreted dynamically at runtime (as such they can also be dynamically created). Because of their dynamic nature, *$content* strings must produce **sanitized** XML/HTML, and as such:
    - *$template* strings can use any JS expressions, whereas *$content* strings can only use *reference paths* (i.e. in the for of *object.prop.subProperty*)
    - *$template* strings can use any of the XJS JS statements, whereas *$content* strings can only use *$if*, *$each* and *$log* (with *reference paths* expressions)
    - *$content* strings can contain JS expression placeholders (i.e. *${someExpr()*} -> with the $ sign) whereas there are not supported in *$template* strings.


### $template function arguments

The main arrow function used in the *$template* string uses the standard TypeScript arrow function grammar, but with a few limitations to keep the parser simple (for instance argument destructuring is not supported, and arguments must always be defined within round brackets).

```typescript
const hello = $template`(firstName:string, lastName="", tooltip?:string) => {
    <div class="hello" title={tooltip}>
        Hello {firstName} {lastName}!
    </div>
}`;
```

### using $template strings

In XJS mental model, the *$template* function should return a template factory as a given template can be instantiated multiple times.

When this factory is called, it should return a *template instance* (or component). This instance could have several methods, such as
- *attach(domElement)* to attach the instance to a given DOM element. This means that HTML content managed by the template instance will be appended to that DOM element. *attach()* should return the template instance to support [method chaining][]
- *render(json)* to render the template instance. The JSON object passed as argument should contain the template arguments. It should be possible to call the *render()* method multiple times for subsequent updates - and like for *attach()* it should also return the template instance.

```typescript
const hello = $template`(name:string) => {
    <div class="hello">
        Hello {name}!
    </div>
}`;

const t1 = hello().attach(document.body).render({name:"World"});
const t2 = hello().attach(document.body).render({name:"Sunshine"});
```

[method chaining]: https://en.wikipedia.org/wiki/Method_chaining

### using $content strings

As previously explained, *$content* strings should be dynamically parsed and interpreted. As such, the *$content* function will do nothing but return the actual string. In fact the only purpose of the *$content* keyword is to clearly identify *$content* templates and trigger the proper syntax highlighting.

So how should they be used? XJS recommendation is that template engines should expose an *@content* built-in decorator to inject the HTML generated by the *$content* template into a fragment or an element:

```typescript
import {cpt} from 'mylib';

const desc = $content`
    Some HTML <b> description </b>...
    <*someSpecialCpt value="abc"/>
`;

const main = $template`(mainParagraph:string) => {
    <div class="main" @content(value={mainParagraph} resolver={mainResolver}) />
}`;

async function mainResolver(ref: string): Promise<any> {
    if (ref === "someSpecialCpt") return cpt;
    return null;
}

// instantiation
main().attach(document.body).render({mainParagraph: desc});
```

As you can see, the *@content* decorator will take 2 arguments:
- **value** to pass the *$content* string
- **resolver** to pass a function that will be called anytime an external reference is encountered (this is to make sure only authorized references are used). Of course, the resolver argument can be omitted if not external references are used

Note: the *@content* decorator should also be used for content projection. Please check the [decorator](#decorators) or [content projection](#content-projection) sections below to get more information.

## XML Element nodes

XJS supports multiple kind of element nodes that follow the same pattern:
```
<[prefix?]nameOrRef [params?]/>
// or
<[prefix?]nameOrRef [params?]> [content] </[prefix?]nameOrRef>
// or
<[prefix?]nameOrRef [params?]> [content] </>
```
When no prefix is used, the name simply corresponds to the XML target element - e.g. `<div class="abc"/>`

Otherwise the prefix can have the following values (more details below):
- \* : for component elements (aka. sub-templates) - e.g. `<*cpt value="abc"/>`
- \. : for param nodes - e.g. `<.header mode="dark"> ... </!>`
- \@ : for decorator nodes - e.g. `<@tooltip position="top"> ... </!>`
- \! : for fragment elements - e.g. `<!> ... </!>` - note: in this case nameOrRef must be empty

As the name implies, *nameOrRef* can either be a name or a local reference:
- for component and decorators, *nameOrRef* is a reference: it means that XJS expects to evaluate this reference in the local JavaScript scope. It also means that *nameOrRef* must be either a valid JS identifier or a path of identifiers separated by dots - e.g. `<*mylib.tooltip .../>`
- for normal XML elements (no prefix) or param nodes, *nameOrRef* must simply be a valid XML name (but cannot be a dotted path).

### Component nodes

The purpose of component nodes is to denote the call to another template. This other template can be either in the same file or imported from another file (statically or dynamically: the reference should be interpreted at runtime).

Component nodes can accept parameters that correspond to the associated template arguments e.g.

```typescript
const foo = $template`(value) => {
    <span class="foo"> Hello </span> {value}
}`;

const bar = $template`(value) => {
    <*foo value="World"/>
}`;
```

### Param nodes

The purpose of param nodes is to act as named parameters for their containing element that should be either a component or another param node:

```html
<*list>
    <.option id="a"> first </>
    <.option id="b"> second </>
    <.separator/>
    <.option id="c"> third </>
</>
```

Param nodes could accept a combination of
- param attributes - e.g. `<.header title="abc"/>`
- content - e.g. `<.header> Hello </>`
- sub- param nodes - e.g. `<*table><.tr><.td> Cell A </><.td> Cell B </></></>`

However param nodes should not accept [decorators](#decorators). For more information about param nodes usage, please check the [Content Projection](#content-projection) section.

### Decorator nodes

The purpose of decorator nodes is to define entities that are attached to other elements, without being part of the element's content.
```html
<div>
    <@tooltip position="top">
        <div> 
            tooltip content 
        </>
        <.footer> tooltip footer </>
    </>
</>
```
When no XML content is required, the decorator node can also be defined as [attribute decorator](#decorators):

```html
<div @tooltip(position="top" text="Some tooltip")>
    ...
</>
```

### Fragment nodes

The purpose of fragment nodes is to virtually group multiple elements together, without creating an explicit XML element container (like a `<div/>` for instance).
Fragments are mainly used in combination with [decorators](#decorators).

```html
<!>
    <div> Hello </div>
    World 
</>
// or
<! @content={data.$content}/>
```

Note: fragments use the '!' prefix to avoid collision with decorator nodes when attribute decorators are used.

### CDATA sections

Sometimes it comes in handy to be able to provide complex content without having to escape every single characters when they should not be interpreted as XML/HTML element (or components/fragments). This is where ```<!cdata>...</!cdata>``` sections come into play: they allow to group any XML content into a single text node.

```typescript
const content = $content`
    <div>
        <span> AAA </span>
        <!cdata>cdata #1</!cdata>
    </>
    <!cdata>
        cdata #2: <section> Hello M </section>
    </!cdata>
`;
```
On the contrary to normal text nodes, all white spaces are preserved in a CDATA section - and no character needs special escaping, except the *end of cdata* symbol that can be escaped through ```!</!cdata>```.

## Params, attributes and properties

All XML elements accepts attributes - which are called *params* in the XJS terminology.

For HTML elements, the mental model is that params correspond to HTML attributes that will be set through the DOM [setAttribute()][] method:

```html
<div class="abc" />
// equivalent to currentElement.setAttribute("class", "abc");
```

When attributes are bound to expressions, then the DOM [removeAttribute()][] should be called if the expression returns undefined:

```html
<div class={expr()} />
// if expr()!== undefined: equivalent to currentElement.setAttribute("class", expr());
// if expr()=== undefined: equivalent to currentElement.removeAttribute("class");
```

However the HTML DOM also exposes properties that are not accessible as HTML attributes (e.g. *className*) or that may have a more convenient interface when accessed as properties (e.g. *disabled*): this is why XJS supports a specific *property* syntax:

```html
<input type="text" [className]="abc" [disabled]={expr} />
// equivalent to:
// currentElement["className"]="abc";
// currentElement["disabled"]=expr;
```

Note: the property syntax can only be used on normal XML elements and doesn't apply to components, fragments, decorator or param nodes

[setAttribute()]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[removeAttribute()]: https://developer.mozilla.org/en-US/docs/Web/API/Element/removeAttribute


### Orphan params

When params are used without any value, the template engine should consider it equivalent to passing *true* as default value - e.g.

```html
<input type="text" [disabled]/>
// equivalent to currentElement["disabled"]=true;
<*alert important text="abc"/>
// equivalent to currentComponent.params["important"]=true;
```

### Literal values

Params, attributes and properties can be associated to [binding expressions](#binding-expressions) or literal values. XJS only support 3 kinds of literal values: 
- strings (with single or double quotes)
- boolean (true or false)
- simple numbers (i.e. 123 or 12.3)

```html
<*cpt size=200 fullDisplay=false title='Important' msg="abcd"/>
```

of course, params can also be passed [JS expressions](#binding-expressions):

```html
<*cpt size={getSize(someContextualValue)}/>
```

## Text nodes

Like in XML, HTML or JSX, XJS will automatically detect text nodes between tag elements (or at $content template root):

```typescript
const c1 = $content`
    Hello world
`;
```

Of course, text nodes also support incorporating dynamic parts through JS expressions:

```typescript
const c1 = $content`
    Hello {name}
`;
```

### White spaces

By default, XJS automatically shrinks multiple white spaces (and carriage returns) into one single space (like HTML):

```html
<div> 
    Hello
    World
</div>
is equivalent to:
<div> Hello World </div>
```

White spaces between to elements are also ignored:

```html
<span> Hello
</span>
<span> World
</span>
is equivalent to:
<span> Hello </span><span> World </span>
```

This behavior proves best in most cases, but they are special cases where white spaces should be explicitly rendered. This is where special characters come into play.

### Encoding & special characters

Text nodes are UTF8 encoded, this is why XJS doesn't need to support HTML entities (which are also difficult to support in dynamic cases).

Besides UTF8, there are 2 categories of special characters that are supported by XJS. Those special characters are composed of the '!' character (used as escape operator) followed by a 2nd character:
- escaped keywords: to use the language keywords in text nodes:
    - **!<** and **!>** for the < and > characters (used by XML elements)
    - **!{** and **!}** for the { and } characters (used by the js statement blocks)
    - **!$** for the $ character (used to prefix the js statements)
    - **!/** for the / character (used by comments)
    - **!!** for the ! character itself (only needed if ! is followed by one of the special char identifier - e.g. to write *!n*)

- space management: to manage the spaces generated in text nodes
    - **!n** to generate a new line character
    - **!_** to generate a space character
    - **!s** to generate a non-breaking space character (aka. *nbsp;*)
    - **!z** to eat all spaces before and after (z for *zero*) as by default XJS collapses multiple spaces in one single space.


## Comments

XJS being typescript-based, comments are naturally done through JS comments:
```js
<div // comment 1
    title="abc" 
    /* comment 2 */
>
    // another comment...
</>
```

Note: comments will be ignored by the parser and won't generate HTML comments.

## Binding expressions

In **$template strings**, all element attributes, params, properties and text node values can be bound to dynamic expressions through the *{[prefix?]expr}* syntax. When no prefix is used, the expression denotes a standard binding expression:

```typescript
const tpl = $template`() => {
    <div title={getTitle(arg1)} />
    {getFirstName()} / {getLastName()}
    Sum: {1+2+3}
}`;
```

In **$content strings** however, expressions must be limited to simple references (i.e. 'dotted path' such as 'a.b.c') to keep $content template safe and avoid malicious code invocation:

```typescript
const c3 = $content`
    <div title={ctxt.mainTitle} />
    {firstName} / {lastName}
    Sum: {ctxt.theSum}
`;
```

Note: as these are binding expressions, the template engine should ensure that anytime an expression value changes the associated attribute/property/param/text is updated.

### One-time evaluation (no-binding)

In some cases (e.g. for values that should be translated), we may not want the template engine to recalculate the expression to check if it changed - this where the 'no-binding' syntax should be used with the '::' prefix:

```html
// in $template strings:
<div title={::calculateExpensiveTitle(arg1)}> {::l10n.welcomeMessage} </div>

// in $content strings:
<div title={::theTitle}> {::l10n.welcomeMessage} </div>
```

### Bi-directional bindings

When using widgets that expose input / output properties (like the value of a text field), it comes quickly handy to be able to use 2-way binding expressions. In XJS this is done through the *{=assignableExpr}* syntax:
```html
<input type="text" @value={=data.firstName}/>
```
Note: this example uses the *@value* decorator - please check the [decorator](#decorators) section below for more information about decorators

The 2-way binding expression should be read like this:
- at first render, the @value will be passed the *data.firstName* value, and @value will update its host's value (the input element in this examples).
- then if the input value changes, @value will be notified and will push the value into *data.firstName*
- conversely, if *data.firstName* changes, @value will be notified and will push the value into the text field.

Note: as 2-way binding expressions require some adaptation code behind the scene, they will usually be only accessible on components or decorators (implementation will depend on the template engine used with XJS).


### Function expressions

As functions are valid JS expressions, they can be naturally passed as expression values:
```html
<div @onclick={e=>handleClick(e)}/> // cf. decorators for @onclick
<*datePicker dateCalculator={calculator} logger={text=>console.log(text)}/>
```

In some cases however, we may not need to specify any argument to the inline function. In this case, XJS allows to use the *{=>functionBody}* shortcut (in pure JS we would have to use *{()=>functionBody}*)

```html
<div @onclick={=>handleClick(idx)}/> // cf. decorators for @onclick
```

### Shortcuts

When the expression and the param names are the same, XJS allows to use the following shortcuts:

```html
<div {title}/>          // equivalent to <div title={title}/>
<div {[className]}/>    // equivalent to <div [className]={className}/>
<div {::title}/>        // equivalent to <div title={::title}/>
<div {::[className]}/>  // equivalent to <div [className]={::className}/>
```

## Decorators

Decorators are the second main difference between XJS and [JSX][]. Their purpose is to be able to associate special meaning or special behaviors to XJS elements (e.g. HTML elements or components).

### Built-in decorators vs. custom decorators

In XJS, decorators can be used in two different manners
- either as *built-in decorators* that will be interpreted at code generation time. Built-in decorators are reserved keywords that are specified by the template engine behind XJS
- or as *custom decorators* that can be considered as custom directives that will interact with the element hosting the decorator. In this case the decorator name will be interpreted as a local JS reference, that will often correspond to a reference imported at module level (e.g. `import {tooltip} from 'mylib'`). Custom decorator implementation will depend on the template engine used with XJS.

Note: built-in and custom decorators both share the same syntax, and there are no syntactical differences from the XJS point of view (in other words built-in decorators are simply reserved names for the template engine).

### Orphan decorators

The first possible usage of decorators is to use them as orphan attributes - e.g.

```html
<div class="body" @content />    // to indicate that the default content should go in this div
<input type="text" @mandatory /> // to indicate that this field should not be empty when the parent form is submitted
```

### Decorators with a single value

The second possible usage of decorators is to use them with a value or a binding expression:

```html
<div class="body" @content={data.mainContent} />
<input type="text" @value={=data.firstName} />
<button @onclick={=>processAction()} />
```

### Decorators with multiple values

Sometimes decorators require multiple parameters. In this case XJS gathers them gathered into brackets after the decorator name:

```html
<div class="body" @tooltip(class="important" position="top" text={getText()})> ... </>
// in this case the 'class' param of the tooltip cannot collide with the 'class' attribute of the div
<button @onclick(listener={=>processAction()} options={{capture:true}})/>
```

Note: the same decorator can be called through these different syntaxes provided that it provides default values for its params. 
When the 'single value' form is used, the parameter that should be picked is the one flagged as 'default parameter' (implementation will depend on the template engine) - cf. *onclick* sample in the previous examples (*listener* is the default param in this case).

### Decorator nodes

Sometimes decorators require to support rich content (ie. element nodes) as params. In this case the attribute form cannot be used to call the decorator and we have to use the decorator node form instead:

```html
<div class="body" @tooltip(class="important" position="top" text={getText()})> 
    <@tooltip position="top">
        // this tooltip will apply to its parent element (i.e. div.body)
        <b> main tooltip content </b>
        <.footer type="soft"> footer content </>
    </>
    ...
</div>

```

Note: the implementation of the decorator node should be exactly the same, whatever form is used to call it. The developer should be able to use the simplest form that fulfills the application needs.

## Labels

Applications often require to retrieve elements (or components) once they have been generated - for instance to set the focus on an element or to call a specific method when an event occurs.

For this use case XJS supports a dedicated syntax to label elements or components in order to be able to query them at a later stage (the query mechanism will depend on the template engine implementation)

### Simple labels

In their simplest form, labels correspond to #tags set on elements:
```html
<input type="text" #firstName/>
```

Multiple labels can of course be set on the same element:
```html
<input type="text" #firstName #field/>
```

### Conditional labels

Sometimes, labels should only be set when a specific condition is met: this is where conditional labels should be used. Conditional labels are actually standard labels bound to an expression that should be interpreted as true - e.g.

```html
<ul>
    $for (let i=0; myArray.length>i; i++) {
        <li #first={i===0} #last={i===myArray.length-1}> 
            {myArray[i]} 
        </li>
    }
</ul>
```

### Forward labels

One of the general principle of labels is to be scoped to the template they are defined into - the goal being to avoid collision with other labels defined in other parts of an application (which is also a frequent problem with CSS selectors).

However a parent template would sometimes need to query elements that are defined in a sub-template / sub-component. This is where forward labels come into play - provided that the sub-component has declared some public labels (implementation will depend on the template engine). 

Syntactically, forward labels are special labels marked with a '##' prefix to tell the query system to look inside a given sub-component. 

```html
<div #item/>
<*cpt ##item arg="foo"/>
// the query on '#item' will return the first div and the elements labelled as #item in the cpt generated children (aka. shadow DOM)
// note: the cpt itself will not be returned as it doesn't have the #item label
```

By default the query will be forwarded with the same query argument (e.g. a query on '#foo' will be forwarded as sub-query on '#foo' in the child component) - however sometimes we may want the sub-query to be done with different query arguments. This can be done by passing a value to the forward label:

```html
<div #item/>
<*cpt ##item="#elt" #item arg="foo"/>
// the query on '#item' will return the first div, the cpt instance 
// and the elements labelled as #elt in the cpt generated children (aka. shadow DOM)
```

Of course the forward label argument can be bound to a dynamic expression:
```html
<*cpt ##item={expr()}/>
```

## JS statements

As explained in the introduction, XJS philosophy is to consider the $template and $content strings as a series of JS statements - for instance:
- ```<div class="hello">``` is equivalent to $context.startElement("div", {class:"hello"});
- ``` Hello {name}! ``` is equivalent to $context.addText(" Hello ", name, "! ");
- ```</div>``` or ```</>``` are equivalent to $context.endElement();

As such, supporting JS statements is a very natural thing. Indeed:
```html
<div class="hello">
    $if (condition) {
        Hello {name}
    }
</>
```
simply translates as:
```js
$ctxt.createElt("div", 1, {class:"hello"});
    if (condition) {
        $ctxt.addText(1, [" Hello ", name, "! "]);
    }
$ctxt.closeElt(1);
```
Note: actual code generation might differ depending on the template engine, but the general philosophy should remain.

As there is no special delimiter to identify text nodes, XJS uses the $ sign to identify JS statements. In practice, only a small subset of statements are supported for the time being as the XJS parser needs to parse them accurately without integrating the whole JS/TS grammar. Last but not least, some statements are only supported in $template strings as $content is meant to produce sanitized output, which is not compatible with complete JS evaluation capabilities.

### $if

**$if / else if / else** allows to express standard conditional rendering. It follows the same syntax as JS *if statement*. In *$template* strings, the *if* condition can be any JS expression, but in *$content* strings the condition can only be a reference path (i.e. something like a.b.c).

```html
$if (a) {
    <div> A condition </>
} else if (b) {
    <span> B condition </>
} else {
    Else condition!
}
```

### $for - $template only

**$for** allows to express loops in a standard JS fashion. [for...in][] and [for...of][] forms are also supported.

[for...in]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in
[for...of]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of

```html
$for (let i=0; 10>i; i++) {
    <div class={"x"+i}>
        Item #{i}
    </div>
}
```

### $each

**$each** allows to express loops with the possibility to have directly access to the item, the item index, and a indicator telling if the item is last in the list. 
*$each* can be seen as a variant of [Array.prototype.forEach()][ArrayForEach]

```html
$each (names, (name, index, isLast) => {
    $if (index === 0) {
        <hr/> // first hr
    }
    <div class={"name"}>
        #{index+1}. Hello {name}
    </div>
    $if (isLast) {
        <hr/> // last hr
    }
}
```

Note: in *$content* strings, the *collection* argument (i.e. *names* in the previous example) can only be a reference path (i.e. something like a.b.c).

Warning: *$let* must end with a semi-colon (*;*)

[ArrayForEach]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach

### $let - $template only

**$let** allows to declare and initialize one or multiple local variables, like in JavaScript. The scope of the variables will be the current JS block.

```html
$let x='foo', y={a:"AA", b:42}, z: getSomeExpensiveValue();
<div>
    Some value: {y.a}
</>
```

Warning: *$let* must end with a semi-colon (*;*)

### $exec - $template only

**$exec** allows to execute any JS expression without emitting its result in the XML output (on the contrary to text expressions for instance):

```html
$let x=123;
$exec x++;
$exec debugger;
$exec console.log(x)
```

Note: *$exec* must end with a semi-colon (*;*)

### $log

**$log** is simply a shortcut to ```$exec console.log(...)```. However, on the contrary to *$exec*, *$log* can be used in *$content* strings.

```html
$log("something", value1, value2, obj.prop.subProp);
```

Note: like *$let*, *$each* and *$exec*, *$log* must end with a semi-colon (*;*)

### $template - $template only

**$template** allows to define a *$template* in another *$template* (similarly to JS functions that can be created in another JS function).

```typescript
const main = $template `(itemList: string[], itemClass: string) => {
    <ul>
        $each(itemList, (item) => {
            <*listItem text={item}/>
        });
    </>
    $template listItem (text:string) {
        <li class={itemClass}> {text} </>
    }
}`;
```

## Content projection

A very common pattern in UI development is to pass some *content nodes* as parameters to a component. For example, in the code below
- title is passed as as standard param
- and somehow 'Some <b> text </b>' is passed as content param

```html
<*cpt title="abc">
    Some <b> text </b>
</>
```

XJS recommendation is to consider content as a true parameter that should be explicitly mentioned in the template signature with a *$content* argument name:

```typescript
const tpl = $template`(title, $content) => {
    ...
}`;
```

Of course, the template will need to re-inject (or re-project) the $content nodes into an element or a fragment. XJS recommendation in this case is to use an *@content* built-in decorator (the same as for [*$content* strings injection](#using--content-strings)):

```typescript
const tpl = $template`(title, $content) => {
    <div title={title} @content/> // equivalent to @content={$content}
}`;
```

Having said that, it is also sometimes interesting to support multiple content nodes: this is where data nodes come into play:

```typescript
// section usage
const tpl = $template`() => {
    <*section>
        <.header> Header content </>
        Main content
    </>
}`;

// section definition
const section = $template`(header, $content) => {
    $if (header) {
        <div class="header" @content={header}>
    }
    <div title={title} @content/> // equivalent to @content={$content}
}`;
```

Some more advanced cases can also be supported by considering param nodes as JS objects passed as argument. For instance, HTML table semantics can be easily supported like this:

```typescript

// table usage
const tpl = $template`() => {
    <*table>
        <.tr className="row1">
            <.td> Cell 1.1 </>
            <.td> Cell 1.2 </>
        </>
        <.tr className="row2">
            <.td> Cell 2.1 </>
            <.td> Cell 2.2 </>
        </>
    </>
}`;

// table definition
const table = $template`(trList: Row[]) => {
    <div class="table">
        $for (let row of trList) {
            <div class={"row "+row.className}>
                $for (let cell of row.tdList) {
                    <div class="cell" @content={cell.content}/>
                }
            </>
        }
    </>
}`;
```

## Pre-processors

Last but not least, as *$template* and static *$content* strings are parsed at compilation time, the XJS parser offers the possibility to use pre-processors.

Pre-processors are asynchronous transformation functions that are called by the XJS parser and that can modify the generated AST (cf. [XJS pre-processors][])

Syntactically pre-processors use the same syntax as decorators, but with the *@@* prefix:

```js
const content = xtr`
    <*cpt @@extract="./resources/sample1.ts#sectionC" />
`;
```
Note: $content strings that use dynamic placeholders (i.e. ${xxx} expressions ) cannot be parsed at build time, and as such cannot use build-time pre-processors. However those $content strings can still use run-time pre-processors.


[XJS pre-processors]: ./pre-processors.md
