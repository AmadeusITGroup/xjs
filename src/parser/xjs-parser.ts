import { TmAstNode, parse as tmParse } from './tm-parser';
import { ARROW_FUNCTION, PARAM, BLOCK, P_START, P_END, ARROW, CONTENT, P_VAR, TYPE_AN, TYPE_SEP, TYPE_PRIMITIVE, SEP, B_DEF, TXT, TXT_END, TXT_START, BLOCK_ATT, B_START, B_END, EXP_MOD, TAG, T_START, T_NAME, T_CLOSE, T_END, ATT, A_NAME, EQ, NUM, TRUE, FALSE, STR_D, S_START, S_END, ATT1, PR, PR_START, PR_END, REF, R_DEF, R_COL, R_COL_START, R_COL_END, DECO1, D_DEF, DECO, D_START, D_END, COMMENT, C_DEF, COMMENT1, C_WS, T_PREFIX } from './scopes';
import { XjsTplFunction, XjsTplArgument, XjsContentNode, XjsText, XjsExpression, XjsFragment, XjsParam, XjsNumber, XjsBoolean, XjsString, XjsProperty, XjsReference, XjsDecorator, XjsEvtListener, XjsJsStatements, XjsJsBlock, XjsError } from './types';

const RX_END_TAG = /^\s*\<\//,
    RX_OPENING_BLOCK = /^\s*\{/,
    RX_TRAILING_LINE = /\n\s*$/,
    RX_SIMPLE_JS_IDENTIFIER = /^[\$_a-zA-Z]\w*$/,
    RX_FRAGMENT_IDENTIFIER = /^\!$/,
    RX_JS_REF_IDENTIFIER = /^([\$_[a-zA-Z]\w*)(\.[\$_[a-zA-Z]\w*)*$/,
    RX_ELT_NAME = /^[\w\$\_][\w\-]*$/,
    RX_ATT_NAME = /^[\$_a-zA-Z][\w\-]*$/,
    RX_INDENT = /(^\s+)/;

export async function parse(tpl: string) {
    let nd: TmAstNode, lines: string[] = tpl.split("\n");
    nd = await tmParse(tpl);

    // position of current cursor
    // [0,1] corresponds to root.children[0].children[1]
    let initIndent = "",
        firstNodeFound = false,
        cursor: number[] = [0, 0],
        tNodes: TmAstNode[] = [nd, nd.children[0]],    // nodes corresponding to each cursor in the cursor stack
        cNode: TmAstNode | null = nd.children[0],  // current node
        cNodeValidated = true,
        lastLine = nd.endLineIdx,
        context: string[] = [];   // error context - provides better error understanding

    let root = xjsTplFunction();
    root.indent = initIndent;

    return root;

    function error(msg: string) {
        let ln = cNode ? cNode.startLineIdx : lastLine, c = context[context.length - 1];

        throw {
            kind: "#xjsError",
            message: `Invalid ${c} - ${msg} at line ${ln + 1}`,
            context: c,
            description: msg,
            lineNumber: ln + 1
        } as XjsError;
    }

    function checkName(nm, rx) {
        if (!nm.match(rx)) {
            error("Invalid name '" + nm + "'");
        }
    }

    // return the text string that corresponds to the current node
    function currentText(leafNodeOnly = true, trim = true) {
        if (!cNode) return "";
        let r: string = "", idx = cNode.startLineIdx, startPos = cNode.startPosition, endIdx = cNode.endLineIdx, endPos = cNode.endPosition;

        if (leafNodeOnly && cNode.children && cNode.children.length) {
            // return only the part that is not covered by the first child
            // this case occurs because of the grouping done in tmparser
            let c0 = cNode.children[0];
            endIdx = c0.startLineIdx;
            endPos = c0.startPosition;
        }

        if (idx === endIdx) {
            r = lines[idx].substring(startPos, endPos);
        } else {
            // this case cannot  occur because of the way Text Mate generates its token
            // i.e. first child token start always at the same position as the parent token 
            // (it is the same token for textmate but will be different after the grouping done in tmparser)
        }

        if (trim) {
            r = r.trim();
        }
        return r;
    }

    // move the current node to next position
    function moveCursor() {
        // first look into children, then next sibling
        if (!cNode) return;
        if (!cNodeValidated) return;
        cNodeValidated = false;

        if (cNode.children && cNode.children.length) {
            // move node to first child
            cursor.push(0);
            tNodes.push(cNode.children[0]);
            cNode = cNode.children[0];
        } else {
            // find next sibling
            let childIdx = 0, parent: TmAstNode, found = false;

            while (!found) {
                if (cursor.length > 1) {
                    // find next sibling
                    childIdx = cursor[cursor.length - 1];
                    parent = tNodes[cursor.length - 2]
                    if (childIdx + 1 < parent.children.length) {
                        found = true;
                        cNode = parent.children[childIdx + 1];
                        cursor[cursor.length - 1] += 1;
                        tNodes[cursor.length - 1] = cNode;
                    } else {
                        // move cursor to parent and look for next sibling
                        cursor.pop();
                        tNodes.pop();
                        cNode = tNodes[tNodes.length - 1];
                    }
                } else {
                    // cursor length = 1 -> we have only one root (aka S)
                    found = true;
                    cNode = null;
                }
            }
        }
    }

    // move cursor to next position and ignore white-space content
    function moveNext(ignoreWsContent = true) {
        moveCursor();
        if (ignoreWsContent) {
            while (cNode && cNode.scopeName === CONTENT && currentText() === "") {
                cNodeValidated = true;
                moveCursor();
            }
        }
    }

    // move cursor and check expected scope - throw error if not found
    function advance(expectedScope: string, ignoreContent = true, errMsg?: string) {
        moveNext(ignoreContent);
        if (!cNode) {
            error(errMsg || "Unexpected end of template");
        } else if (cNode.scopeName !== expectedScope) {
            error(errMsg || "Unexpected token '" + currentText() + "'");
        }
        cNodeValidated = true;
    }

    // same as advance but doesn't validate the token and doesn't raise errors
    // return true if the next (un-validated) token is of the expected scope
    function lookup(expectedScope: string, ignoreContent = true) {
        moveNext(ignoreContent);
        if (!cNode) {
            error("Unexpected end of template");
            return false; // unreachable
        } else {
            return cNode.scopeName === expectedScope
        }
    }

    // return true if the next (un-validated) token is a fragment or one of its sub-types:
    // "#fragment" | "#element" | "#component" | "#propertyNode" | "#decoratorNode";
    function lookupFragment(): boolean {
        return lookup(TAG);
    }

    // template function
    function xjsTplFunction() {
        let nd: XjsTplFunction = {
            kind: "#tplFunction",
            arguments: undefined,
            content: undefined,
            indent: "",
        };
        context.push("template function");
        if (!cNode) {
            error("Empty template");
        }
        if (cNode!.scopeName !== ARROW_FUNCTION) {
            error("Invalid arrow function");
        }
        context.push("template params");
        if (lookup(P_VAR, false)) {
            // we have one single param - e.g. a => {}
            advance(P_VAR);
            nd.arguments = [{
                name: currentText(),
                typeRef: undefined
            }];
        } else if (lookup(PARAM)) {
            // parens mode - e.g. () => {}
            advance(PARAM);   // parameter block
            advance(P_START); // (
            if (lookup(P_VAR)) { // there are arguments
                let arg = xjsTplArgument();
                nd.arguments = [arg];
                while (lookup(SEP)) { // ,
                    // next arguments
                    advance(SEP);
                    nd.arguments.push(xjsTplArgument());
                }
            }
            advance(P_END); // )
        } else {
            error("Invalid template param")
        }
        context.pop();
        advance(ARROW); // =>
        nd.content = xjsContentBlock("template content");
        context.pop();
        return nd;
    }

    // template function argument
    function xjsTplArgument() {
        advance(P_VAR); // argument name
        let nd: XjsTplArgument = {
            name: currentText(),
            typeRef: undefined
        }
        if (lookup(TYPE_AN)) {
            advance(TYPE_AN);  // type annotation
            advance(TYPE_SEP); // :
            advance(TYPE_PRIMITIVE); // argument type
            nd.typeRef = currentText();
        }
        return nd;
    }

    // block containing xjs nodes: e.g. { <div/> }
    function xjsContentBlock(ctxt = "content block"): XjsContentNode[] | undefined {
        context.push(ctxt);
        advance(BLOCK, true, "Invalid JS Block");
        advance(B_DEF); // { -> block start

        if (ctxt === "template content") {
            // calculate first indent
            let c = "";
            while (lookup(CONTENT, false)) {
                advance(CONTENT, false);
                c = currentText(true, false);
                if (c.match(RX_INDENT)) {
                    initIndent = RegExp.$1;
                }
            }
        }

        let nodes = contentNodes(() => lookup(B_DEF));
        for (let nd of nodes) {
            // trim cannot be done inside scanJsCode to preserver white spaces when necessary
            if (nd.kind === "#jsStatements") {
                nd.code = nd.code.trim();
            }
        }

        advance(B_DEF); // } -> block end
        context.pop();
        return (nodes && nodes.length) ? nodes : undefined;
    }

    function contentNodes(endFunction: () => boolean, startLineIdx = 0) {
        let nodes: XjsContentNode[] = [];
        while (!endFunction()) {
            if (lookup(TXT)) {
                nodes.push(xjsText());
            } else if (lookupFragment()) {
                nodes.push(xjsFragment());
            } else {
                let jsc = scanJsCode(startLineIdx);
                if ((jsc.kind === "#jsStatements" && (jsc as XjsJsStatements).code === "")
                    || (jsc.kind === "#jsBlock" && (jsc as XjsJsBlock).startCode === "")) {
                    break;
                }
                nodes.push(jsc);
            }
        }
        if (nodes.length > 1) {
            // trim js statements
            for (let nd of nodes) {
                if (nd.kind === "#jsStatements") {
                    nd.code = nd.code.trim();
                }
            }
        }
        return nodes;
    }

    function scanJsCode(startLineIdx = 0): XjsJsStatements | XjsJsBlock {
        context.push("js-code");
        let code: string[] = [], stop = false, lineIdx = startLineIdx, isJsBlock = false, nodes: XjsContentNode[] | undefined = undefined;

        if (startLineIdx === 0 && cNode) {
            lineIdx = cNode.startLineIdx;
        }
        function captureCode() {
            cNodeValidated = true;
            let idx = cNode ? cNode.startLineIdx : startLineIdx;
            if (lineIdx !== idx) {
                lineIdx = idx;
                code.push("\n"); // keep line formatting
            }
            code.push(currentText(true, false));
        }

        if (lookup(B_DEF, false)) {
            stop = true;
        } else {
            captureCode(); // preserve white spaces
        }
        while (!stop) {
            if (lookup(TAG, false) || lookup(TXT, false)) {
                stop = true;
            } else if (lookup(B_DEF, false)) {
                let ct = currentText(false, false);
                let isNewBlock = ct.match(RX_OPENING_BLOCK);
                stop = true;
                firstNodeFound = true;
                if (isNewBlock) {
                    advance(B_DEF); // {
                    captureCode();
                    if (lookup(CONTENT, false)) {
                        // capture the next white spaces
                        captureCode();
                    }

                    // parse content
                    nodes = contentNodes(() => lookup(B_DEF, false), lineIdx);

                    if (nodes.length === 1 && nodes[0].kind === "#jsStatements") {
                        // this block can be considered as code
                        code.push((nodes[0] as XjsJsStatements).code);
                        lineIdx = cNode ? cNode.startLineIdx : 0;
                        advance(B_DEF);
                        captureCode();
                        stop = false;
                    } else {
                        // this is a true js block
                        advance(B_DEF); // }
                        stop = true;
                        isJsBlock = true;
                    }
                }
            } else {
                captureCode();
            }
        }
        context.pop();
        let jss: XjsJsStatements = {
            kind: "#jsStatements",
            code: code.join("")
        }
        if (isJsBlock) {
            return {
                kind: "#jsBlock",
                startCode: jss.code.replace(RX_TRAILING_LINE, ""),
                endCode: "}",
                content: nodes
            } as XjsJsBlock;
        } else {
            return jss;
        }
    }

    // text node # Hello {expr()} #
    function xjsText(): XjsText {
        context.push("text node");
        advance(TXT);
        checkInitIndent()

        advance(TXT_START); // # -> beginning of text node
        let nd: XjsText = {
            kind: "#textNode",
            params: undefined,
            decorators: undefined,
            references: undefined,
            textFragments: [], // e.g. [" Hello "] or [" Hello "," "]
            expressions: undefined
        }

        let buffer: string[] = [];
        while (!lookup(TXT_END, false)) {
            if (lookup(BLOCK_ATT, false)) {
                context.push("text param");
                advance(BLOCK_ATT);
                advance(B_START); // (
                params(nd, false, false);
                advance(B_END); // )
                context.pop();
            } else if (lookup(BLOCK, false)) {
                // expression block
                nd.textFragments.push(buffer.join(""));
                buffer = [];
                if (!nd.expressions) {
                    nd.expressions = [];
                }
                nd.expressions.push(xjsExpression());
            } else {
                buffer.push(currentText(true, false));
                cNodeValidated = true;
            }
        }
        let s = buffer.join("");
        if (s.length) nd.textFragments.push(s);
        advance(TXT_END); // # -> end of text node
        context.pop();
        return nd;
    }

    // expression in a block (e.g. attributes or text nodes)
    function xjsExpression(): XjsExpression {
        context.push("expression");
        advance(BLOCK);
        advance(B_START);
        let nd: XjsExpression = {
            kind: "#expression",
            oneTime: false,
            code: ""
        }
        if (lookup(EXP_MOD, false)) {
            nd.oneTime = true;
            advance(EXP_MOD);
        }
        let buffer: string[] = [], nm = "";
        while (!lookup(B_END, false)) {
            buffer.push(currentText(true, false));
            if (nm.length < 8) {
                nm = buffer.join("").trim();
                if (nm.length > 8) {
                    nm = nm.slice(0, 8);
                }
                context[context.length - 1] = `expression (${nm})`;
            }
            cNodeValidated = true;
        }
        nd.code = buffer.join("");
        advance(B_END);
        context.pop()
        return nd;
    }

    function checkInitIndent() {
        if (!firstNodeFound && cNode && cNode.children && cNode.children.length && cNode.startPosition !== cNode.children[0].startPosition) {
            let ch0 = cNode.children[0], idx = ch0.startLineIdx;
            initIndent = lines[idx].slice(cNode.startPosition, ch0.startPosition);
        }
        firstNodeFound = true;
    }

    // parse a fragment or one of its sub-type
    // "#fragment" | "#element" | "#component" | "#paramNode" | "#decoratorNode";
    function xjsFragment(): XjsFragment {
        context.push("tag");
        let cPos = context.length - 1;
        let nd: XjsFragment = {
            kind: "#fragment",
            params: undefined,
            listeners: undefined,
            properties: undefined,
            decorators: undefined,
            references: undefined,
            content: undefined
        }
        let nm = "";
        advance(TAG);
        checkInitIndent()
        advance(T_START, false);

        if (lookup(T_PREFIX)) {
            // paramNode with dynamic name - e.g. <.{expr()}/>
            advance(T_PREFIX);
            context[cPos] = "param node";
            nd.kind = "#paramNode";
            nd["name"] = "";
        }
        if (lookup(BLOCK)) {
            // paramNode or element with dynamic name e.g. <{expr()}/>
            let exp = nd["nameExpression"] = xjsExpression();
            nd["name"] = "";
            nm = `{${exp.oneTime ? '::' : ''}${exp.code}}`;
            if (nd.kind !== "#paramNode") {
                context[cPos] = `element (${nm})`;
                nd.kind = "#element";
            } else {
                context[cPos] = `param node (${nm})`;
            }
        } else {
            let rx = RX_SIMPLE_JS_IDENTIFIER, nm2: string, char0 = '';
            advance(T_NAME, false);
            nm2 = nm = currentText();
            char0 = nm.charAt(0);
            if (char0 === ".") {
                nm2 = nm.slice(1);
                context[cPos] = `param node (${nm2})`;
                rx = RX_SIMPLE_JS_IDENTIFIER;
                nd.kind = "#paramNode";
                nd["name"] = nm2;
                nd["nameExpression"] = undefined;
            } else if (char0 === "$") {
                nm2 = nm.slice(1);
                context[cPos] = `component (${nm2})`;
                rx = RX_JS_REF_IDENTIFIER;
                nd.kind = "#component";
                nd["ref"] = {
                    kind: "#expression",
                    oneTime: false,
                    code: nm2
                } as XjsExpression
            } else if (char0 === "@") {
                nm2 = nm.slice(1);
                context[cPos] = `decorator node (${nm2})`;
                rx = RX_JS_REF_IDENTIFIER;
                nd.kind = "#decoratorNode";
                nd["ref"] = {
                    kind: "#expression",
                    oneTime: false,
                    code: nm2
                } as XjsExpression
            } else if (nm !== "!") {
                context[cPos] = `element (${nm})`;
                rx = RX_ELT_NAME;
                nd.kind = "#element"
                nd["name"] = nm;
                nd["nameExpression"] = undefined;
            } else {
                context[cPos] = "fragment";
                rx = RX_FRAGMENT_IDENTIFIER;
            }
            checkName(nm2, rx);
        }

        // extract params
        params(nd);

        if (lookup(T_CLOSE)) {
            advance(T_CLOSE);
            advance(T_END);
        } else if (lookup(T_END)) {
            // fragment start is not self-closed
            // look for child nodes
            advance(T_END)

            nd.content = contentNodes(() => {
                if (lookup(TAG)) {
                    if (currentText(false).match(RX_END_TAG)) return true;
                }
                return false;
            });

            // end fragment / element - e.g. </div> or </> or </!>
            context.push("end of " + context[cPos]);
            advance(TAG);
            advance(T_START);
            advance(T_CLOSE);
            if (lookup(T_NAME)) {
                advance(T_NAME);
                let nm2 = currentText();
                if (nm !== nm2) error(`Name mismatch: '${nm2}' instead of '${nm}'`);
            }
            advance(T_END);
            context.pop()
        } else {
            if (cNode) {
                error(`Invalid param content '${currentText()}'`);
            } else {
                error('Unexpected end of template');
            }
        }
        context.pop();
        return nd;
    }

    function params(f: XjsFragment | XjsDecorator | XjsText, acceptProperties = true, acceptListeners = true) {
        context.push("param");

        let stop = false;
        while (!stop) {
            if (!comment(f)) {
                if (!attParam(f, acceptListeners)) {
                    if (!refParam(f)) {
                        if (!decoParam(f)) {
                            if (acceptProperties) {
                                if (!propParam(f as XjsFragment)) {
                                    stop = true;
                                }
                            } else {
                                stop = true;
                            }
                        }
                    }
                }
            }
        }
        context.pop();
    }

    function comment(f: XjsFragment | XjsDecorator | XjsText) {
        let isMultiLine = lookup(COMMENT);
        if (lookup(COMMENT1) || isMultiLine) {
            context.push("comment");
            cNodeValidated = true; // validate current token
            advance(C_DEF); // /* or //
            while (lookup(CONTENT) || lookup(C_WS)) {
                cNodeValidated = true; // comment value or leading white spaces are ignored
            }
            if (isMultiLine) {
                advance(C_DEF); // */
            }
            context.pop();
            return true;
        }
        return false;
    }

    function attParam(f: XjsFragment | XjsDecorator | XjsText, acceptListeners = true) {
        if (lookup(ATT) || lookup(ATT1)) {
            // e.g. disabled or title={expr()}
            let nd: XjsParam | undefined = {
                kind: "#param",
                name: "",
                isOrphan: false,
                value: undefined
            }, el: XjsEvtListener | undefined = undefined;

            if (lookup(ATT1)) {
                // orphan attribute - e.g. disabled
                nd.isOrphan = true;
                advance(ATT1);
                advance(A_NAME);
                nd.name = currentText();
            } else {
                // e.g. foo="bar"
                advance(ATT);
                advance(A_NAME); // attribute name
                let nm = currentText();
                if (acceptListeners && lookup(PARAM)) {
                    // this attribute is an event listener
                    el = {
                        kind: "#eventListener",
                        name: nm,
                        argumentNames: undefined,
                        code: ""
                    };
                    nd = undefined;
                    advance(PARAM);
                    advance(P_START);

                    // extract listener arguments
                    let argNames: string[] = [];
                    while (!lookup(P_END)) {
                        advance(P_VAR)
                        argNames.push(currentText());
                        if (lookup(SEP)) cNodeValidated = true; // eat comma separator
                    }
                    if (argNames.length) el.argumentNames = argNames;

                    advance(P_END);
                }
                advance(EQ); // =
                if (el) {
                    let exp = xjsExpression();
                    el.code = exp.code;
                } else {
                    nd!.name = nm;
                    nd!.value = paramValue();
                }
            }
            if (nd) {
                checkName(nd.name, RX_ATT_NAME);
            }
            if (el) {
                let ff = f as XjsFragment;
                if (!ff.listeners) ff.listeners = [];
                ff.listeners.push(el);
            } else {
                if (!f.params) f.params = [];
                f.params.push(nd!);
            }
            return true;
        }
        return false;
    }

    function propParam(f: XjsFragment) {
        if (lookup(PR)) {
            context.push("property");
            advance(PR);
            advance(PR_START); // [
            advance(A_NAME);
            let nm = currentText();
            checkName(nm, RX_SIMPLE_JS_IDENTIFIER);
            advance(PR_END);   // ]
            advance(EQ);       // =
            let v = paramValue();
            if (v) {
                let nd: XjsProperty = {
                    kind: "#property",
                    name: nm,
                    value: v
                }
                if (!f.properties) f.properties = [];
                f.properties.push(nd);
            }
            context.pop();
            return true;
        }
        return false;
    }

    function refParam(f: XjsFragment | XjsDecorator | XjsText) {
        if (lookup(REF)) {
            context.push("reference");
            // e.g. #foo or #bar[] or #baz[{expr()}]
            let nd: XjsReference = {
                kind: "#reference",
                name: "",
                isCollection: false,
                colExpression: undefined
            }
            advance(REF);
            advance(R_DEF); // #
            advance(A_NAME);
            nd.name = currentText();
            if (lookup(R_COL)) {
                nd.isCollection = true;
                advance(R_COL); // []
            } else if (lookup(R_COL_START)) {
                nd.isCollection = true;
                advance(R_COL_START); // [{

                if (lookup(EXP_MOD, false)) { // ::
                    // invalid in this case
                    error("One-time modifier cannot be used in reference expressions");
                }
                let buffer: string[] = [];
                while (!lookup(R_COL_END, false)) {
                    buffer.push(currentText(true, false));
                    cNodeValidated = true;
                }
                advance(R_COL_END);   // }]

                nd.colExpression = {
                    kind: "#expression",
                    oneTime: false,
                    code: buffer.join("")
                }
            } else if (lookup(CONTENT, false) && currentText() !== '') {
                error("Invalid content '" + currentText() + "'");
            }
            if (!f.references) f.references = [];
            f.references.push(nd);
            context.pop();
            return true;
        }
        return false;
    }

    function expr(code) {
        return {
            kind: "#expression",
            oneTime: false,
            code: code
        } as XjsExpression;
    }

    function decoParam(f: XjsFragment | XjsDecorator | XjsText) {
        if (lookup(DECO1) || lookup(DECO)) {
            context.push("decorator");
            let nd: XjsDecorator = {
                kind: "#decorator",
                ref: expr(""),
                hasDefaultPropValue: false,
                isOrphan: false,
                params: undefined,
                decorators: undefined,
                references: undefined,
                defaultPropValue: undefined
            }
            if (lookup(DECO1)) {
                // e.g. @important
                nd.isOrphan = true;
                advance(DECO1);
                advance(D_DEF);  // @
                advance(A_NAME); // decorator ref
                nd.ref = expr(currentText());
                checkName(nd.ref.code, RX_JS_REF_IDENTIFIER);
            } else {
                // normal decorator e.g. @foo=123 or @foo(p1=123 p2={expr()})
                advance(DECO);
                advance(D_DEF);  // @
                advance(A_NAME); // decorator ref
                nd.ref = expr(currentText());
                if (lookup(EQ)) {
                    nd.hasDefaultPropValue = true;
                    advance(EQ); // =
                    nd.defaultPropValue = paramValue();
                } else if (lookup(D_START)) {
                    advance(D_START);
                    params(nd, false);
                    advance(D_END);
                } else {
                    error("Invalid decorator token: '=' or '(' expected");
                }
            }
            context.pop();
            if (!f.decorators) f.decorators = [];
            f.decorators.push(nd);
            return true;
        }
        return false;
    }

    // extract the value of a param / attribute / property
    function paramValue() {
        if (lookup(NUM)) {
            advance(NUM);
            return <XjsNumber>{
                kind: "#number",
                value: parseInt(currentText(), 10)
            };
        } else if (lookup(TRUE)) {
            advance(TRUE);
            return <XjsBoolean>{
                kind: "#boolean",
                value: true
            };
        } else if (lookup(FALSE)) {
            advance(FALSE);
            return <XjsBoolean>{
                kind: "#boolean",
                value: false
            };
        } else if (lookup(STR_D)) {
            advance(STR_D);
            advance(S_START);
            advance(CONTENT, false);
            let nd: XjsString = {
                kind: "#string",
                value: currentText()
            };
            advance(S_END);
            return nd;
        } else if (lookup(BLOCK)) {
            return xjsExpression();
        } else {
            error("Invalid param value '" + currentText() + "'");
        }
        return undefined;
    }
}
