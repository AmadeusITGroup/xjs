import { TmAstNode, parse as tmParse } from './tm-parser';
import { ARROW_FUNCTION, PARAM, BLOCK, P_START, P_END, ARROW, CONTENT, SCOPES, P_VAR, TYPE_AN, TYPE_SEP, TYPE_PRIMITIVE, SEP, B_DEF, TXT, TXT_END, TXT_START, BLOCK_ATT, B_START, B_END, EXP_MOD, TAG, T_START, T_NAME, T_CLOSE, T_END, ATT, A_NAME, EQ, NUM, TRUE, FALSE, STR_D, S_START, S_END, ATT1, PR, PR_START, PR_END, REF, R_DEF, R_COL, R_COL_START, R_COL_END, DECO1, D_DEF, DECO, D_START, D_END, COMMENT, C_DEF, COMMENT1, C_WS, T_PREFIX } from './scopes';
import { XjsTplFunction, XjsTplArgument, XjsContentNode, XjsText, XjsExpression, XjsFragment, XjsParam, XjsNumber, XjsBoolean, XjsString, XjsProperty, XjsReference, XjsDecorator, XjsEvtListener, XjsJsStatements, XjsJsBlock } from './types';

const RX_END_TAG = /^\s*\<\//, RX_OPENING_BLOCK = /^\s*\{/, RX_TRAILING_LINE = /\n\s*$/;

export async function parse(tpl: string) {
    let nd: TmAstNode, lines: string[] = tpl.split("\n");
    nd = await tmParse(tpl);

    // position of current cursor
    // [0,1] corresponds to root.children[0].children[1]
    let cursor: number[] = [0],
        tNodes: TmAstNode[] = [nd.children[0]],    // nodes corresponding to each cursor in the cursor stack
        cNode: TmAstNode | null = nd.children[0],  // current node
        cNodeValidated = true;

    let root = xjsTplFunction();

    if (!root) {
        // todo: errors
    }
    return root;

    function error(msg) {
        // console.log("ERROR: " + msg);
        throw new Error(msg); // todo
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

    // move cursor to next position and ignore content
    function moveNext(ignoreContent = true) {
        moveCursor();
        if (ignoreContent) {
            while (cNode && cNode.scopeName === CONTENT) {
                cNodeValidated = true;
                moveCursor();
            }
        }
    }

    // return the friendly name of the token passed as argument
    function tokenScope(scopeName?: string) {
        scopeName = scopeName || (cNode ? cNode.scopeName : "");
        return SCOPES[scopeName] || scopeName;
    }

    // move cursor and check expected scope - throw error if not found
    function advance(expectedScope: string, ignoreContent = true) {
        moveNext(ignoreContent);
        if (!cNode) {
            error("Unexpected token (end of template)");
        } else if (cNode.scopeName !== expectedScope) {
            error("Unexpected token: " + tokenScope() + " instead of " + tokenScope(expectedScope));
        }
        cNodeValidated = true;
    }

    // same as advance but doesn't validate the token and doesn't raise errors
    // return true if the next (un-validated) token is of the expected scope
    function lookup(expectedScope: string, ignoreContent = true) {
        moveNext(ignoreContent);
        if (!cNode) {
            error("Unexpected token (end of template)");
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
        if (!cNode || cNode.scopeName !== ARROW_FUNCTION) return null;

        let nd: XjsTplFunction = {
            kind: "#tplFunction",
            arguments: undefined,
            content: undefined
        };
        if (lookup(P_VAR)) {
            // we have one single param - e.g. a => {}
            advance(P_VAR);
            nd.arguments = [{
                name: currentText(),
                typeRef: undefined
            }];
        } else {
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
        }
        advance(ARROW); // =>
        nd.content = xjsContentBlock();
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
    function xjsContentBlock(): XjsContentNode[] | undefined {
        advance(BLOCK);
        advance(B_DEF); // { -> block start

        let nodes = contentNodes(() => lookup(B_DEF));

        advance(B_DEF); // } -> block end
        return (nodes && nodes.length) ? nodes : undefined;
    }

    function contentNodes(endFunction: () => boolean) {
        let nodes: XjsContentNode[] = [];
        while (!endFunction()) {
            if (lookup(TXT)) {
                nodes.push(xjsText());
            } else if (lookupFragment()) {
                nodes.push(xjsFragment());
            } else {
                let jsc = scanJsCode();
                if ((jsc.kind === "#jsStatements" && (jsc as XjsJsStatements).code === "")
                    || (jsc.kind === "#jsBlock" && (jsc as XjsJsBlock).startCode === "")) {
                    break;
                }
                nodes.push(jsc);
            }
        }
        return nodes;
    }

    function scanJsCode(): XjsJsStatements | XjsJsBlock {
        let code: string[] = [], stop = false, lineIdx = cNode ? cNode.startLineIdx : 0, isJsBlock = false, nodes: XjsContentNode[] | undefined = undefined;

        function captureCode() {
            cNodeValidated = true;
            let idx = cNode ? cNode.startLineIdx : 0;
            if (lineIdx !== idx) {
                lineIdx = idx;
                code.push("\n"); // keep line formatting
            }
            code.push(currentText(true, false));
        }

        while (!stop) {
            if (lookup(TAG, false) || lookup(TXT, false)) {
                stop = true;
            } else if (lookup(B_DEF, false)) {
                let isNewBlock = currentText().match(RX_OPENING_BLOCK);
                stop = true;
                if (isNewBlock) {
                    advance(B_DEF); // {
                    captureCode();

                    // parse content
                    nodes = contentNodes(() => lookup(B_DEF));

                    if (nodes.length === 1 && nodes[0].kind === "#jsStatements") {
                        // this block can be considered as code
                        code.push("\n");
                        code.push((nodes[0] as XjsJsStatements).code);
                        lineIdx = cNode ? cNode.startLineIdx : 0;
                        advance(B_DEF);
                        code.push("\n");
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
        let jss: XjsJsStatements = {
            kind: "#jsStatements",
            code: code.join("")
        }
        if (isJsBlock) {
            return {
                kind: "#jsBlock",
                startCode: jss.code,
                endCode: "}",
                content: nodes
            } as XjsJsBlock;
        } else {
            jss.code = jss.code.replace(RX_TRAILING_LINE, "");
            return jss;
        }
    }

    // text node # Hello {expr()} #
    function xjsText(): XjsText {
        advance(TXT);
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
                advance(BLOCK_ATT);
                advance(B_START); // (
                params(nd, false, false);
                advance(B_END); // )
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
        return nd;
    }

    // expression in a block (e.g. attributes or text nodes)
    function xjsExpression(): XjsExpression {
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
        let buffer: string[] = [];
        while (!lookup(B_END, false)) {
            buffer.push(currentText(true, false));
            cNodeValidated = true;
        }
        nd.code = buffer.join("");
        advance(B_END);
        return nd;
    }

    // parse a fragment or one of its sub-type
    // "#fragment" | "#element" | "#component" | "#paramNode" | "#decoratorNode";
    function xjsFragment(): XjsFragment {
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
        advance(T_START, false);

        if (lookup(T_PREFIX)) {
            // paramNode with dynamic name - e.g. <.{expr()}/>
            advance(T_PREFIX);
            nd.kind = "#paramNode";
            nd["name"] = "";
        }
        if (lookup(BLOCK)) {
            // paramNode or element with dynamic name e.g. <{expr()}/>
            let exp = nd["nameExpression"] = xjsExpression();
            nd["name"] = "";
            if (nd.kind !== "#paramNode") {
                nd.kind = "#element";
            }
            nm = "{" + exp.code + "}";
        } else {
            advance(T_NAME, false);
            nm = currentText();
            if (nm.charAt(0) === ".") {
                if (nm.charAt(1) === "@") {
                    nd.kind = "#decoratorNode";
                    nd["ref"] = nm.slice(2);
                } else {
                    nd.kind = "#paramNode";
                    nd["name"] = nm.slice(1);
                    nd["nameExpression"] = undefined;
                }
            } else if (nm.charAt(0) === "$") {
                nd.kind = "#component";
                nd["ref"] = nm.slice(1);
            } else if (nm !== "!") {
                nd.kind = "#element"
                nd["name"] = nm;
                nd["nameExpression"] = undefined;
            }
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

            try {
                nd.content = contentNodes(() => {
                    if (lookup(TAG)) {
                        if (currentText(false).match(RX_END_TAG)) return true;
                    }
                    return false;
                });
            } catch (e) {
                // todo - improve!
                error(`Closing tag not found for ${nm} (${e.message || e})`);
            }

            try {
                // end fragment / element - e.g. </div> or </> or </!>
                advance(TAG);
                advance(T_START);
                advance(T_CLOSE);
                if (lookup(T_NAME)) {
                    advance(T_NAME);
                    let nm2 = currentText();
                    if (nm !== nm2) error(`Start/End tag mismatch: ${nm}/${nm2}`);
                }
                advance(T_END);
            } catch (e) {
                // todo - improve!
                error(`Invalid closing tag for ${nm} (${e.message || e})`);
            }
        } else {
            error(`Invalid token in ${nd.kind} : ${cNode ? cNode.scopeName : "EOT"}`);
        }
        return nd;
    }

    function params(f: XjsFragment | XjsDecorator | XjsText, acceptProperties = true, acceptListeners = true) {
        try {
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
        } catch (e) {
            error(`Invalid attribute\n${e.message || e}`);
        }
    }

    function comment(f: XjsFragment | XjsDecorator | XjsText) {
        let isMultiLine = lookup(COMMENT);
        if (lookup(COMMENT1) || isMultiLine) {
            cNodeValidated = true; // validate current token
            advance(C_DEF); // /* or //
            while (lookup(CONTENT) || lookup(C_WS)) {
                cNodeValidated = true; // comment value or leading white spaces are ignored
            }
            if (isMultiLine) {
                advance(C_DEF); // */
            }
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
            advance(PR);
            advance(PR_START); // [
            advance(A_NAME);
            let nm = currentText();
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
            return true;
        }
        return false;
    }

    function refParam(f: XjsFragment | XjsDecorator | XjsText) {
        if (lookup(REF)) {
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
            }
            if (!f.references) f.references = [];
            f.references.push(nd);
            return true;
        }
        return false;
    }

    function decoParam(f: XjsFragment | XjsDecorator | XjsText) {
        if (lookup(DECO1) || lookup(DECO)) {
            let nd: XjsDecorator = {
                kind: "#decorator",
                ref: "",
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
                nd.ref = currentText();
            } else {
                // normal decorator e.g. @foo=123 or @foo(p1=123 p2={expr()})
                advance(DECO);
                advance(D_DEF);  // @
                advance(A_NAME); // decorator ref
                nd.ref = currentText();
                if (lookup(EQ)) {
                    nd.hasDefaultPropValue = true;
                    advance(EQ); // =
                    nd.defaultPropValue = paramValue();
                } else if (lookup(D_START)) {
                    advance(D_START);
                    params(nd, false);
                    advance(D_END);
                } else {
                    error("Invalid decorator token: = or ( expected instead");
                }
            }
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
        }
        return undefined;
    }
}
