import { TmAstNode, parse as tmParse } from './tm-parser';
import { ARROW_FUNCTION, PARAM, BLOCK, P_START, P_END, ARROW, CONTENT, P_VAR, TYPE_AN, TYPE_SEP, TYPE_PRIMITIVE, SEP, B_DEF, TXT, TXT_END, TXT_START, BLOCK_ATT, B_START, B_END, EXP_MOD, TAG, T_START, T_NAME, T_CLOSE, T_END, ATT, A_NAME, EQ, NUM, TRUE, FALSE, STR_D, S_START, S_END, ATT1, PR, PR_START, PR_END, DECO1, D_DEF, DECO, D_START, D_END, COMMENT, C_DEF, COMMENT1, C_WS, T_PREFIX, TYPE_ENTITY, PARAM_OPTIONAL, ASSIGNMENT, DECIMAL_PERIOD, STR_S, TUPLE, BRACE_SQ, LBL, LBL_DEF, MOD, V_ACC, ATT_EXPR, PR_EXPR, V_RW, ATT_SPREAD, PR_SPREAD } from './scopes';
import { XjsTplFunction, XjsTplArgument, XjsContentNode, XjsText, XjsExpression, XjsFragment, XjsParam, XjsNumber, XjsBoolean, XjsString, XjsProperty, XjsDecorator, XjsJsStatements, XjsJsBlock, XjsError, XjsLabel } from './types';

const RX_END_TAG = /^\s*\<\//,
    RX_OPENING_BLOCK = /^\s*\{/,
    RX_TRAILING_LINE = /\n\s*$/,
    RX_SIMPLE_JS_IDENTIFIER = /^[\$_a-zA-Z]\w*$/,
    RX_FRAGMENT_IDENTIFIER = /^\!$/,
    RX_JS_REF_IDENTIFIER = /^([\$_[a-zA-Z]\w*)(\.[\$_[a-zA-Z]\w*)*$/,
    RX_ELT_NAME = /^[\w\$\_][\w\-]*$/,
    RX_ATT_NAME = /^[\$_a-zA-Z][\w\-]*$/,
    RX_INDENT = /(^\s+)/,
    PREFIX_CPT = "*",
    PREFIX_DECORATOR = "@",
    PREFIX_PARAM_NODE = ".",
    FRAGMENT_NAME = "!",
    CR = "\n";

/**
 * Parse a template string and return an AST tree
 * @param tpl the template string
 * @param filePath file path - e.g. a/b/c/foo.ts
 * @param lineOffset line number of the first template line
 * @param columnOffset column offset of the first template character
 */
export async function parse(tpl: string, filePath = "", lineOffset = 0, columnOffset = 0): Promise<XjsTplFunction> {
    let nd: TmAstNode, lines: string[] = tpl.split(CR);
    nd = await tmParse(tpl);

    // position of current cursor
    // [0,1] corresponds to root.children[0].children[1]
    let initIndent = "",
        firstNodeFound = false,
        cursor: number[] = [0, 0],
        tNodes: TmAstNode[] = [nd, nd.children[0]],    // nodes corresponding to each cursor in the cursor stack
        cNode: TmAstNode | null = nd.children[0],      // current node
        cLine = 1,                                     // current line number
        cCol = 0,                                      // current column number
        cNodeValidated = true,
        lastLine = nd.endLineIdx,
        context: string[] = [];   // error context - provides better error understanding

    let root = xjsTplFunction();
    root.indent = initIndent;

    return root;

    function error(msg: string) {
        let c = context[context.length - 1], lnNbr = cLine + lineOffset;

        throw {
            kind: "#Error",
            origin: "XJS",
            message: `Invalid ${c} - ${msg}`,
            line: lnNbr,
            column: cCol,
            lineExtract: ("" + lines[cLine - 1]).trim(),
            file: filePath
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
        if (cNode) {
            cLine = cNode.startLineIdx + 1; // startLineIdx is 0-based
            let ln = lines[cNode.startLineIdx].substring(cNode.startPosition), spaces = 0;
            if (ln.match(/^(\s+)/)) {
                spaces = RegExp.$1.length;
            }
            cCol = 1 + cNode.startPosition + spaces + (cLine === 1 ? columnOffset : 0);
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
            // console.log(cNode)
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
            lineNumber: cLine,
            colNumber: cCol
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
                kind: "#tplArgument",
                name: currentText(),
                typeRef: undefined,
                lineNumber: cLine,
                colNumber: cCol
            }];
        } else if (lookup(PARAM)) {
            // parens mode - e.g. () => {}
            advance(PARAM);   // parameter block
            advance(P_START); // (
            if (lookup(P_VAR)) { // there are arguments
                let arg = xjsTplArgument(nd);
                nd.arguments = [arg];
                while (lookup(SEP)) { // ,
                    // next arguments
                    advance(SEP);
                    nd.arguments.push(xjsTplArgument(nd));
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
    function xjsTplArgument(tplFunc: XjsTplFunction) {
        advance(P_VAR); // argument name
        let nd: XjsTplArgument = {
            kind: "#tplArgument",
            name: currentText(),
            typeRef: undefined,
            lineNumber: cLine,
            colNumber: cCol
        }

        if (lookup(PARAM_OPTIONAL)) {
            advance(PARAM_OPTIONAL);  // ?
            nd.optional = true;
            tplFunc.hasOptionalArguments = true;
        } else if (tplFunc.hasOptionalArguments) {
            error("Optional arguments must be in last position");
        }

        if (lookup(TYPE_AN)) {
            advance(TYPE_AN);  // type annotation
            advance(TYPE_SEP); // :

            let prefix = "";
            while (lookup(MOD)) {
                // module prefix e.g. x.y.MyClass
                advance(MOD);   // x
                prefix += currentText() + ".";
                advance(V_ACC); // .
            }
            if (lookup(TYPE_ENTITY)) {
                advance(TYPE_ENTITY);
            } else if (lookup(TYPE_PRIMITIVE)) {
                advance(TYPE_PRIMITIVE); // argument type
            }
            nd.typeRef = prefix + currentText();
            if (lookup(TUPLE)) {
                // array type - e.g. [] or [][]
                advance(TUPLE);
                advance(BRACE_SQ);
                let c = currentText(true, false);
                while (lookup(CONTENT, false)) {
                    advance(CONTENT, false);
                    c += currentText(true, false);
                }
                nd.typeRef += c;
            }
        }

        if (lookup(ASSIGNMENT)) {
            // default value
            advance(ASSIGNMENT);  // = 
            moveNext(true);
            if (lookup(NUM)) {
                // numeric constant
                advance(NUM);
                let num = currentText();
                if (lookup(DECIMAL_PERIOD)) {
                    advance(DECIMAL_PERIOD);
                    moveNext(false);
                    num += "." + currentText();
                    cNodeValidated = true;
                }
                nd.defaultValue = num;
            } else if (lookup(STR_S) || lookup(STR_D)) {
                // string with single or double quotes
                lookup(STR_S) ? advance(STR_S) : advance(STR_D);
                nd.defaultValue = currentText(false);
                advance(S_START);
                if (lookup(CONTENT)) {
                    advance(CONTENT, false);
                }
                advance(S_END);
            } else if (lookup(TRUE)) {
                advance(TRUE);
                nd.defaultValue = "true";
            } else if (lookup(FALSE)) {
                advance(FALSE);
                nd.defaultValue = "false";
                // } else if (lookup(F_CALL)) {
                //     lookup(F_CALL);
                //     console.log(currentText());
            } else if (lookup(V_RW)) {
                advance(V_RW);
                nd.defaultValue = currentText();
            } else {
                // console.log(cNode)
                error("Invalid parameter initialization");
            }
        }
        comment();
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
            code: code.join(""),
            lineNumber: cLine,
            colNumber: cCol
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
            labels: undefined,
            textFragments: [], // e.g. [" Hello "] or [" Hello "," "]
            expressions: undefined,
            lineNumber: cLine,
            colNumber: cCol
        }

        let buffer: string[] = [];
        while (!lookup(TXT_END, false)) {
            if (lookup(BLOCK_ATT, false)) {
                context.push("text param");
                advance(BLOCK_ATT);
                advance(B_START); // (
                params(nd, false);
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
            isBinding: false,
            code: "",
            lineNumber: cLine,
            colNumber: cCol
        }
        let isFunctionShortcut = false;
        if (lookup(EXP_MOD, false)) {
            advance(EXP_MOD);
            let modText = currentText();
            if (modText === "::") {
                nd.oneTime = true;
            } else if (modText === "=>") {
                isFunctionShortcut = true;
            } else if (modText === "=") {
                nd.isBinding = true;
            }
        }
        let code = xjsExpressionCode();
        if (isFunctionShortcut) {
            nd.code = "()=>" + code;
        } else {
            nd.code = code;
        }
        advance(B_END);
        context.pop()
        return nd;
    }

    function xjsExpressionCode() {
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
        return buffer.join("");
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
        let nm = "";
        advance(TAG);
        checkInitIndent()
        advance(T_START, false);
        let nd: XjsFragment = {
            kind: "#fragment",
            params: undefined,
            properties: undefined,
            decorators: undefined,
            labels: undefined,
            content: undefined,
            lineNumber: cLine,
            colNumber: cCol
        }

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
            if (char0 === PREFIX_PARAM_NODE) {
                nm2 = nm.slice(1);
                context[cPos] = `param node (${nm2})`;
                rx = RX_SIMPLE_JS_IDENTIFIER;
                nd.kind = "#paramNode";
                nd["name"] = nm2;
                nd["nameExpression"] = undefined;
            } else if (char0 === PREFIX_CPT) {
                nm2 = nm.slice(1);
                context[cPos] = `component (${nm2})`;
                rx = RX_JS_REF_IDENTIFIER;
                nd.kind = "#component";
                nd["ref"] = {
                    kind: "#expression",
                    oneTime: false,
                    code: nm2
                } as XjsExpression
            } else if (char0 === PREFIX_DECORATOR) {
                nm2 = nm.slice(1);
                context[cPos] = `decorator node (${nm2})`;
                rx = RX_JS_REF_IDENTIFIER;
                nd.kind = "#decoratorNode";
                nd["ref"] = {
                    kind: "#expression",
                    oneTime: false,
                    code: nm2
                } as XjsExpression
            } else if (nm !== FRAGMENT_NAME) {
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
                let ct = currentText();
                if (ct.length) {
                    error(`Invalid param content '${currentText()}'`);
                } else {
                    error(`Invalid param content`);
                }
            } else {
                error('Unexpected end of template');
            }
        }
        context.pop();
        return nd;
    }

    function params(f: XjsFragment | XjsDecorator | XjsText, acceptProperties = true) {
        context.push("param");

        let stop = false;
        while (!stop) {
            if (!comment()) {
                if (!attParam(f)) {
                    if (!lblParam(f)) {
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

    function comment() {
        if (lookup(C_WS)) {
            // white space in front of comment
            advance(C_WS);
        }
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

    function attParam(f: XjsFragment | XjsDecorator | XjsText) {
        if (lookup(ATT) || lookup(ATT1)) {
            // e.g. disabled or title={expr()}
            let nd: XjsParam | undefined = createParamNode();

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
                advance(EQ); // =
                nd!.name = nm;
                nd!.value = expressionValue();
            }
            if (nd) {
                checkName(nd.name, RX_ATT_NAME);
            }
            addParamNode(nd);
            return true;
        } else if (lookup(ATT_EXPR)) {
            // e.g. {title}
            context.push("param binding shortcut");
            advance(ATT_EXPR);
            let nd = createParamNode(), varName = "", oneTime = false;

            advance(B_START); // {
            if (lookup(EXP_MOD)) {
                // ::
                advance(EXP_MOD);
                oneTime = true;
            }
            advance(V_RW);
            nd.name = varName = currentText();

            let exp: XjsExpression = {
                kind: "#expression",
                oneTime: oneTime,
                isBinding: false,
                code: varName,
                lineNumber: cLine,
                colNumber: cCol
            }
            nd.value = exp;

            advance(B_END); // }
            addParamNode(nd);
            context.pop();
            return true;
        } else if (lookup(ATT_SPREAD)) {
            context.push("param spread");
            advance(ATT_SPREAD);
            let nd = createParamNode();
            nd.name = "#spread";
            nd.isSpread = true;
            advance(B_START); // {
            advance(EXP_MOD); // ...

            let exp: XjsExpression = {
                kind: "#expression",
                oneTime: false,
                isBinding: false,
                lineNumber: cLine,
                colNumber: cCol,
                code: xjsExpressionCode()
            }
            nd.value = exp;

            advance(B_END); // }
            addParamNode(nd);
            context.pop();
            return true;
        }
        return false;

        function createParamNode(): XjsParam {
            return {
                kind: "#param",
                name: "",
                isOrphan: false,
                isSpread: false,
                value: undefined,
                lineNumber: cLine,
                colNumber: cCol
            };
        }

        function addParamNode(nd: XjsParam) {
            if (!f.params) f.params = [];
            f.params.push(nd!);
        }
    }

    function propParam(f: XjsFragment) {
        if (lookup(PR)) {
            context.push("property");
            advance(PR);
            let line1 = cLine, col1 = cCol;
            advance(PR_START); // [
            advance(A_NAME);
            let nm = currentText();
            checkName(nm, RX_SIMPLE_JS_IDENTIFIER);
            advance(PR_END);   // ]
            advance(EQ);       // =
            let v = expressionValue();
            if (v) {
                let nd = createPropNode(nm, v, line1, col1);
                addProperty(nd);
            }
            context.pop();
            return true;
        } else if (lookup(PR_EXPR)) {
            // e.g. {[className]}
            advance(PR_EXPR);
            let oneTime = false, varName = "", line1 = cLine, col1 = cCol;
            context.push("property binding shortcut");

            advance(B_START);
            if (lookup(EXP_MOD)) {
                // ::
                advance(EXP_MOD);
                oneTime = true;
            }
            advance(PR_START);
            advance(V_RW);
            varName = currentText();

            let exp: XjsExpression = {
                kind: "#expression",
                oneTime: oneTime,
                isBinding: false,
                code: varName,
                lineNumber: cLine,
                colNumber: cCol
            }

            let nd = createPropNode(varName, exp, line1, col1);
            advance(B_END);
            addProperty(nd);
            context.pop();
        } else if (lookup(PR_SPREAD)) {
            advance(PR_SPREAD);
            let line1 = cLine, col1 = cCol;
            context.push("property spread");
            advance(B_START); // {
            advance(EXP_MOD); // ...
            advance(PR_START); // [

            let exp: XjsExpression = {
                kind: "#expression",
                oneTime: false,
                isBinding: false,
                lineNumber: cLine,
                colNumber: cCol,
                code: xjsExpressionCode()
            }
            let nd = createPropNode("#spread", exp, line1, col1);
            nd.isSpread = true;

            advance(B_END); // ]}
            addProperty(nd);
            context.pop();
        }
        return false;

        function createPropNode(name: string, value: any, ln = 0, col = 0): XjsProperty {
            return {
                kind: "#property",
                name: name,
                value: value,
                isSpread: false,
                lineNumber: ln ? ln : cLine,
                colNumber: col ? col : cCol
            }
        }

        function addProperty(prop: XjsProperty) {
            if (!f.properties) f.properties = [];
            f.properties.push(prop);
        }
    }

    function lblParam(f: XjsFragment | XjsDecorator | XjsText) {
        if (lookup(LBL)) {
            context.push("label");
            // e.g. #foo or ##bar
            let nd: XjsLabel = {
                kind: "#label",
                name: "",
                fwdLabel: false,
                isOrphan: true,
                value: undefined,
                lineNumber: cLine,
                colNumber: cCol
            }
            advance(LBL);
            advance(LBL_DEF); // # or ##
            if (currentText() === "##") {
                nd.fwdLabel = true;
            }
            advance(A_NAME);
            nd.name = currentText();

            if (nd.fwdLabel && f.kind !== "#component") {
                error("Forward labels (e.g. ##" + currentText() + ") can only be used on component calls");
            }

            if (lookup(CONTENT, false) && currentText() !== '') {
                error("Invalid content '" + currentText() + "'");
            }

            if (lookup(EQ)) {
                advance(EQ); // =
                nd.isOrphan = false;
                nd.value = expressionValue();
            }

            if (!f.labels) f.labels = [];
            f.labels.push(nd);
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
                labels: undefined,
                defaultPropValue: undefined,
                lineNumber: cLine,
                colNumber: cCol
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
                    nd.defaultPropValue = expressionValue();
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
    function expressionValue() {
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
        } else if (lookup(STR_S) || lookup(STR_D)) {
            lookup(STR_D) ? advance(STR_D) : advance(STR_S);
            advance(S_START);
            advance(CONTENT, false);
            let nd: XjsString = {
                kind: "#string",
                value: currentText(),
                lineNumber: cLine,
                colNumber: cCol
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