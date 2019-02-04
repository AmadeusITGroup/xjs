
export interface XjsNode {
    kind: "#tplFunction" | "#jsStatements" | "#jsBlock" | "#fragment" | "#element" | "#component" | "#propertyNode" | "#decoratorNode" | "#textNode" | "#attribute" | "#property" | "#decorator" | "#reference" | "#expression" | "#number" | "#boolean" | "#string";
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
    startCode: string;  // the js/ts code at the beginning of the block - e.g. "if (expr()) {" or "else {"
    endCode: string;    // the js/ts code at the end of the block - e.g. "}" or "} while(expr())"
    content: XjsContentNode[] | undefined; // content is undefined if isStart===false
}

/**
 * Fragment node - e.g.
 * <! foo="abc" @bar> or <!/>
 */
export interface XjsFragment extends XjsNode {
    kind: "#fragment" | "#element" | "#component" | "#propertyNode" | "#decoratorNode";
    closed: boolean;  // true if ends with />
    attributes: XjsAttribute[] | undefined;
    properties: XjsProperty[] | undefined;
    decorators: XjsDecorator[] | undefined;
    references: XjsReference[] | undefined;
    content: XjsContentNode[] | undefined;
}

/**
 * Attribute node - e.g.
 * title = {getTitle()} or disabled
 */
export interface XjsAttribute extends XjsNode {
    kind: "#attribute";
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
    ref: string; // e.g. "disabled" or "b.tooltip"
    attributes: XjsAttribute[] | undefined;
    decorators: XjsDecorator[] | undefined;
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
 * Value node: expression - e.g.
 * {getSomeValue()*3} or {::getSomeValue()*3}
 */
export interface XjsExpression extends XjsNode {
    kind: "#expression";
    oneTime: boolean;  // true if "::" is used in the expression
    value: string;     // e.g. "getSomeValue()*3"
}

/**
 * Element node - e.g.
 * <div title="foo"> or <{expr()}>
 */
export interface XjsElement extends XjsFragment {
    kind: "#element" | "#propertyNode";
    hasNameExpression: boolean;  // true if name is an expression
    name: string;                // "div" or "expr()"
}

/**
 * Property node - e.g.
 * <.header title="foo"> or <.{propName()}>
 */
export interface XjsPropertyNode extends XjsElement {
    kind: "#propertyNode";
}

/**
 * Component node - e.g.
 * <$b.modal @foo="bar"/>
 */
export interface XjsComponent extends XjsFragment {
    kind: "#component" | "#decoratorNode";
    ref: string;    // e.g. "b.modal"
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
    attributes: XjsAttribute[] | undefined;
    decorators: XjsDecorator[] | undefined;
    textFragments: string[];                  // e.g. [" Hello "] or [" Hello "," "]
    expressions: XjsExpression[] | undefined; // first expression comes after first text fragment
}
