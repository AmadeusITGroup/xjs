# XTR parser and AST

## XTR parser

Like for [XJS][xjs-parser], XTR is provided with a parser that can scan an XTR string and produce an XTR syntax tree.

The parser API is the following:
```js
export async function parse(xtr: string, context?: XtrParserContext): Promise<XtrFragment> 
```

The parser accepts 2 arguments:
- the xtr string
- an optional context object that contains extra parsing options. These options fall in 2 categories
    - information for better error handling: cf. *fileId*, *line1* and *col1* options below
    - list of pre-processors that should be used during the parsing: cf. *preProcessors* and *globalPreProcessors* options

[xjs-parser]: ./xjs-api.md

```js
// from xtr/parser.ts
export interface XtrParserContext {
    preProcessors?: XtrPreProcessorDictionary;
    fileId?: string;                // e.g. /Users/blaporte/Dev/iv/src/doc/samples.ts
    line1?: number;                 // line 1 position - used to calculate offset for error messages - default: 1
    col1?: number;                  // col 1 position - used to calculate offset for error messages - default: 1
    globalPreProcessors?: string[]; // pre-processors that should process the AST root e.g. ["@@json"]
}

export interface XtrPreProcessorDictionary {
    [name: string]: XtrPreProcessorFactory;
}

// from xtr/ast.ts
export interface XtrPreProcessorFactory {
    (): XtrPreProcessor;
}
```

## XTR Abstract Syntax Tree (AST)

The XTR Syntax tree can be produced through the XTR parser or simply manually. 
Indeed there are cases where it may be interesting to create the XTR content dynamically (to produce dynamic forms for instance), in which case there is no need to create a string and have it parser afterwards.

The root of an XTR AST is always an XTR Fragment that can be created through the ```createXtrFragment``` method in the ast.ts file. Then the AST can be built through the 
``` addElement ``` / 
``` addComponent ``` / 
``` addFragment ``` / 
``` addCData ``` / 
``` addParamNode ``` / 
``` addText ``` / 
``` addParam ``` / 
``` addDecorator ``` and
``` addLabel ``` methods (also in [ast.ts](../src/xtr/ast.ts))

```js
let xf = createXtrFragment(),
    e1 = addElement(xf, "div"),
    e2 = addElement(e1, "span");
addText(e2, " AAA ");
e2 = addElement(e1, "span");
addText(e2, " BBB ");
e1 = addElement(xf, "section");
addText(e1, "Some 'text' in the section");
addText(xf, "Some text at the end");

// xf.toString() will look like:
xtr`
    <div>
        <span> AAA </span>
        <span> BBB </span>
    </>
    <section>Some 'text' in the section</section>
    Some text at the end
`;
```

## XTR Pre-processors

As previously mentioned, XTR supports pre-processors that must support the following interface

```js
// from xtr/ast.ts
export interface XtrPreProcessor {
    // setup is called before the node content is processed
    setup?(target: XtrParamHost, params?: XtrParamDictionary, ctxt?: XtrPreProcessorCtxt): void;
    // process is called when all the node attributes and content are loaded
    process?(target: XtrParamHost, params?: XtrParamDictionary, ctxt?: XtrPreProcessorCtxt): void;
}

export interface XtrParamDictionary {
    [name: string]: XtrParam;
}
```

A simple pre-processor implementation will look like this:

```js
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
        process(target: XtrParamHost, params: XtrParamDictionary, ctxt: XtrPreProcessorCtxt) {
            // params.value returns the 'value' param, (value is the default param)
            // which is an XtrParam that may have a value property
            let suffix = params.value ? params.value.value || "" : "", count = 0;

            let p = ctxt.parent;
            if (p && (p.kind === "#element" || p.kind === "#fragment")) {
                count = p.children ? p.children.length : 0;
            }
            if (target.kind === "#element") {
                suffix = ":" + target.name + suffix;
            }

            addParam(target, "sb" + (params.value ? 1 : 0) + ":" + count + suffix);
        }
    }
}

// adapted from test/xtr.preprocessors.spec.ts
```
