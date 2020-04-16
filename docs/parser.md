# XJS Parser, AST and pre-processor APIs

  * [XJS Parser](#xjs-parser)
  * [XJS AST](#xjs-ast)
  * [XJS Pre-processors](#xjs-pre-processors)
  
## XJS Parser

XJS is provided with a parser that produces an Abstract Syntax Tree from a template string. This parser should be typically used in a file pre-processor to replace the template string with some TypeScript code.

The *parse()* function exported by the [parser][] file exposes the following signature:
```js
export async function parse(xjs: string, context?: XjsParserContext): Promise<XjsTplFunction | XjsFragment> 
```

The parser accepts 2 arguments:
- **xjs**: the template string (can be a *$template* string or a *$content* string)
- **context**: an optional context object that contains extra parsing options. These options fall in 3 categories
    - information for better error handling: cf. *fileId*, *line1* and *col1* options below
    - information about the template nature: cf. *templateType*
    - list of pre-processors that should be used during the parsing: cf. *preProcessors* option

```typescript
// from xjs/parser.ts
export interface XjsParserContext {
    fileId?: string;     // e.g. /Users/blaporte/Dev/iv/src/doc/samples.ts
    line1?: number;      // line number of the first template line - used to calculate offset for error messages - default: 1
    col1?: number;       // column number of the first template character - used to calculate offset for error messages - default: 1
    templateType?: "$template" | "$content";    // default value = "$template"
    preProcessors?: { [name: string]: () => XjsPreProcessor };
}
```

Examples can be found in [template.spec][] and [errors.spec][] test files.

[template.spec]: ../src/test/parser/template.spec.ts
[errors.spec]: ../src/test/parser/errors.spec.ts

## XJS AST

XJS Abstract Syntax Tree is described through a series of interfaces that can be found in the [*types.ts*][types] file. 
As per the *parse()* API, the root of the AST should be
- either an *XjsTplFunction* for *$template* templates
- or a *XjsFragment* for *$content* templates

The [parser][] file exports the following helper functions to manipulate the AST:
- **createFragment** to create an *XjsFragment* - e.g. \<!>...</!>
- **createElement** to create an *XjsElement* - e.g. \<div/>
- **createText** to create an *XjsText* node - e.g. Hello
- **addContent** to add an element, a fragment or a text node to a container node
- **addParam** to add an *XjsNodeParam* (e.g. a param, a property, a decorator, a decorator node or a label) to a node that accepts params (e.g. an *XjsElement*)
- **createComponent** to create an *XjsComponent* - e.g. <*cpt>
- **createParamNode** to create an *XjsParamNode* - e.g. <.header>
- **createDecoNode** to create an *XjsDecoratorNode* - e.g. <@tooltip>
- **createExpression** to create an *XjsExpression* - e.g. {a+b+c()}
- **createParam** to create an *XjsParam* - e.g. title="value"
- **createProperty** to create an *XjsProperty* - e.g. [className]="foo"
- **createDecorator** to create an *XjsDecorator* - e.g. @deco
- **createCData** to create an *XjsCData* - e.g. <!cdata> ... </!cdata>
- **createLabel** to create an *XjsLabel* - e.g. #foo or ##bar
- **createJsStatement** to create an *XjsJsStatement* - e.g. $exec x++;
- **createJsBlockStatement** to create an *XjsJsBlock* - e.g. $if (condition) {...}


[types]: ../src/xjs/types.ts
[pre-processors]: ./pre-processors.md
[parser]: ../src/xjs/parser.ts


## XJS Pre-processors

XJS supports pre-processors that can be called at build time (for *$template* strings or static *$content* strings) or runtime (for dynamic *$content* strings).

Pre-processors are objects that can modify the parser AST during the parsing operation. The pre-processor interface is the following:

```typescript
export interface XjsPreProcessor {
    // setup(): called before the node content is processed (synchronous)
    setup?(target: XjsParamHost, params?: { [name: string]: XjsParam }, ctxt?: XjsPreProcessorCtxt): void;
    // process(): called when all the node attributes and content are loaded (synchronous or asynchronous)
    process?(target: XjsParamHost, params?: { [name: string]: XjsParam }, ctxt?: XjsPreProcessorCtxt): void | Promise<void>;
}

```

Note: the parser takes pre-processor factories as argument, this is why a typical pre-processor implementation will look like this:

```typescript
// @@siblings will add a 'sb' param with the nbr of siblings 
// a suffix can be passed as default value
// e.g. <div foo="bar" @@siblings> Hello </div>
//      will generate:
//      <div foo='bar' sb:1:div> Hello </>
// and  <div foo="bar" @@siblings="!!"> Hello </div>
//      will generate:
//      <div foo='bar' sb:1:div!!> Hello </>
function siblings() {
    return {
        process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
            // $$default is the default param - e.g. 123 in @@siblings=123
            let suffix = params["$$default"] ? params["$$default"].value || "" : "", count = 0;

            const p = ctxt.parent;
            if (p && (p.kind === "#element" || p.kind === "#fragment")) {
                count = p.content ? p.content.length : 0;
            }
            if (target.kind === "#element") {
                suffix = ":" + (target as XjsElement).name + suffix;
            }
            addParam(createParam("siblings" + (params["$$default"] ? 1 : 0) + ":" + count + suffix, undefined, true), target);
        }
    }
}
```

More examples can be found in [preprocessors.spec][]

[preprocessors.spec]:../src/test/parser/preprocessors.spec.ts
