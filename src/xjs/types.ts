
export interface XjsNode {
    kind: "#tplFunction" | "#jsStatement" | "#jsBlock" | "#fragment" | "#element" | "#component" | "#paramNode" | "#decoratorNode" | "#textNode" | "#cdata" | "#param" | "#property" | "#decorator" | "#preprocessor" | "#label" | "#expression" | "#tplArgument";
    pos: number;
}

export interface XjsPreProcessor {
    // setup(): called before the node content is processed (synchronous)
    setup?(target: XjsParamHost, params?: { [name: string]: XjsParam }, ctxt?: XjsPreProcessorCtxt): void;
    // process(): called when all the node attributes and content are loaded (asynchronous)
    process?(target: XjsParamHost, params?: { [name: string]: XjsParam }, ctxt?: XjsPreProcessorCtxt): void | Promise<void>;
}

export type XjsParamDictionary = { [name: string]: XjsParam };

export interface XjsPreProcessorCtxt {
    rootFragment: XjsFragment;
    parent: XjsContentHost | null; // null for root fragment
    fileId: string; // e.g. /a/b/c/myfile.ts
    error: (msg: string, pos?: number) => void;
    preProcessors: { [name: string]: XjsPreProcessorFactory };
}

export interface XjsPreProcessorFactory {
    (): XjsPreProcessor;
}

export interface XjsError { // extends Error
    kind: "#Error";
    origin: "XJS";
    description: string;
    message: string;
    line: number;
    column: number;
    lineExtract: string;
    file: string;
}

/**
 * XJS nodes that can be found in a content list
 */
export type XjsContentNode = XjsJsStatement | XjsJsBlock | XjsFragment | XjsText | XjsTplFunction | XjsCData;
export type XjsContentHost = XjsTplFunction | XjsJsBlock | XjsFragment;

/**
 * XJS node params (that can be attached to a ParamHost)
 */
export type XjsNodeParam = XjsParam | XjsProperty | XjsDecorator | XjsDecoratorNode | XjsLabel;
export type XjsParamValue = string | boolean | number | XjsExpression;
export type XjsParamHost = XjsFragment | XjsDecorator | XjsCData;

/**
 * Template function (arguments and content) - e.g. 
 * let f = xx.template(`(msg:string) => {
 *     <div class="a"> # Hello {msg} # </div>
 * }`);
 */
export interface XjsTplFunction extends XjsNode {
    kind: "#tplFunction";
    indent: string;    // first line indentation (string composed of white spaces)
    arguments?: XjsTplArgument[];
    content?: XjsContentNode[]; // e.g. [<div>, # Hello #, </div>]
    hasOptionalArguments?: boolean;
    name?: string;    // template function name (e.g. foo in $template foo () {...})
}

export interface XjsTplArgument extends XjsNode {
    kind: "#tplArgument",
    name: string;        // e.g. "msg"
    typeRef?: string;    // e.g. "string"
    optional?: boolean;
    defaultValue?: string;
}

/**
 * List of js statements as written in the template function.
 * Could contain internal JS blocks that don't contain XJS statements - e.g.
 * let x = someExpr();
 * let y = {a:1, b: 2}
 */
export interface XjsJsStatement extends XjsNode {
    kind: "#jsStatement";
    name: string;  // e.g. "$exec"
    code: string;  // the js code (e.g. "let x = someExpr(); ... ")
    args?: any[];      // list of parsed args - used in $content mode only
}

/**
 * Javascript block containing XJS statements
 */
export interface XjsJsBlock extends XjsNode {
    kind: "#jsBlock";
    name: string;       // e.g. "$if"
    startCode: string;  // the js/ts code at the beginning of the block - e.g. "if (expr()) {" or " else {"
    endCode: string;    // end block code. Should match /\n?\s*\}$/ - e.g. "\n      }"
    content?: XjsContentNode[]; // content is undefined if isStart===false
    args?: any[];      // list of parsed args - used in $content mode only
}

/**
 * Fragment node - e.g.
 * <! foo="abc" @bar> or <!/>
 */
export interface XjsFragment extends XjsNode {
    kind: "#fragment" | "#element" | "#component" | "#paramNode" | "#decoratorNode";
    params?: XjsNodeParam[];
    content?: XjsContentNode[];
}

/**
 * Content data node - e.g.
 * <!cdata> <!
 */
export interface XjsCData extends XjsNode {
    kind: "#cdata";
    params?: XjsNodeParam[];
    text: string;
}

/**
 * Attribute node - e.g.
 * title = {getTitle()} or disabled
 */
export interface XjsParam extends XjsNode {
    kind: "#param";
    name: string;      // e.g. "title" or "disabled"
    isOrphan: boolean; // true if no value is defined
    // isSpread: boolean; // true if is spread operator (in this case name will be "#spread")
    value?: XjsParamValue;
}

/**
 * Property node - e.g.
 * title = {getTitle()}
 */
export interface XjsProperty extends XjsNode {
    kind: "#property";
    name: string;
    // isSpread:boolean; // true if is spread operator 
    value: XjsParamValue;
}

/**
 * Decorator node - e.g.
 * @disabled or @b.tooltip(position={getPos()} text="abcd") or @b.tooltip="some text"
 */
export interface XjsDecorator extends XjsNode {
    kind: "#decorator" | "#preprocessor";
    ref: XjsExpression;           // e.g. code = "disabled" or "b.tooltip"
    hasDefaultPropValue: boolean; // true if value is defined
    isOrphan: boolean;            // true if no value and no attribute nor decorators are defined
    params?: XjsNodeParam[];
    defaultPropValue?: XjsParamValue;
}

/**
 * Pre-processor - e.g. @@md
 * Used internally by the parser but never part of the final AST
 */
export interface XjsPreProcessorNode extends XjsDecorator {
    kind: "#preprocessor";
    parent: XjsParamHost;          // parent is the pre processor target
    grandParent: XjsContentHost;
    instance?: XjsPreProcessor;      // used by parser to store the associated pre-processor instance
    paramsDict?: XjsParamDictionary; // used by parser to store the params in a dictionary
}

/**
 * Ref node - e.g.
 * #foo or #nodes[] or #nodes[{expr()}]
 */
export interface XjsLabel extends XjsNode {
    kind: "#label";
    name: string;           // e.g. "foo" or "nodes" in #foo or #nodes
    fwdLabel: boolean;      // true if ##label -> query forward indicator
    isOrphan: boolean;      // true if no value is defined
    value?: XjsParamValue;
}

/**
 * Value node: expression - e.g.
 * {getSomeValue()*3} or {::getSomeValue()*3}
 */
export interface XjsExpression extends XjsNode {
    kind: "#expression";
    oneTime: boolean;    // true if "::" is used in the expression
    isBinding: boolean;  // true if "=" is used as expression modifier - e.g. foo={=a.b}
    code: string;        // e.g. "getSomeValue()*3"
    refPath?: string[];  // set in $content mode - e.g. ["a", "b"] for code = a.b
}

/**
 * Element node - e.g.
 * <div title="foo"> or <{expr()}>
 */
export interface XjsElement extends XjsFragment {
    kind: "#element" | "#paramNode";
    // nameExpression?: XjsExpression;  // defined if name is an expression (e.g. <{expr()}/>)
    name: string;                       // "div" or "" if name is an expression
}

/**
 * Property node - e.g.
 * <.header title="foo"> or <.{propName()}>
 */
export interface XjsParamNode extends XjsElement {
    kind: "#paramNode";
}

/**
 * Component node - e.g.
 * <*b.modal @foo="bar"/>
 */
export interface XjsComponent extends XjsFragment {
    kind: "#component" | "#decoratorNode";
    ref: XjsExpression; // e.g. code = "b.modal"
}

/**
 * Decorator node - e.g.
 * <.@b.tooltip title="foo">
 */
export interface XjsDecoratorNode extends XjsComponent {
    kind: "#decoratorNode";
}

/**
 * Text node - e.g.
 * # Hello # or # (@foo) Hello {expr()}  #
 */
export interface XjsText extends XjsNode {
    kind: "#textNode";
    textFragments: string[];       // e.g. [" Hello "] or [" Hello "," "]
    expressions?: XjsExpression[]; // first expression comes after first text fragment
}
