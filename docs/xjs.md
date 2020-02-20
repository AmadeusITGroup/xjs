
# XJS syntax

<!-- Table of content -->
<!-- Generated through https://ecotrust-canada.github.io/markdown-toc/ -->

  * [General philosophy](#general-philosophy)
  * [Template definition](#template-definition)
    + [Why defining templates in a template string?](#why-defining-templates-in-a-template-string-)
    + [Template function arguments](#template-function-arguments)
  * [XML Element nodes](#xml-element-nodes)
    + [Component nodes](#component-nodes)
    + [Param nodes](#param-nodes)
    + [Decorator nodes](#decorator-nodes)
    + [Fragment nodes](#fragment-nodes)
  * [Params, attributes and properties](#params--attributes-and-properties)
    + [Orphan params](#orphan-params)
    + [Literal values](#literal-values)
  * [Text nodes](#text-nodes)
  * [Comments](#comments)
  * [Binding expressions](#binding-expressions)
    + [One-time evaluation (no-binding)](#one-time-evaluation--no-binding-)
    + [Bi-directional bindings](#bi-directional-bindings)
    + [Function expressions](#function-expressions)
    + [Shortcuts](#shortcuts)
  * [Decorators](#decorators)
    + [Built-in decorators vs. custom decorators](#built-in-decorators-vs-custom-decorators)
    + [Orphan decorators](#orphan-decorators)
    + [Decorators with one single value](#decorators-with-one-single-value)
    + [Decorators with multiple values](#decorators-with-multiple-values)
    + [Decorator nodes](#decorator-nodes-1)
  * [Labels](#labels)
    + [Simple labels](#simple-labels)
    + [Conditional labels](#conditional-labels)
    + [Forward labels](#forward-labels)

## General philosophy

As mentioned in the introduction, the general idea of XJS is to define new XML statements that can be used within specific *template* functions.

Like for [JSX][], these statements should be seen as shortcuts to a more complex code generation that shouldn't be written by hand. For instance:

```xml
<div class="abc" title={expr()}>
    # Hello {name} #
</div>
```

should be read as
```js
context.startElement("div", {"class":"abc", "title":expr()});
context.addText(" Hello ", name, " ");
context.endElement();
```

this is why any normal JS statement can be used in XJS template. Indeed
```xml
const xyz=expr2();
<div class="abc" title={xyz}>
    if (xyz) {
        # Hello {name} #
    }
</div>
```
would translate as
```js
const xyz=expr2();
context.startElement("div", {"class":"abc", "title":xyz});
if (xyz) {
    context.addText(" Hello ", name, " ");
}
context.endElement();
```

XJS doesn't provide any code generator by default in order to let template engine decide which optimization fits best to their needs. However the general mental model - a sequential list of instructions - should be respected.

Note: you will notice a 'context' variable in the previous generated code. The goal of this variable is to bind all instructions in a common context. This is why XJS instructions cannot be used anywhere in a typescript file and must be used in specific ***template functions*** that will provide this hidden context argument.


[JSX]: https://reactjs.org/docs/introducing-jsx.html


## Template definition

XJS templates are template strings (aka. backtick strings) passed as first argument of a *template()* function. The template string must contain an arrow function that corresponds to the template render function. The arguments of the arrow function correspond to the template arguments:

```typescript
// the template string is not highlighted here because github doesn't support the XJS grammar
const myTemplate = template(`(arg1, arg2:string) => {
    // template content
}`);
```

### Why defining templates in a template string?

The ideal template syntax that matches XJS mental model would be to introduce a 'template' keyword, similar to the 'async' specifier for asynchronous functions. The goal of this 'template' flag would be to define a new category of functions that would correspond to template factories (i.e. functions that would return a template instance - as templates can get instantiated multiple times).

```typescript

template function myTemplate({arg1, arg2:string}) {
    // template content
}

const instance1 = myTemplate({arg1:"hello", arg2:"world"}).attach(document.body);
```

Unfortunately this requires creating a new file extension (e.g. *xts* ) and rewiring all current typescript utilities (language service, etc.), which was beyond the scope of this first version - but this is definitely something to keep in mind for future evolutions.

### Template function arguments

The main arrow function used in the template string is a normal arrow function, so any valid typescript argument can be used here - at least as XJS in concerned. Indeed template engine implementations may not support some features, like argument destructuring.

## XML Element nodes

XJS supports multiple kind of element nodes that follow the same pattern:
```
<[prefix?]nameOrRef [params?]/>
// or
<[prefix?]nameOrRef [params?]> [content] </[prefix?]nameOrRef>
// or
<[prefix?]nameOrRef [params?]> [content] </!-->
```
When no prefix is used, the name simply corresponds to the XML target element - e.g. `<div class="abc"/>`

Otherwise the prefix can have the following values (more details below):
- \* : for component elements (aka. sub-templates) - e.g. `<*cpt value="abc"/>`
- \. : for param nodes - e.g. `<.header mode="dark"> ... </!-->`
- \@ : for decorator nodes - e.g. `<@tooltip position="top"> ... </!>`
- \! : for fragment elements - e.g. `<!> ... </!>` - note: in this case nameOrRef must be empty

As the name implies, *nameOrRef* can either be a name or a local reference:
- for component and decorators, *nameOrRef* is a reference: it means that XJS expects to evaluate this reference in the local JavaScript scope. It also means that *nameOrRef* must be either a valid JS identifier or a path of identifiers separated by dots - e.g. `<*mylib.tooltip .../>`
- for normal XML elements (no prefix) or param nodes, *nameOrRef* must simply be a valid XML name (but cannot be a dotted path).

### Component nodes

The purpose of component nodes is to denote the call to another template. This other template can be either in the same file or imported from another file (statically or dynamically: the reference should be interpreted at runtime).

Component nodes can accept parameters that correspond to the associated template arguments e.g.

```typescript
const foo = template(`(value) => {
    <span class="foo"> # Hello # </span>
    # {value} #
}`);

const bar = template(`(value) => {
    <*foo value="World"/>
}`);
```

### Param nodes

The purpose of param nodes is to act as named parameters for their containing element that should be either a component or another param node:

```html
<*list>
    <.option id="a"> # first # </>
    <.option id="b"> # second # </>
    <.separator/>
    <.option id="c"> # third # </>
</>
```

Param nodes could accept a combination of
- param attributes - e.g. `<.header title="abc"/>`
- content - e.g. `<.header> # Hello # </>`
- sub- param nodes - e.g. `<*table><.tr><.td> # Cell A # </><.td> # Cell B # </></></>`

However param nodes should not accept decorators (cf. below).

### Decorator nodes

The purpose of decorator nodes is to define entities that are attached to other elements, without being part of the element's content.
```html
<div>
    <@tooltip position="top">
        <div> 
            # tooltip content # 
        </>
        <.footer> # tooltip footer # </>
    </>
</>
```

### Fragment nodes

The purpose of fragment nodes is to virtually group multiple elements together, without creating an explicit XML element container (like a `<div/>` for instance).
Fragments are mainly used in combination with decorators (cf. below).

```html
<!>
    <div> # Hello # </div>
    # World #
</>
// or
<! @content={data.$content}/>
```

Note: fragments use the '!' prefix to avoid collision with attribute nodes when decorator params are used.

## Params, attributes and properties

All XML elements accepts attributes - which are called *params* in the XJS terminology.

For HTML elements, the mental model is that params correspond to HTML attributes that will be set through the DOM [setAttribute][] method:

```html
<div class="abc" />
// equivalent to currentElement.setAttribute("class", "abc");
```

When attributes are bound to expressions, then the DOM [removeAttribute][] may be called if the expression returns undefined:

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

[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[removeAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/removeAttribute


### Orphan params

When params are used without any value, the developer should consider it equivalent to passing *true* as default value - e.g.

```html
<input type="text" [disabled]/>
// equivalent to currentElement["disabled"]=true;
<*alert important text="abc"/>
// equivalent to currentComponent.params["important"]=true;
```

### Literal values

Params, attributes and properties can be associated to binding expressions (cf. below) or literal values. XJS only support 3 kinds of literal values: 
- strings (with single or double quotes)
- boolean (true or false)
- simple numbers (i.e. 123 or 12.3)

```html
<*cpt size=200 fullDisplay=false title='Important' msg="abcd"/>
```

## Text nodes

As XJS allows to use JavaScript inside XML element content, text nodes must be explicitly marked to be differentiated from normal JavaScript statements. This is why XJS introduces a new type of multi-line strings delimited by *\#* signs.

This may appear slightly painful compared to other templating languages - but the corollary is that developers get full control over white spaces.

```html
# this is a 
  text node #
<div> # another one # </div>
```

Of course, text nodes also support incorporating dynamic parts through JS expressions:
```html
# Hello {getName()} # // getName must be accessible in the current JS scope 
```

Note: text nodes are UFT8 encoded, this is why XJS shouldn't support HTML entities

In future evolutions, XJS could also support associating params or decorators to text nodes. In this case the current proposal would be to put them into brackets at the beginning of the text node:
```
# (@i18n="hello" @markdown) Hello *{name}* # 
```

<!-- todo: describe specific escape characters -->

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

## Binding expressions

All element attributes, params, properties and text node values can be bound to dynamic expressions through the *{[prefix?]expr}* syntax. When no prefix is used, the expression denotes a standard binding expression:

```js
<div title={getTitle(arg1)} />
# {getFirstName()} / {getLastName()} #
# Sum: {1+2+3} #
```

As these are binding expressions, the template engine should ensure that anytime an expression value changes the associated attribute/property/param/text is updated.

### One-time evaluation (no-binding)

In some cases (e.g. for values that should be translated), we may not want the template engine to recalculate the expression to check if it changed - this where the 'no-binding' syntax should be used with the '::' prefix:

```js
<div title={::calculateExpensiveTitle(arg1)} />
# {::l10n.welcomeMessage} #
```

### Bi-directional bindings

When using widgets that expose input / output properties (like the value of a text field), it comes quickly handy to be able to use 2-way binding expressions. In XJS this is done through the *{=assignableExpr}* syntax:
```js
<input type="text" @value={=data.firstName}/>
```
The 2-way binding expression should be read like this:
- at first render, the @value will be passed the data.firstName value, and @value will update its host's value (the input element in this examples).
- then if the input value changes, @value will be notified and will push the value into data.firstName
- conversely, if data.firstName changes, @value will be notified and will push the value into the text field.

Note: as 2-way binding expressions require some adaptation code behind the scene, they will usually be only accessible on components or decorators (implementation will depend on the template engine used with XJS).


### Function expressions

As functions are valid JS expressions, they can be naturally passed as expression values:
```
<div @onclick={e=>handleClick(e)}/> // cf. decorators for @onclick
<*datePicker dateCalculator={calculator} logger={text=>console.log(text)}/>
```

In some cases however, we may not need to specify any argument to the inline function. In this case, XJS allows to use the *{=>functionBody}* pattern (in pure JS we would have to use *{()=>functionBody}*)

```
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

Note: built-in and custom decorators both share the same syntax, and there are no syntactical differences from the XJS point of view (in other words built-in decorators are simply reserved names defined by the template engine).

### Orphan decorators

The first possible usage of decorators is to use them as orphan attributes - e.g.

```html
<div class="body" @content />    // to indicate that the default content should go in this div
<input type="text" @mandatory /> // to indicate that this field should not be empty when the parent form is submitted
```

### Decorators with a single value

The second possible usage of decorators is to use them with a value or a biding expression:

```html
<div class="body" @content={data.mainContent} />
<input type="text" @value={=data.firstName} />
<button @onclick={=>processAction()} />
```

### Decorators with multiple values

Sometimes decorators require multiple parameters. In this case XJS proposes to have them gathered into brackets after the decorator name:

```html
<div class="body" @tooltip(class="important" position="top" text={getText()})> # ... # </>
// in this case the 'class' param of the tooltip cannot collide with the 'class' attribute of the div
<button @onclick(listener={=>processAction()} options={{capture:true}})/>
```
Note: the same decorator could be called through the different forms provided that it provides default values for its params. 
When the 'single value' form is used, the parameter that should be picked is the one flagged as 'default parameter' (implementation will depend on the template engine) - cf. *onclick* sample in the previous examples (*listener* is the default param in this case).

### Decorator nodes

Sometimes decorators require to support rich content (ie. element nodes) as params. In this case the attribute form cannot be used to call the decorator and we have to use the decorator node form instead:

```html
<div class="body" @tooltip(class="important" position="top" text={getText()})> 
    <@tooltip position="top">
        // this tooltip will apply to its parent element (i.e. div.body)
        <b> # main tooltip content # </b>
        <.footer type="soft"> # footer content # </>
    </>
    # ... #
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
    for (let i=0; myArray.length>i; i++) {
        <li #first={i===0} #last={i===myArray.length-1}> 
            # {myArray[i]} # 
        </li>
    }
</ul>
```

### Forward labels

One of the general principle of labels is to be scoped to the template they are defined into - the goal being to avoid collision with other labels defined in other parts of an application (which is also a frequent problem with CSS selectors).

However a parent template would sometimes need to query elements that are defined in a sub-component. This is where forward labels come into play - provided that the sub-component has declared some public labels (implementation will depend on the template engine). 

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
// the query on '#item' will return the first div, the cpt instance and the elements labelled as #elt 
// in the cpt generated children (aka. shadow DOM)
```

Of course the forward label argument can be bound to a dynamic expression:
```html
<*cpt ##item={expr()}/>
```
