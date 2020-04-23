import { XjsTplFunction, XjsContentHost, XjsContentNode, XjsText, XjsFragment, XjsTplArgument, XjsElement, XjsParamNode, XjsComponent, XjsDecoratorNode, XjsExpression, XjsParamValue, XjsParam, XjsProperty, XjsDecorator, XjsLabel, XjsParamHost, XjsNodeParam, XjsPreProcessorNode, XjsJsStatement, XjsJsBlock, XjsCData, XjsError, XjsPreProcessor, XjsParamDictionary, XjsPreProcessorCtxt } from './types';

const U = undefined,
    RX_START_INDENT = /^[ \f\r\t\v]*\n(\s*)/,
    RX_ELSE = /^\s*else/,
    RX_STATEMENTS_XJS = /^\$(if|for|exec|let|each|log|template)/,    // $template mode
    RX_STATEMENTS_XTR = /^\$(if|each|log)/,                          // $content mode
    RX_REF_PATH = /^[$_a-zA-Z][_a-zA-Z0-9]*(\.[$_a-zA-Z][_a-zA-Z0-9]*)*$/,
    RX_JS_IDENTIFIER = /^[$_a-zA-Z][_a-zA-Z0-9]*$/,
    RX_FORBIDDEN_TAGS_TPL = /^(script)$/,
    RX_FORBIDDEN_TAGS_CONTENT = /^(script|frame|frameset|iframe)$/,
    CDATA = "cdata",
    PP_DEFAULT_VALUE = "$$default",
    CDATA_LENGTH = CDATA.length,
    CDATA_END = "</!cdata>",
    CDATA_END_LENGTH = CDATA_END.length,
    CHAR_BOS = -1,      // beginning of string
    CHAR_EOS = -2,      // end of string
    CHAR_NL = 10,       // \n new line
    CHAR_SPACE = 32,    // space
    CHAR_BANG = 33,     // !
    CHAR_DQ = 34,       // "
    CHAR_HASH = 35,     // #
    CHAR_SQ = 39,       // '
    CHAR_PARS = 40,     // (
    CHAR_PARE = 41,     // )
    CHAR_STAR = 42,     // *
    CHAR_PLUS = 43,     // +
    CHAR_COMMA = 44,    // ,
    CHAR_MINUS = 45,    // -
    CHAR_DOT = 46,      // .
    CHAR_COLON = 58,    // :
    CHAR_S_COLON = 59,  // ;
    CHAR_QM = 63,       // ?
    CHAR_AT = 64,       // @
    CHAR_FSLA = 47,     // forward slash: /
    CHAR_BSLA = 92,     // back slash: \
    CHAR_SBRS = 91,     // [
    CHAR_SBRE = 93,     // ]
    CHAR_UNDER = 95,    // _
    CHAR_LT = 60,       // <
    CHAR_EQ = 61,       // =
    CHAR_GT = 62,       // >
    CHAR_CS = 123,      // {
    CHAR_CE = 125,      // }
    CHAR_$ = 36,        // $
    CHAR__ = 95,        // _
    CHAR_i = 105,
    CHAR_t = 116,
    CHAR_f = 102,
    CHAR_z = 122,
    CHAR_NBSP = '\u00A0'.charCodeAt(0), // non breaking space
    ESCAPED_CHARS = {
        "33": CHAR_BANG,   // !!
        "36": CHAR_$,      // !$
        "47": CHAR_FSLA,   // !/
        "60": CHAR_LT,     // !<
        "62": CHAR_GT,     // !>
        "95": CHAR_SPACE,  // !_
        "110": CHAR_NL,    // !n
        "115": CHAR_NBSP,  // !s
        "122": CHAR_z,     // !z
        "123": CHAR_CS,    // !{
        "125": CHAR_CE,    // !}
    };

export interface XjsParserContext {
    //preProcessors?: XtrPreProcessorDictionary;
    fileId?: string;                // e.g. /Users/blaporte/Dev/iv/src/doc/samples.ts
    line1?: number;                 // line number of the first template line - used to calculate offset for error messages - default: 1
    col1?: number;                  // column number of the first template character - used to calculate offset for error messages - default: 1
    templateType?: "$template" | "$content";
    preProcessors?: { [name: string]: () => XjsPreProcessor };
}

/**
 * Parse a template string and return an AST tree
 * @param tpl the template string
 */
export async function parse(xjs: string, context?: XjsParserContext): Promise<XjsTplFunction | XjsFragment> {
    const isContentMode = (context && context.templateType === "$content");
    let root: XjsFragment,
        posEOS = xjs.length,
        pos = 0,    // current position
        cc: number = CHAR_EOS,   // current char code at current position
        pcc: number = CHAR_BOS,  // previous cc
        ec: string[] = [],       // error context - provides better error understanding
        ppFactories = context ? context.preProcessors || {} : {},
        preProcessorNodes: XjsPreProcessorNode[] | undefined, // list of pre-processor instance
        ppContext: XjsPreProcessorCtxt | undefined,
        currentPpName = "",  // used for error handing
        currentPpPos = 0;    // used for error handling

    if (posEOS > 0) {
        cc = xjs.charCodeAt(0);
    }
    xjsRoot();
    if (posEOS > 0) {
        if (preProcessorNodes !== U) {
            await processPreProcessors(preProcessorNodes);
            ppContext = U;
            preProcessorNodes = U;
        }

        if (cc !== CHAR_EOS) {
            error();
        }
    }
    return isContentMode ? root! : root!.content![0]! as XjsTplFunction;

    // ########################################################################################################################
    // utility functions

    function moveNext() {
        return shiftNext(1);
    }

    function shiftNext(length: number) {
        pos += length;
        pcc = cc; // pcc is used to manage escaped chars
        return cc = pos < posEOS ? xjs.charCodeAt(pos) : CHAR_EOS;
    }

    function nextCharCode() {
        // return the char code after the current char
        return pos + 1 < posEOS ? xjs.charCodeAt(pos + 1) : CHAR_EOS;
    }

    function nextChars(length: number) {
        // return the substring coming next (including the current char)
        if (pos + length >= posEOS) length = posEOS - length - 1;
        if (length < 1) return "";
        // return pos + length < posEOS ? xjs.substr(pos, length) : "";
        return xjs.substr(pos, length);
    }

    function matchNext(rx: RegExp) {
        if (cc !== CHAR_EOS) {
            return xjs.substring(pos).match(rx);
        }
        return null;
    }

    function eat(charCode: number, errMsg?: string) {
        if (cc !== charCode) {
            if (errMsg === undefined) {
                error(charName(charCode) + " expected instead of " + charName(cc));
            } else {
                error(errMsg);
            }
        }
        return moveNext();
    }

    function eatWord(w: string) {
        const len = w.length, p = pos, extract = nextChars(len);
        if (w === extract) {
            shiftNext(len);
        } else {
            let msg = extract.replace(/\n/g, "\\n");
            if (msg === "" && cc === CHAR_EOS) {
                msg = "End of Content";
            }
            error(`Unexpected characters '${msg}' instead of '${w}'`, p)
        }
        return cc;
    }

    function charName(c: number) {
        if (c === CHAR_EOS) return "End of Content";
        return "'" + String.fromCharCode(c) + "'";
    }

    function stringContent(delimiter: number, includeDelimiter = true): string {
        let charCodes: number[] = [];
        if (includeDelimiter) {
            charCodes.push(delimiter);
        }
        ec.push("string");
        eat(delimiter);
        while (cc !== delimiter && cc !== CHAR_EOS) {
            if (cc === CHAR_BSLA) { // \
                moveNext();
            }
            charCodes.push(cc);
            moveNext();
        }
        eat(delimiter);
        if (includeDelimiter) {
            charCodes.push(delimiter);
        }
        ec.pop();
        return String.fromCharCode.apply(null, charCodes);
    }

    function ccIsChar() {
        // a:97 z:122 A:65 Z:90
        return (cc > 96 && cc < 123) || (cc > 64 && cc < 91);
    }

    function ccIsNumber() {
        // 0:48 9:57
        return cc > 47 && cc < 58;
    }

    function ccIsSign() {
        return cc === CHAR_PLUS || cc === CHAR_MINUS;
    }

    function isSpace(c: number) {
        // CHAR_BACK = 8,   // \b backspace
        // CHAR_TAB = 9,    // \t tab
        // CHAR_NL = 10,    // \n new line
        // CHAR_VTAB = 11,  // \v vertical tab
        // CHAR_FEED = 12,  // \f form feed
        // CHAR_CR = 13,    // \r carriage return
        return c === CHAR_SPACE || (c > 7 && c < 14);
    }

    function eatComments(): boolean {
        if (cc !== CHAR_FSLA) return false;
        let nc = nextCharCode();
        if (nc === CHAR_FSLA) {
            // double-slash comment
            eatWord("//");
            while (CHAR_NL !== cc as any && CHAR_EOS !== cc as any) {
                moveNext();
            }
            moveNext(); // to eat last new line
            return true;
        } else if (nc === CHAR_STAR) {
            eatWord("/*");
            let processing = true;
            while (processing) {
                if (CHAR_EOS === cc as any || (CHAR_STAR === cc as any && nextCharCode() === CHAR_FSLA)) {
                    moveNext();
                    processing = false;
                }
                moveNext();
            }
            return true;
        }
        return false;
    }

    function error(msg?: string, errorPos?: number) {
        let c = (isContentMode) ? "$content" : "$template";
        if (ec.length) {
            c = ec[ec.length - 1];
        }
        let lines = xjs.split("\n"), lineLen = 0, posCount = 0, idx = 0, lineNbr = lines.length, columnNbr = lines[lineNbr - 1].length;
        errorPos = errorPos || pos;
        if (errorPos > -1) {
            while (idx < lines.length) {
                lineLen = lines[idx].length;
                if (posCount + lineLen < errorPos) {
                    // continue
                    idx++;
                    posCount += lineLen + 1; // +1 for carriage return
                } else {
                    // stop
                    lineNbr = idx + 1;
                    columnNbr = 1 + errorPos - posCount;
                    break;
                }
            }
        }

        let fileInfo = "";
        if (context !== U && context.fileId !== U) {
            fileInfo = `\nFile: ${context.fileId}`;
        }
        let lineNbrMsg = lineNbr;
        if (context) {
            lineNbrMsg += context.line1 !== undefined ? context.line1 - 1 : 0;
            if (lineNbr === 1) {
                columnNbr += context.col1 !== undefined ? context.col1 - 1 : 0;
            }
        }

        if (msg === U) {
            msg = `Invalid ${c}: Invalid character ${charName(cc)}`;
        } else {
            msg = `Invalid ${c}: ${msg}`;
        }

        const err: XjsError = {
            kind: "#Error",
            origin: "XJS",
            description: msg,
            message: "XJS: " + msg + "\nLine " + lineNbrMsg + " / Col " + columnNbr + fileInfo + "\nExtract: >> " + lines[lineNbr - 1].trim() + " <<",
            file: context ? context.fileId || "" : "",
            line: lineNbrMsg,
            column: columnNbr,
            lineExtract: lines[lineNbr - 1].trim()
        }
        throw err;
    }

    // ########################################################################################################################
    // parser functions

    function xjsRoot() {
        root = createFragment(pos);

        if (isContentMode) {
            // $content template
            xjsContent(root, "$content");
        } else {
            // $template template
            const p = pos;
            xjsSpaces(false, false);
            if (cc === CHAR_EOS) {
                error("Empty template", p);
            }
            if (!xjsTplFunction(root)) {
                error("Invalid $template function", p);
            }
        }
    }

    function xjsSpaces(required = false, errorOnEOS = true): boolean {
        // eat spaces and comments (white spaces or carriage return, tabs, etc.) 
        // return true if spaces or comments have been found
        let processing = true, p1 = pos;

        if (cc !== CHAR_EOS) {
            while (processing) {
                if (isSpace(cc)) {
                    // white spaces
                    moveNext();
                    eatComments();
                } else if (!eatComments()) {
                    processing = false;
                }
            }
        }
        if (required && p1 === pos) {
            error("Invalid syntax: spaces expected instead of " + charName(cc), p1);
        }

        if (cc === CHAR_EOS && errorOnEOS && !isContentMode) {
            error("Unexpected End of Content");
        }
        return p1 !== pos;
    }

    function xjsTplFunction(parent: XjsContentHost, root = true): boolean {
        // e.g. (arg:Type, arg2) => { ... }  -> root === true
        // or   $template foo(arg) { ... }   -> root === false
        // return true if a tpl function is found
        if ((root && cc !== CHAR_PARS) || (!root && cc !== CHAR_$)) return false; // ( or $
        ec.push("template function");
        const tf = createTplFunction(pos);
        addContent(tf, parent);

        if (!root) {
            // e.g. $template name(arg) {
            eatWord("$template");
            xjsSpaces(true);
            tf.name = jsIdentifier() || "";
            if (tf.name === "") {
                error("Invalid syntax: $template name cannot be empty", pos);
            }
            xjsSpaces();
        }

        // parameters
        ec.push("template arguments");
        eat(CHAR_PARS); // (
        let keepGoing = true, jsId: string | undefined, p1: number, lastIsOptional = false;
        while (keepGoing) {
            xjsSpaces();
            p1 = pos;
            jsId = jsIdentifier();
            if (jsId !== U) {
                let arg = addArgument(tf, jsId, pos);
                xjsSpaces();
                if (cc === CHAR_QM) { // ? -> optional arg
                    arg.optional = lastIsOptional = true;
                    moveNext();
                    xjsSpaces();
                }
                if (cc === CHAR_COLON) { // : -> type information
                    moveNext();
                    xjsSpaces();
                    arg.typeRef = jsExpression(false, U, U, true);
                    xjsSpaces();
                }
                if (cc === CHAR_EQ) { // = -> default value
                    moveNext();
                    xjsSpaces();
                    arg.defaultValue = jsExpression(false);
                }
                if (lastIsOptional && !arg.optional) {
                    error("Optional arguments must be in last position", p1);
                }
            }
            xjsSpaces();
            if (cc !== CHAR_COMMA) {
                keepGoing = false;
            } else {
                cc = moveNext();
            }
        }
        eat(CHAR_PARE); // )
        ec.pop();

        // arrow =>
        xjsSpaces();
        if (root) {
            eatWord("=>");
            xjsSpaces();
        }

        // content block
        eat(CHAR_CS);   // {
        if (matchNext(RX_START_INDENT)) {
            tf.indent = RegExp.$1;
        }
        xjsContent(tf, "template content"); // content
        eat(CHAR_CE);   // }
        if (root) {
            xjsSpaces(false, false);
        }
        ec.pop();
        return true;
    }

    function xjsContent(parent: XjsContentHost, desc = "content block") {
        // parse xjs content: text or element or fragments or cdata
        ec.push(desc);
        while (true) {
            if (!xjsElement(parent) && !xjsJsStatement(parent) && !xjsText(parent)) {
                break;
            }
        }
        ec.pop();
    }

    function xjsText(parent: XjsContentHost): boolean {
        // return true if blank spaces or text characters have been found
        if ((cc === CHAR_LT && pcc !== CHAR_BANG) || cc === CHAR_EOS || cc === CHAR_CE) return false;
        if (isJsStatement()) return false;
        ec.push("text node");

        let spacesFound = xjsSpaces(), startPos = pos, charCodes: number[] = [], specialCharFound = false;
        if (cc !== CHAR_LT && cc !== CHAR_EOS && !isJsStatement()) {
            const tn = createText([], startPos);

            if (spacesFound) {
                charCodes[0] = CHAR_SPACE; // leading spaces are transformed in a single space
            }
            let lastIsSpace = spacesFound;
            while (cc !== CHAR_LT && cc !== CHAR_EOS && cc !== CHAR_CE && !isJsStatement()) {
                eatComments();
                // capture string
                if (cc === CHAR_BANG) {
                    // escaped chars
                    const newPcc = pcc;
                    cc = eat(CHAR_BANG); // !
                    const escValue = ESCAPED_CHARS["" + cc];
                    if (escValue !== U) {
                        if (cc === CHAR_z) {
                            // !z case: we remove all previous and next spaces
                            if (lastIsSpace && charCodes.length > 0) {
                                charCodes.pop(); // remove last element
                            }
                            lastIsSpace = true;
                            pcc = newPcc;
                            moveNext();
                        } else {
                            lastIsSpace = false;
                            moveNext();
                            charCodes.push(escValue);
                            pcc = escValue;
                            specialCharFound = true;
                        }
                    } else {
                        charCodes.push(CHAR_BANG);
                        lastIsSpace = false;
                    }
                } else if (cc === CHAR_CS) { // { -> expression
                    pushExpression(xjsExpression(), tn);
                    lastIsSpace = false;
                } else {
                    if (lastIsSpace && isSpace(cc)) {
                        moveNext(); // keep only one space and eats new lines
                    } else {
                        lastIsSpace = isSpace(cc);
                        charCodes.push(lastIsSpace ? CHAR_SPACE : cc); // all spaces are transformed into " "
                        moveNext();
                    }
                }
            }

            pushExpression(null, tn);
            if (!specialCharFound && tn.expressions === U &&
                ((tn.textFragments.length === 1 && tn.textFragments[0] === " ")
                    || tn.textFragments.length === 0)) {
                // ignore space text node unless spaces were explicitly requested
                ec.pop();
                return true;
            }
            addContent(tn, parent);


        }
        ec.pop();
        return true;

        function pushExpression(e: XjsExpression | null, tn: XjsText) {
            if (e !== null) {
                if (charCodes.length) {
                    tn.textFragments.push(String.fromCharCode.apply(null, charCodes));
                    charCodes = [];
                } else {
                    tn.textFragments.push("");
                }
                if (tn.expressions === U) {
                    tn.expressions = [e];
                } else {
                    tn.expressions.push(e);
                }
            } else if (charCodes.length) {
                // last call
                tn.textFragments.push(String.fromCharCode.apply(null, charCodes));
            }
        }
    }

    function isJsStatement(): boolean {
        if (cc !== CHAR_$) return false;
        return matchNext(isContentMode ? RX_STATEMENTS_XTR : RX_STATEMENTS_XJS) !== null;
    }

    function xjsElement(parent: XjsContentHost): boolean {
        // return true if an element, a fragment or a cdata section has been found
        if (cc !== CHAR_LT || nextCharCode() === CHAR_FSLA) return false;
        cc = eat(CHAR_LT); // <
        // prefix: [none] or * or . or @ (! is treated separately)
        let prefix = 0, posRef = -1;
        eatPrefix();
        let name = "", node: XjsContentHost, desc = "element";
        if (cc === CHAR_BANG) {
            eat(CHAR_BANG);
            if (xjsCData(parent)) {
                return true;
            }
            desc = "fragment";
            ec.push(desc);
            node = createFragment(pos);
            addContent(node, parent);
        } else {
            if (prefix === CHAR_STAR) {
                desc = "component";
            } else if (prefix === CHAR_DOT) {
                desc = "param node";
            } else if (prefix === CHAR_AT) {
                desc = "decorator node";
            }
            ec.push(desc);
            posRef = pos;
            name = xjsIdentifier(true, prefix === 0, desc + " identifier");
            node = createNode();
            if ((prefix === CHAR_STAR || prefix === CHAR_AT) && !name.match(RX_REF_PATH)) {
                error("Invalid " + desc + " reference: '" + name + "'", posRef);
            } else if (prefix === CHAR_DOT && !name.match(RX_JS_IDENTIFIER)) {
                error("Invalid identifier: '" + name + "'", posRef);
            }
            if (prefix === 0 && name.match(isContentMode ? RX_FORBIDDEN_TAGS_CONTENT : RX_FORBIDDEN_TAGS_TPL)) {
                error("Invalid tag name '" + name + "'", posRef);
            }
        }

        // let ppDataList: XtrPreProcessorData[] | null = null;
        const spacesAfterName = xjsSpaces();
        if (spacesAfterName) {
            // spaces have been found: parse params
            const ppNodes = xjsParams(node as XjsParamHost, parent as XjsParamHost, endParamReached);
            setupPreProcessors(ppNodes);
        }
        if (cc === CHAR_FSLA) {
            // end of element
            eatWord("/>");
        } else if (cc === CHAR_GT) {
            eat(CHAR_GT); // >
            // parse element content
            xjsContent(node);
            // parse end of element
            eatWord("</");
            let endPos = pos;
            let p1 = prefix, p2 = eatPrefix(), name2 = xjsIdentifier(false, prefix === 0, desc + " identifier");
            if (name2 === "" && p2 === 0 && CHAR_BANG === cc as any) {
                eat(CHAR_BANG); // end of fragment !
            } else if (name2 !== "" || p2 !== 0) {
                // end tag name is provided
                if (p1 !== p2 || (name2 !== "" && name2 !== name)) {
                    error('End tag </' + eltName(p2, name2) + '> doesn\'t match start tag <' + eltName(p1, name) + '>', endPos);
                }
            }
            xjsSpaces();
            eat(CHAR_GT); // >
        } else if (!spacesAfterName) {
            error("Invalid character in " + desc + " identifier: " + charName(cc), pos);
        } else {
            error("Unexpected character: " + charName(cc), pos);
        }

        ec.pop();
        return true;

        function eatPrefix() {
            if (cc === CHAR_STAR || cc === CHAR_DOT || cc === CHAR_AT) { // * . @
                prefix = cc;
                cc = moveNext(); // eat prefix
                return prefix;
            }
            return 0;
        }

        function createNode(): XjsContentHost {
            if (prefix === CHAR_STAR) { // *
                let cpt = createComponent(createExpression(name, posRef), pos);
                cpt.ref.refPath = getRefPath(cpt.ref.code);
                return addContent(cpt, parent) as XjsContentHost;
            } else if (prefix === CHAR_DOT) { // .
                return addContent(createParamNode(name, pos), parent) as XjsContentHost;
            } else if (prefix === CHAR_AT) { // @
                // decorator node: stored as param
                let dNode = createDecoNode(createExpression(name, posRef), pos);
                dNode.ref.refPath = getRefPath(dNode.ref.code);
                return addParam(dNode, parent as any) as any;
            }
            return addContent(createElement(name, pos), parent) as XjsContentHost;
        }

        function eltName(prefix: number, nm: string) {
            return (prefix === 0 ? "" : String.fromCharCode(prefix)) + nm;
        }
    }

    function xjsParams(parent: XjsParamHost, grandParent: XjsParamHost, endReached: () => boolean): XjsPreProcessorNode[] | null {
        let prefix = 0, keepGoing = true, result: XjsPreProcessorNode[] | null = null, startPos = -1, desc = "";
        ec.push("param");
        while (keepGoing && !endReached()) {
            // param name: prefix + name
            startPos = pos;
            if (cc === CHAR_AT) {
                desc = "decorator";
            } else if (cc === CHAR_HASH) {
                desc = "label";
            } else if (cc === CHAR_SBRS) {
                desc = "property";
            } else {
                desc = "param";
            }
            prefix = eatPrefix();
            let ppn: XjsPreProcessorNode | null = null, isProperty = false, isFwdLabel = false, name: string;
            if (prefix === CHAR_AT && cc === CHAR_AT) {
                // this is a pre-processor
                eat(CHAR_AT); // 2nd @
                const ppnPos = pos - 2; // to be before the '@@' prefix
                name = jsIdentifier() || "";

                if (name === "") {
                    error("Invalid preprocessor reference", ppnPos);
                } else if (parent.kind === "#preprocessor" || parent.kind === "#decorator" || parent.kind === "#decoratorNode") {
                    error("@@" + name + " cannot be used in this context", ppnPos);
                }

                ppn = {
                    kind: "#preprocessor",
                    ref: createExpression("@@" + name, pos),
                    pos: ppnPos,
                    hasDefaultPropValue: false,
                    isOrphan: false,
                    parent: parent,
                    grandParent: grandParent as any
                }
                if (result === null) {
                    result = [];
                }
                result.push(ppn);
            } else if (prefix === 0 && cc === CHAR_CS) {
                // binding shortcut {type} or {::type} or {::[type]}
                ec.push("binding shortcut");
                let oneTime = false;
                cc = eat(CHAR_CS); // {
                if (cc === CHAR_COLON) {
                    eatWord("::");
                    oneTime = true;
                }
                xjsSpaces();
                if (cc === CHAR_SBRS) {
                    eat(CHAR_SBRS); // [
                    isProperty = true;
                    xjsSpaces();
                }
                name = jsIdentifier() || ""; // todo
                if (isProperty) {
                    xjsSpaces();
                    eat(CHAR_SBRE); // ]
                }
                xjsSpaces();
                eat(CHAR_CE); // }
                const e = createExpression(name, startPos);
                e.oneTime = oneTime;
                registerParam(name, parent, e, isProperty);
                if (!xjsSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
                ec.pop();
                continue
            } else {
                ec.push(desc);
                if (prefix === CHAR_HASH && cc === CHAR_HASH) {
                    eat(CHAR_HASH);
                    isFwdLabel = true;
                }
                let nmPos = pos;
                if (prefix !== 0) {
                    nmPos -= 1;
                }
                name = xjsIdentifier(true, prefix === 0, desc + " name");
                if (prefix === CHAR_SBRS) { // [
                    eat(CHAR_SBRE); // ]
                    isProperty = true;
                } else if (prefix === CHAR_HASH && parent.kind === "#preprocessor") {
                    error("Labels cannot be used on pre-processors", nmPos);
                }
                if (prefix === CHAR_HASH || prefix === CHAR_SBRS) {
                    // name must be a valid js identifier
                    if (!name.match(RX_JS_IDENTIFIER)) {
                        error("Invalid name '" + name + "'", nmPos);
                    }
                }
                if (isFwdLabel && parent.kind !== "#component") {
                    error("Forward label '" + name + "' can only be used on components", nmPos - 1);
                }
            }

            let spacesFound = xjsSpaces();
            if (cc === CHAR_EQ) {
                // look for value
                eat(CHAR_EQ);
                xjsSpaces();
                if (ppn !== null) {
                    registerParam(PP_DEFAULT_VALUE, ppn, xjsParamValue(), false, isFwdLabel, true); // $$default
                } else {
                    registerParam(name, parent, xjsParamValue(), isProperty, isFwdLabel);
                }
                if (!xjsSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
            } else if (prefix === CHAR_AT && cc === CHAR_PARS) {
                // multiple params for a decorator or a preprocessor
                let d: XjsParamHost;
                if (ppn !== null) {
                    d = ppn;
                } else {
                    d = registerParam(name, parent) as XjsDecorator | XjsPreProcessorNode;
                }
                // look for attribute params for decorators
                eat(CHAR_PARS); // ( parens start
                xjsSpaces();

                xjsParams(d, parent, endDecoParamReached);
                eat(CHAR_PARE); // ) parens end

                if (!xjsSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
            } else if (spacesFound || cc === CHAR_GT || cc === CHAR_FSLA || cc === CHAR_PARE) { // > or / or )
                // orphan attribute
                if (ppn !== null) {
                    ppn.isOrphan = true;
                } else {
                    registerParam(name, parent, U, false, isFwdLabel);
                }
            } else {
                keepGoing = false;
            }
            if (ppn === null) {
                ec.pop();
            }
        }
        if (!endReached()) {
            error();
        }

        ec.pop();
        return result;

        function endDecoParamReached() {
            return (cc === CHAR_PARE); // )
        }

        function registerParam(name: string, p: XjsParamHost, value?: any, isProperty: boolean = false, isFwdLabel = false, isPpnParam = false): XjsNodeParam {
            // create the param node and add it to the params collection
            let param: XjsNodeParam;
            if (prefix === CHAR_AT && !isPpnParam) {
                // decorator param
                param = createDecorator(createExpression(name, startPos), startPos);
                if (value !== U) {
                    param.hasDefaultPropValue = true;
                    param.defaultPropValue = value;
                } else {
                    param.isOrphan = true;
                }
                param.ref.refPath = getRefPath(param.ref.code);
            } else if (prefix === CHAR_HASH) {
                // label param
                param = createLabel(name, startPos);
                param.value = value;
                param.isOrphan = value === U;
                param.fwdLabel = isFwdLabel;
            } else if (isProperty) {
                // property param
                param = createProperty(name, value, startPos);
            } else {
                // normal param
                param = createParam(name, value, value === U, startPos);
            }
            return addParam(param, p);
        }

        function eatPrefix(): number {
            // [ @ or #
            if (cc === CHAR_SBRS || cc === CHAR_AT || cc === CHAR_HASH) {
                let res = cc;
                moveNext();
                return res;
            }
            return 0;
        }
    }

    function xjsParamValue(canBeExpression = true, canBeIdentifier = false): XjsParamValue {
        const p = pos, desc = canBeIdentifier ? "argument" : "param value";
        // return the param value
        if (cc === CHAR_SQ) {
            return stringContent(CHAR_SQ, canBeIdentifier); // single quote string
        } else if (cc === CHAR_DQ) {
            return stringContent(CHAR_DQ, canBeIdentifier); // double quote string
        } else if (canBeExpression && cc === CHAR_CS) { // {
            return xjsExpression();
        } else if (!canBeIdentifier && cc === CHAR_t) {
            // true
            eatWord("true");
            return true;
        } else if (!canBeIdentifier && cc === CHAR_f) {
            // false
            eatWord("false");
            return false;
        } else if (ccIsNumber() || ccIsSign()) {
            // number: 123 or 12.34
            let charCodes: number[] = [];
            if (ccIsSign()) {
                charCodes.push(cc);
                moveNext();
                xjsSpaces();
            }
            while (ccIsNumber()) {
                charCodes.push(cc);
                moveNext();
            }
            if (cc === CHAR_DOT) {
                charCodes.push(CHAR_DOT);
                moveNext();
                if (!ccIsNumber()) {
                    error("Invalid number");
                }
                while (ccIsNumber()) {
                    charCodes.push(cc);
                    moveNext();
                }
            }
            return parseFloat(String.fromCharCode.apply(null, charCodes));
        } else if (canBeIdentifier) {
            let v = xjsIdentifier(true, false);
            if (v === "true") return true;
            else if (v === "false") return false;
            return v;
        }
        error("Invalid " + desc + ": " + charName(cc), p);
        return 0;
    }

    function endParamReached() {
        return (cc === CHAR_FSLA || cc === CHAR_GT); // / or >
    }

    function xjsCData(parent: XjsContentHost): boolean {
        if (CDATA === nextChars(CDATA_LENGTH)) {
            ec.push("cdata section");
            let startPos = pos;
            eatWord(CDATA);
            let cdata = createCData(pos), ppNodes: XjsPreProcessorNode[] | null = null;
            addContent(cdata, parent);
            if (xjsSpaces()) {
                // spaces have been found: parse params
                ppNodes = xjsParams(cdata, parent as XjsParamHost, endParamReached);
                setupPreProcessors(ppNodes);
            }
            eat(CHAR_GT); // >

            let charCodes: number[] = [], processing = true;

            while (processing) {
                if (cc === CHAR_EOS) {
                    processing = false;
                    error("end marker '</!cdata>' not found", startPos - 2)
                } else if (cc === CHAR_BANG) {
                    // ! -> escape sequence
                    moveNext();
                    if (CDATA_END === nextChars(CDATA_END_LENGTH)) {
                        // we escape end of cdata
                        charCodes.push(cc);
                        moveNext();
                    } else {
                        // push the backslash
                        charCodes.push(CHAR_BANG);
                    }
                } else {
                    if (cc === CHAR_LT && CDATA_END === nextChars(CDATA_END_LENGTH)) {
                        eatWord(CDATA_END);
                        processing = false;
                    } else {
                        charCodes.push(cc);
                        moveNext();
                    }
                }
            }
            cdata.text = String.fromCharCode.apply(null, charCodes);
            ec.pop();
            return true;
        }
        return false;
    }

    function xjsIdentifier(mandatory: boolean, acceptDashes = false, desc = "identifier"): string {
        // e.g. div or my-cpt or lib.myCpt
        // identifier is used for references and component/decorators names (which area also references)
        // they cannot start with $ on the contrary to JS identifiers
        let charCodes: number[] = [];
        // first char cannot be a number
        if (ccIsChar() || cc === CHAR_UNDER) {
            let lastWasDot = false;
            charCodes.push(cc);
            moveNext();
            while (ccIsChar() || ccIsNumber() || cc === CHAR_UNDER
                || (acceptDashes && cc === CHAR_MINUS) || (!acceptDashes && cc === CHAR_DOT)) {
                lastWasDot = cc === CHAR_DOT;
                charCodes.push(cc);
                moveNext();
            }
            if (lastWasDot) {
                error("Invalid " + desc);
            }
        } else if (mandatory) {
            error("Invalid character " + charName(cc));
        }
        if (charCodes.length === 0) return "";
        return String.fromCharCode.apply(null, charCodes);
    }

    function xjsExpression(): XjsExpression {
        // e.g. {exp(123) + 42} if isContentMode === true
        ec.push("expression");
        let oneTime = false, isBinding = false, isFunction = false;
        eat(CHAR_CS); // {
        if (cc === CHAR_COLON) { // :
            eatWord("::");
            oneTime = true;
        } else if (cc === CHAR_EQ) {
            cc = moveNext();
            if (cc === CHAR_GT) {
                // e.g. {=>doSomething()}
                moveNext();
                isFunction = true;
            } else {
                // e.g. {=a.b.c}
                isBinding = true;
            }
        }
        const p = pos;
        const e = createExpression(jsExpression(false), p);
        e.oneTime = oneTime;
        e.isBinding = isBinding;
        const c = e.code;
        if (isFunction) {
            e.code = "()=>" + e.code; // function expression shortcut
        }
        if (isContentMode) {
            let rp = getRefPath(e.code);
            if (rp === U) {
                error("Invalid $content reference '" + e.code + "'", e.pos);
            } else {
                e.refPath = rp;
            }
        }
        eat(CHAR_CE); // }
        ec.pop();
        return e;
    }

    function xjsJsStatement(parent: XjsContentHost): boolean {
        // return true if a statement has been found
        if (!isJsStatement()) return false;
        ec.push("js statement");
        const start = nextChars(3), startPos = pos;
        let e: string;
        switch (start) {
            case "$ex":
                // e.g. $exec someExpression("abc") + foo.getNbr({x:123});
                e = xjsJsSimpleStatementExpr("$exec");
                addContent(createJsStatement(e + ";", "$exec", startPos), parent);
                break;
            case "$le":
                // e.g. $let foo='bar', baz={a:"AA", b:42};
                e = xjsJsSimpleStatementExpr("$let");
                addContent(createJsStatement("let " + e + ";", "$let", startPos), parent);
                break;
            case "$lo":
                // e.g. $log(abc, "some info", 123);
                ec.push("$log statement");
                let logStatement = createJsStatement("log", "$log", startPos);
                if (isContentMode) {
                    eatWord("$log");
                    xjsSpaces();
                    eat(CHAR_PARS);
                    ec.push("$log argument");
                    let args: string[] = [];
                    while (true) {
                        xjsSpaces();
                        let v = xjsParamValue(false, true);
                        args.push("" + v);
                        addArg("" + v, logStatement);
                        xjsSpaces();
                        if (cc === CHAR_COMMA) {
                            moveNext();
                        } else {
                            break;
                        }
                    }
                    eat(CHAR_PARE);
                    xjsSpaces();
                    ec.pop();
                    logStatement.code = "log(" + args.join(", ") + ");"
                } else {
                    e = xjsJsParenStatementExpr("$log");
                    logStatement.code = "log" + e + ";"
                }
                eat(CHAR_S_COLON);
                addContent(logStatement, parent);
                ec.pop();
                break;
            case "$if":
                // e.g. $if (exp()) { ... } else if (exp2) { ... } else { ... }
                ec.push("$if statement");
                let jsb = createJsBlockStatement("if", "$if", startPos);
                ifBlock("$if", jsb);
                addContent(jsb, parent);
                eat(CHAR_CS); // {
                xjsContent(jsb);
                eat(CHAR_CE); // }
                while (matchNext(RX_ELSE)) {
                    xjsSpaces();
                    eatWord("else");
                    xjsSpaces(true);
                    let ps = pos;
                    if (cc as any === CHAR_i) {
                        // else if (...) {
                        jsb = createJsBlockStatement("", "$elseif", ps);
                        ifBlock("if", jsb, "else ");
                    } else {
                        // else {
                        jsb = createJsBlockStatement("else {", "$else", ps);
                    }
                    eat(CHAR_CS); // {
                    addContent(jsb, parent);
                    xjsContent(jsb);
                    eat(CHAR_CE); // }
                }
                ec.pop();
                break;
            case "$fo":
                // e.g. $for (let i=0;10>i;i++) {
                e = xjsJsParenStatementExpr("$for");
                const fb = createJsBlockStatement("for " + e + " {", "$for", startPos);
                addContent(fb, parent);
                eat(CHAR_CS); // {
                xjsContent(fb);
                eat(CHAR_CE); // }
                break;
            case "$ea":
                // e.g. $each(items, (item, index, isLast) => {
                ec.push("$each statement");
                eatWord("$each");
                const eb = createJsBlockStatement("each", "$each", startPos);
                xjsSpaces();
                eat(CHAR_PARS); // (
                xjsSpaces();
                let e1: string;

                ec.push("$each argument");
                // items part
                if (isContentMode) {
                    e1 = xjsIdentifier(true, false);
                    xjsSpaces();
                } else {
                    e1 = jsExpression(false);
                }
                addArg(e1, eb);

                // , (item, index, isLast) part
                eat(CHAR_COMMA); // ,
                xjsSpaces();
                let e2: string;
                eat(CHAR_PARS); // (
                e2 = "(";
                while (true) {
                    xjsSpaces();
                    const pv = pos, v = xjsIdentifier(true, false);
                    if (!addArg(v, eb, true)) {
                        error("Invalid function argument '" + v + "'", pv);
                    }
                    e2 += v;
                    xjsSpaces();
                    if (cc === CHAR_COLON) {
                        // type part
                        moveNext(); // :
                        xjsSpaces();
                        jsExpression(false, U, U, true); // ignore it
                        xjsSpaces();
                    }
                    if (cc === CHAR_COMMA) {
                        moveNext();
                        e2 += ",";
                    } else {
                        break;
                    }
                }
                eat(CHAR_PARE); // )
                e2 += ")";
                ec.pop();
                eb.startCode = "each(" + e1 + "," + e2 + " => {";
                eb.endCode = "});";

                // function end
                xjsSpaces();
                eatWord("=>");
                xjsSpaces();
                addContent(eb, parent);
                eat(CHAR_CS); // {
                xjsContent(eb);
                eat(CHAR_CE); // }
                xjsSpaces();
                eat(CHAR_PARE); // )
                xjsSpaces();
                eat(CHAR_S_COLON); // ;
                ec.pop();
                break;
            case "$te":
                // $template function
                xjsTplFunction(parent, false);
                break;
            default:
                error("Invalid JS statement", pos);
        }
        ec.pop();
        return true;

        function ifBlock(name: string, jsb: XjsJsBlock, prefix = "") {
            if (isContentMode) {
                eatWord(name);
                xjsSpaces();
                eat(CHAR_PARS);
                xjsSpaces();
                e = xjsIdentifier(true, false);
                xjsSpaces();
                eat(CHAR_PARE);
                xjsSpaces();
                jsb.startCode = prefix + "if (" + e + ") {";
                addArg(e, jsb);
            } else {
                e = xjsJsParenStatementExpr(name);
                jsb.startCode = prefix + "if " + e + " {";
            }
        }
    }

    function xjsJsSimpleStatementExpr(name: string): string {
        ec.push(name + " statement");
        eatWord(name);
        xjsSpaces(true);
        const e = jsExpression(false, U, U, false, true);
        eat(CHAR_S_COLON);
        ec.pop();
        return e;
    }

    function xjsJsParenStatementExpr(name: string): string {
        ec.push(name + " statement");
        eatWord(name);
        xjsSpaces();
        if (cc as any !== CHAR_PARS) {
            error("Invalid " + name + " statement", pos);
        }
        const e = jsExpression(false, CHAR_PARS, CHAR_PARE);
        xjsSpaces();
        ec.pop();
        return e;
    }

    function jsIdentifier(): string | undefined {
        // e.g. someName or $foo 
        // return undefined if no js identifier is found on cc
        // [$_a-zA-Z][_a-zA-Z0-9]*
        if (ccIsChar() || cc === CHAR_$ || cc === CHAR__) {
            const charCodes: number[] = [cc];
            moveNext();
            while (ccIsChar() || cc === CHAR_$ || cc === CHAR__ || ccIsNumber()) {
                charCodes.push(cc);
                moveNext();
            }
            return String.fromCharCode.apply(null, charCodes);
        }
        return U;
    }

    function jsExpression(canBeEmpty?: boolean, startChar?: number, endChar?: number, isType: boolean = false, isStatement = false): string {
        // e.g. exp(123) + 42 if isContentMode === true
        // return the js expression
        // startChar and endChar must be passed together (or none)
        let charCodes: number[] = [], buf: string = ""; // temp buffer
        if (startChar !== U) {
            eat(startChar);
            charCodes.push(startChar);
        }

        while (!isEnd()) {
            if (eatComments()) {
                continue;
            } else if (cc === CHAR_DQ || cc === CHAR_SQ) { // " or '
                pushString(stringContent(cc));
            } else if (cc === CHAR_CS) { // {
                pushString(jsExpression(true, CHAR_CS, CHAR_CE, isType)); // { and }
            } else if (cc === CHAR_SBRS) { // [
                pushString(jsExpression(true, CHAR_SBRS, CHAR_SBRE, isType)); // [ and ]
            } else if (cc === CHAR_PARS) { // (
                pushString(jsExpression(true, CHAR_PARS, CHAR_PARE, isType)); // ( and )
            } else if (isType && cc === CHAR_LT) { // <
                pushString(jsExpression(true, CHAR_LT, CHAR_GT, true)); // < and >
            } else {
                charCodes.push(cc);
                moveNext();
            }
        }
        pushString("");
        buf = buf.trim();
        if (buf === "" || (startChar !== U && buf.length <= 2)) {
            if (canBeEmpty === false) {
                const p = (startChar === U) ? pos : pos - 1;
                if (isType) {
                    error("type definition cannot be empty", p);
                } else {
                    error("expression cannot be empty", p);
                }
            }
        }
        return buf;

        function pushString(s: string) {
            buf += String.fromCharCode.apply(null, charCodes) + s;
            charCodes = [];
        }

        function isEnd() {
            if (endChar !== U) {
                if (cc === endChar) {
                    charCodes.push(cc);
                    moveNext();
                    return true;
                }
            } else {
                if (isStatement) {
                    // end on ;
                    if (cc === CHAR_S_COLON) return true;
                } else {
                    // normal end chars: , or ; or } or ) -> will not be eaten
                    if (cc === CHAR_S_COLON || cc === CHAR_CE || cc === CHAR_COMMA || cc === CHAR_PARE || (isType && cc === CHAR_EQ)) return true;
                }
            }
            return (cc === CHAR_EOS);
        }
    }

    function getRefPath(exp: string): string[] | undefined {
        // parses an expression that is supposed to be a reference path (e.g. a.b.c)
        // return null if exp is not a valid path
        if (exp === "" || !exp.match(RX_REF_PATH)) return U;
        return exp.split(".");
    }


    function setupPreProcessors(ppList: XjsPreProcessorNode[] | null) {
        if (ppList === null) return;
        const len = ppList.length;
        for (let i = len - 1; i > -1; i--) {
            const ppn = ppList[i];
            let pp: XjsPreProcessor;
            if (!ppn.instance) {
                const nm = ppn.ref.code;
                // create the pp instance
                if (ppFactories === U || ppFactories[nm] === U) {
                    error("Undefined pre-processor '" + nm + "'", ppn.pos);
                    return;
                }
                pp = ppn.instance = ppFactories[nm]() as any;
            } else {
                pp = ppn.instance;
            }

            let ppParams: XjsParamDictionary = {};
            if (ppn.params) {
                for (let p of ppn.params) {
                    ppParams[(p as XjsParam).name] = p as XjsParam;
                }
            }
            ppn.paramsDict = ppParams;

            if (pp["setup"] !== U) {
                try {
                    pp.setup!(ppn.parent, ppn.paramsDict, getPreProcessorContext(ppn.ref.code, ppn.grandParent, ppn.pos));
                } catch (ex) {
                    let msg = ex.message || ex;
                    if (msg.match(/^XJS\:/)) {
                        // error was triggered through context.error()
                        throw ex;
                    } else {
                        error("Error in " + ppn.ref.code + ".setup(): " + msg, ppn.pos);
                    }
                }
            }
        }
        // register the pre processors in the definition order (will be reversed when called for process())
        for (let ppn of ppList) {
            if (preProcessorNodes === U) {
                preProcessorNodes = [ppn];
            } else {
                preProcessorNodes.push(ppn);
            }
        }
    }

    async function processPreProcessors(ppList: XjsPreProcessorNode[]) {
        const len = ppList.length;
        for (let i = len - 1; i > -1; i--) {
            const ppn = ppList[i], pp: XjsPreProcessor = ppn.instance!;

            if (pp["process"] !== U) {
                try {
                    await pp.process!(ppn.parent, ppn.paramsDict, getPreProcessorContext(ppn.ref.code, ppn.grandParent, ppn.pos));
                    dispose(ppn);
                } catch (ex) {
                    let msg = ex.message || ex;
                    dispose(ppn);
                    if (msg.match(/^XJS\:/)) {
                        // error was triggered through context.error()
                        throw ex;
                    } else {
                        error("Error in " + ppn.ref.code + ".process(): " + msg, ppn.pos);
                    }
                }
            }


        }
        function dispose(n: any) {
            n.parent = n.grandParent = n.params = n.instance = n.paramsDict = U;
        }
    }

    function getPreProcessorContext(ppName: string, parent: XjsContentHost | null, processorPos: number) {
        currentPpName = ppName;
        currentPpPos = processorPos;
        if (ppContext === U) {
            ppContext = {
                parent: parent,
                fileId: context ? context.fileId || "" : "",
                rootFragment: root,
                error: function (msg: string, pos = -1) {
                    error(currentPpName + ": " + msg, pos > -1 ? pos : currentPpPos);
                },
                preProcessors: ppFactories
            }
        } else {
            ppContext.parent = parent;
        }
        return ppContext;
    }
};

// ########################################################################################################################
// AST helpers

function createTplFunction(pos: number = -1): XjsTplFunction {
    return {
        kind: "#tplFunction",
        pos: pos,
        indent: ""
    }
}

function addArgument(tf: XjsTplFunction, name: string, pos: number = -1): XjsTplArgument {
    const arg: XjsTplArgument = {
        kind: "#tplArgument",
        name: name,
        pos: pos
    };
    if (!tf.arguments) {
        tf.arguments = [arg];
    } else {
        tf.arguments.push(arg);
    }
    return arg;
}

function addArg(arg: string, jss: XjsJsStatement | XjsJsBlock, singleWord = false): boolean {
    // add parsed argument (should be used in $content mode only)
    if (!jss.args) {
        jss.args = [];
    }
    if (arg.match(RX_REF_PATH)) {
        const arr = arg.split(".");
        if (singleWord) {
            if (arr.length !== 1) return false;
            jss.args.push(arg);
        } else {
            jss.args.push(arr);
        }
    } else {
        jss.args.push(singleWord ? arg : [arg]);
    }
    return true;
}

export function createFragment(pos: number = -1): XjsFragment {
    return {
        kind: "#fragment",
        pos: pos
    }
}

export function createElement(name: string, pos: number = -1): XjsElement {
    return {
        kind: "#element",
        name: name,
        pos: pos
    }
}

export function addContent(child: XjsContentNode, parent: XjsContentHost) {
    // add a content child to a parent node
    if (!parent.content) {
        parent.content = [child];
    } else {
        parent.content.push(child);
    }
    return child;
}

export function addParam(p: XjsNodeParam, host: XjsParamHost): XjsNodeParam {
    if (!host.params) {
        host.params = [p];
    } else {
        host.params.push(p);
    }
    if (host.kind === "#decorator" || host.kind === "#preprocessor") {
        host.isOrphan = false;
    }
    return p;
}

export function createComponent(ref: XjsExpression, pos: number = -1): XjsComponent {
    return {
        kind: "#component",
        ref: ref,
        pos: pos
    }
}

export function createParamNode(name: string, pos: number = -1): XjsParamNode {
    return {
        kind: "#paramNode",
        name: name,
        pos: pos
    }
}

export function createDecoNode(ref: XjsExpression, pos: number = -1): XjsDecoratorNode {
    return {
        kind: "#decoratorNode",
        ref: ref,
        pos: pos
    }
}

export function createText(textFragments: string[], pos: number = -1): XjsText {
    return {
        kind: "#textNode",
        pos: pos,
        textFragments: textFragments
    }
}

export function createExpression(code: string, pos: number = -1): XjsExpression {
    return {
        kind: "#expression",
        oneTime: false,
        isBinding: false,
        code: code,
        pos: pos
    }
}

export function createParam(name: string, value?: any, isOrphan = false, pos: number = -1): XjsParam {
    return {
        kind: "#param",
        name: name,
        isOrphan: isOrphan,
        pos: pos,
        value: value
    }
}

export function createProperty(name: string, value: XjsParamValue, pos: number = -1): XjsProperty {
    return {
        kind: "#property",
        name: name,
        value: value,
        pos: pos
    }
}

export function createDecorator(ref: XjsExpression, pos: number = -1): XjsDecorator {
    return {
        kind: "#decorator",
        pos: pos,
        ref: ref,
        hasDefaultPropValue: false,
        isOrphan: false
    }
}

export function createCData(pos: number = -1): XjsCData {
    return {
        kind: "#cdata",
        pos: pos,
        text: ""
    }
}

export function createLabel(name: string, pos: number = -1): XjsLabel {
    return {
        kind: "#label",
        pos: pos,
        name: name,
        fwdLabel: false,
        isOrphan: false
    }
}

export function createJsStatement(code: string, name: string, pos: number = -1): XjsJsStatement {
    return {
        kind: "#jsStatement",
        name: name,
        code: code,
        pos: pos
    }
}

export function createJsBlockStatement(startCode: string, name: string, pos: number = -1): XjsJsBlock {
    return {
        kind: "#jsBlock",
        name: name,
        startCode: startCode,
        endCode: "}",
        pos: pos
    }
}

// ########################################################################################################################
// Serialization

export function toString(root: XjsFragment | XjsTplFunction, baseIndent = "    ") {
    const buf: string[] = [];
    serializeContentHost(root, buf, baseIndent);
    return buf.join("");
}

const DECO_NODES = "$$decoNodes"; // hidden property to transfer deco nodes to content

function serializeContentHost(nd: XjsContentHost, buf: string[], indent: string) {
    const k = nd.kind,
        hasContent = nd.content !== U,
        lnIndent = indent !== "" ? "\n" + indent : "";
    // start
    if (k === "#tplFunction") {
        const f = nd as XjsTplFunction, arrowFn = (f.name === U)
        if (arrowFn) {
            buf.push(`${lnIndent}(`);
        } else {
            buf.push(`${lnIndent}$template ${f.name!} (`);
        }
        if (f.arguments !== U) {
            let len = f.arguments.length;
            for (let i = 0; len > i; i++) {
                let arg = f.arguments[i];
                if (i > 0) {
                    buf.push(", ");
                }
                buf.push(arg.name);
                if (arg.optional) {
                    buf.push("?");
                }
                if (arg.typeRef !== U) {
                    buf.push(":" + arg.typeRef);
                }
                if (arg.defaultValue !== U) {
                    buf.push(" = " + arg.defaultValue);
                }
            }
        }
        if (arrowFn) {
            buf.push(`) => {`);
        } else {
            buf.push(`) {`);
        }
    } else if (k === "#jsBlock") {
        const name = (nd as XjsJsBlock).name, prefix = (name === "$else" || name === "$elseif") ? " " : lnIndent + "$";
        buf.push(`${prefix}${(nd as XjsJsBlock).startCode}`);
        if (!hasContent) {
            buf.push(`${(nd as XjsJsBlock).endCode}`);
        }
    } else {
        let prefix = "", name = "";
        if (k === "#component") {
            prefix = "*";
            name = serializeExpr((nd as XjsComponent).ref, false);
        } else if (k === "#decoratorNode") {
            prefix = "@";
            name = serializeExpr((nd as XjsDecoratorNode).ref, false);
        } else if (k === "#fragment") {
            prefix = "!";
        } else if (k === "#paramNode") {
            prefix = ".";
            name = (nd as XjsParamNode).name;
        } else {
            name = (nd as XjsElement).name;
        }
        buf.push(`${lnIndent}<${prefix}${name}`);
        serializeParams(nd as XjsParamHost, buf);
        buf.push(hasContent ? ">" : "/>");
    }
    // content
    if (hasContent) {
        const newIndent = indent === "" ? "" : indent + "    ";
        const h = nd as any;
        if (h[DECO_NODES] !== U) for (let c of h[DECO_NODES]) {
            serializeContentNode(c, buf, newIndent);
        }
        for (let c of nd.content!) {
            serializeContentNode(c, buf, newIndent);
        }
        // end
        if (k === "#tplFunction") {
            buf.push(`${lnIndent}}`);
        } else if (k === "#jsBlock") {
            buf.push(`${lnIndent}${(nd as XjsJsBlock).endCode}`);
        } else {
            buf.push(`${lnIndent}</>`);
        }
    }
}

function serializeContentNode(nd: XjsContentNode, buf: string[], indent: string) {
    const k = nd.kind,
        lnIndent = indent !== "" ? "\n" + indent : "";
    if (k === "#textNode") {
        const t = nd as XjsText, hasExpressions = t.expressions !== U, len = t.textFragments.length;
        buf.push(lnIndent);
        for (let i = 0; len > i; i++) {
            buf.push(t.textFragments[i]);
            if (hasExpressions && t.expressions![i] !== U) {
                buf.push(serializeExpr(t.expressions![i]));
            }
        }
    } else if (k === "#cdata") {
        buf.push(lnIndent + "<!cdata");
        serializeParams(nd as XjsParamHost, buf);
        buf.push(">" + (nd as XjsCData).text + "</!cdata>");
    } else if (k === "#jsStatement") {
        let prefix = (nd as XjsJsStatement).name === "$exec" ? "$exec " : "$";
        buf.push(lnIndent + prefix + (nd as XjsJsStatement).code);
    } else {
        serializeContentHost(nd as XjsContentHost, buf, indent);
    }
}

function serializeExpr(e: XjsExpression, brackets = true) {
    const r = `${e.oneTime ? "::" : ""}${e.isBinding ? "=" : ""}${e.code}`;
    return brackets ? "{" + r + "}" : r;
}

function serializeParams(host: XjsParamHost, buf: string[]) {
    if (host.params === U) return;
    for (let p of host.params) {
        let k = p.kind;
        if (k === "#decoratorNode") {
            const h = host as any;
            if (h[DECO_NODES] === U) {
                h[DECO_NODES] = [];
            }
            h[DECO_NODES].push(p);
        } else {
            buf.push(" ");
            if (k === "#decorator" || k === "#preprocessor") {
                if (k === "#preprocessor") {
                    buf.push("@");
                }
                let d = p as XjsDecorator;
                buf.push("@" + serializeExpr(d.ref, false));
                if (!d.isOrphan) {
                    if (d.hasDefaultPropValue) {
                        serializeParamValue(d.defaultPropValue, buf);
                    } else {
                        buf.push("(");
                        serializeParams(d, buf);
                        buf.push(")");
                    }
                }
            } else if (k === "#label") {
                let lbl = p as XjsLabel;
                if (lbl.fwdLabel) {
                    buf.push("#");
                }
                buf.push("#" + lbl.name);
                if (!lbl.isOrphan) {
                    serializeParamValue(lbl.value, buf);
                }
            } else if (k === "#param") {
                buf.push((p as XjsParam).name);
                if (!(p as XjsParam).isOrphan) {
                    serializeParamValue((p as XjsParam).value, buf);
                }
            } else if (k === "#property") {
                buf.push("[" + (p as XjsProperty).name + "]");
                serializeParamValue((p as XjsProperty).value, buf);
            }
        }
    }
}
function serializeParamValue(v: XjsParamValue | undefined, buf: string[]) {
    if (v !== U) {
        let tp = typeof v;
        if (tp === 'string') {
            buf.push("='" + encodeText("" + v) + "'");
        } else if (tp === "object") {
            buf.push("=" + serializeExpr(v as any));
        } else if (tp === "number" || tp === "boolean") {
            buf.push("=" + v);
        }
    }
}

function encodeText(t: string) {
    return t.replace(/\'/g, "\\'")
}
