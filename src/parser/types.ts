
export interface XjsNode {
    kind: "#tplFunction" | "#jsStatements" | "#jsBlock" | "#fragment" | "#element" | "#component" | "#paramNode" | "#decoratorNode" | "#textNode" | "#param" | "#property" | "#decorator" | "#reference" | "#expression" | "#number" | "#boolean" | "#string" | "#eventListener";
}

export interface XjsError extends Error {
    kind: "#xjsError";
    message: string;      // shortcut to `Invalid ${e.context} - ${e.message} at line ${e.lineNumber}`
    description: string;
    context: string;
    lineNumber: number;
}

/**
 * Template function (arguments and content) - e.g. 
 * let f = xx.template(`(msg:string) => {
 *     <div class="a"> # Hello {msg} # </div>
 * }`);
 */
export interface XjsTplFunction extends XjsNode {
    kind: "#tplFunction";
    arguments: XjsTplArgument[] | undefined;
    content: XjsContentNode[] | undefined; // e.g. [<div>, # Hello #, </div>]
    indent: string;    // first line indentation (string composed of white spaces)
}

export interface XjsTplArgument {
    name: string;                   // e.g. "msg"
    typeRef: string | undefined;    // e.g. "string"
}

/**
 * XJS nodes that can be found in a content list
 */
export type XjsContentNode = XjsJsStatements | XjsJsBlock | XjsFragment | XjsText;

/**
 * List of js statements as written in the template function.
 * Could contain internal JS blocks that don't contain XJS statements - e.g.
 * let x = someExpr();
 * let y = {a:1, b: 2}
 */
export interface XjsJsStatements extends XjsNode {
    kind: "#jsStatements";
    code: string;  // the js code (e.g. "let x = someExpr(); ... ")
}

/**
 * Javascript block containing XJS statements
 */
export interface XjsJsBlock extends XjsNode {
    kind: "#jsBlock";
    startCode: string;  // the js/ts code at the beginning of the block - e.g. "if (expr()) {" or " else {"
    endCode: string;    // end block code. Should match /\n?\s*\{$/ - e.g. "\n      {"
    content: XjsContentNode[] | undefined; // content is undefined if isStart===false
}

/**
 * Fragment node - e.g.
 * <! foo="abc" @bar> or <!/>
 */
export interface XjsFragment extends XjsNode {
    kind: "#fragment" | "#element" | "#component" | "#paramNode" | "#decoratorNode";
    params: XjsParam[] | undefined;
    listeners: XjsEvtListener[] | undefined;
    properties: XjsProperty[] | undefined;
    decorators: XjsDecorator[] | undefined;
    references: XjsReference[] | undefined;
    content: XjsContentNode[] | undefined;
}

/**
 * Attribute node - e.g.
 * title = {getTitle()} or disabled
 */
export interface XjsParam extends XjsNode {
    kind: "#param";
    name: string;      // e.g. "title" or "disabled"
    isOrphan: boolean; // true if no value is defined
    value: XjsNumber | XjsBoolean | XjsString | XjsExpression | undefined;
}

/**
 * Property node - e.g.
 * title = {getTitle()}
 */
export interface XjsProperty extends XjsNode {
    kind: "#property";
    name: string;
    value: XjsNumber | XjsBoolean | XjsString | XjsExpression;
}

/**
 * Decorator node - e.g.
 * @disabled or @b.tooltip(position={getPos()} text="abcd") or @b.tooltip="some text"
 */
export interface XjsDecorator extends XjsNode {
    kind: "#decorator";
    ref: XjsExpression; // e.g. code = "disabled" or "b.tooltip"
    params: XjsParam[] | undefined;
    decorators: XjsDecorator[] | undefined;
    references: XjsReference[] | undefined;
    hasDefaultPropValue: boolean; // true if value is defined
    isOrphan: boolean;            // true if no value and no attribute nor decorators are defined
    defaultPropValue: XjsNumber | XjsBoolean | XjsString | XjsExpression | undefined;
}

/**
 * Ref node - e.g.
 * #foo or #nodes[] or #nodes[{expr()}]
 */
export interface XjsReference extends XjsNode {
    kind: "#reference";
    name: string;                             // e.g. "foo" or "nodes"
    isCollection: boolean;                    // true if the [] form is used
    colExpression: XjsExpression | undefined; // the collection expression
}

/**
 * Value node: number
 */
export interface XjsNumber extends XjsNode {
    kind: "#number";
    value: number;    // e.g. 123.4
}

/**
 * Value node: boolean
 */
export interface XjsBoolean extends XjsNode {
    kind: "#boolean";
    value: boolean;    // e.g. true
}

/**
 * Value node: string
 */
export interface XjsString extends XjsNode {
    kind: "#string";
    value: string;    // e.g. "some value"
}

/**
 * Event listener - e.g.
 * click(e)={doSomething(); doSomethingElse()}
 */
export interface XjsEvtListener extends XjsNode {
    kind: "#eventListener";
    name: string;                        // e.g. "click"
    argumentNames: string[] | undefined; // e.g. [evt]
    code: string;                        // e.g. "doSomething(evt)"
}

/**
 * Value node: expression - e.g.
 * {getSomeValue()*3} or {::getSomeValue()*3}
 */
export interface XjsExpression extends XjsNode {
    kind: "#expression";
    oneTime: boolean;  // true if "::" is used in the expression
    code: string;      // e.g. "getSomeValue()*3"
}

/**
 * Element node - e.g.
 * <div title="foo"> or <{expr()}>
 */
export interface XjsElement extends XjsFragment {
    kind: "#element" | "#paramNode";
    nameExpression: XjsExpression | undefined;  // defined if name is an expression (e.g. <{expr()}/>)
    name: string;                               // "div" or "" if name is an expression
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
 * <$b.modal @foo="bar"/>
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
    params: XjsParam[] | undefined;
    decorators: XjsDecorator[] | undefined;
    references: XjsReference[] | undefined;
    textFragments: string[];                  // e.g. [" Hello "] or [" Hello "," "]
    expressions: XjsExpression[] | undefined; // first expression comes after first text fragment
}
