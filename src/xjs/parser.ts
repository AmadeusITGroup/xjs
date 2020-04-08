import { XjsTplFunction, XjsContentHost, XjsContentNode, XjsText, XjsFragment, XjsTplArgument, XjsElement, XjsParamNode, XjsComponent, XjsDecoratorNode, XjsExpression, XjsParamValue, XjsParam, XjsProperty, XjsDecorator, XjsLabel, XjsParamHost, XjsNodeParam, XjsPreProcessorNode, XjsJsStatement, XjsJsBlock, XjsCData } from './types';

const U = undefined,
    RX_START_INDENT = /^[ \f\r\t\v]*\n(\s*)/,
    RX_ELSE = /\s*else/,
    CDATA = "cdata",
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
    CHAR_n = 110,
    CHAR_t = 116,
    CHAR_r = 114,
    CHAR_u = 117,
    CHAR_e = 101,
    CHAR_f = 102,
    CHAR_a = 97,
    CHAR_l = 108,
    CHAR_s = 115,
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
    globalPreProcessors?: string[]; // e.g. ["@@json"]
}

/**
 * Parse a template string and return an AST tree
 * @param tpl the template string
 */
export async function parse(xjs: string, context?: XjsParserContext): Promise<XjsTplFunction | XjsFragment> {
    const isContentMode = false;
    let root: XjsTplFunction | XjsFragment,
        posEOS = xjs.length,
        pos = 0,    // current position
        cc: number = CHAR_EOS,   // current char code at current position
        pcc: number = CHAR_BOS;  // previous cc
    // ppContext: XtrPreProcessorCtxt | undefined,
    // currentPpName = "",
    // currentPpPos = 0,
    // globalPreProcessors = context ? context.globalPreProcessors : U,
    // ppFactories = context ? context.preProcessors || {} : {},
    // preProcessors = {}; // dictionary of pre-processor instances
    if (posEOS > 0) {
        cc = xjs.charCodeAt(0);

        // let ppDataList: XtrPreProcessorData[] | undefined;

        // if (globalPreProcessors !== U) {
        //     ppDataList = [];
        //     for (let pp of globalPreProcessors) {
        //         ppDataList.push({
        //             kind: "#preprocessorData",
        //             name: pp, // e.g. "@@json"
        //             pos: 0
        //         })
        //     }
        //     await callPreProcessors(ppDataList, xf, null, "setup", 1);
        // }
    }
    root = xjsRoot();
    if (posEOS > 0) {
        // if (ppDataList !== U) {
        //     await callPreProcessors(ppDataList, xf, null, "process", 2);
        // }

        if (cc !== CHAR_EOS) {
            error();
        }
    }
    return root;

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
        return pos + length < posEOS ? xjs.substr(pos, length) : "";
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
        const len = w.length;
        for (let i = 0; len > i; i++) {
            eat(w.charCodeAt(i));
        }
        return cc;
    }

    function charName(c: number) {
        if (c === CHAR_EOS) return "End of Content";
        return "'" + String.fromCharCode(c) + "'";
    }

    function stringContent(delimiter: number): string {
        let charCodes: number[] = [delimiter];
        eat(delimiter);
        while (cc !== delimiter && cc !== CHAR_EOS) {
            if (cc === CHAR_BSLA) { // \
                moveNext();
            }
            charCodes.push(cc);
            moveNext();
        }
        eat(delimiter);
        charCodes.push(delimiter);
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
            eat(CHAR_FSLA);
            eat(CHAR_FSLA);
            while (CHAR_NL !== cc as any && CHAR_EOS !== cc as any) {
                moveNext();
            }
            moveNext(); // to eat last new line
            return true;
        } else if (nc === CHAR_STAR) {
            eat(CHAR_FSLA);
            eat(CHAR_STAR);
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

    function addContent(child: XjsContentNode, parent: XjsContentHost) {
        // add a content child to a parent node
        if (!parent.content) {
            parent.content = [child];
        } else {
            parent.content.push(child);
        }
        return child;
    }

    function addParam(p: XjsNodeParam, host: XjsParamHost): XjsNodeParam {
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

    function error(msg?: string, errorPos?: number) {
        console.log("XJS ERROR", msg);
        throw msg;
        // let lines = xtr.split("\n"), lineLen = 0, posCount = 0, idx = 0, lineNbr = lines.length, columnNbr = lines[lineNbr - 1].length;
        // errorPos = errorPos || pos;
        // if (errorPos > -1) {
        //     while (idx < lines.length) {
        //         lineLen = lines[idx].length;
        //         if (posCount + lineLen < errorPos) {
        //             // continue
        //             idx++;
        //             posCount += lineLen + 1; // +1 for carriage return
        //         } else {
        //             // stop
        //             lineNbr = idx + 1;
        //             columnNbr = 1 + errorPos - posCount;
        //             break;
        //         }
        //     }
        // }

        // let fileInfo = "";
        // if (context !== U && context.fileId !== U) {
        //     fileInfo = `\nFile: ${context.fileId}`;
        // }
        // let lineNbrMsg = lineNbr;
        // if (context) {
        //     lineNbrMsg += context.line1 !== undefined ? context.line1 - 1 : 0;
        //     if (lineNbr === 1) {
        //         columnNbr += context.col1 !== undefined ? context.col1 - 1 : 0;
        //     }
        // }

        // if (msg === U) {
        //     msg = "Invalid character: " + charName(cc);
        // }
        // throw "XTR: " + msg + "\nLine " + lineNbrMsg + " / Col " + columnNbr + fileInfo + "\nExtract: >> " + lines[lineNbr - 1].trim() + " <<";
    }

    // ########################################################################################################################
    // parser functions

    function xjsRoot(): XjsTplFunction | XjsFragment {
        const f = createFragment(pos);

        if (isContentMode) {
            // $content template
            xjsContent(f);
            return f;
        } else {
            // $template template
            const p = pos;
            if (!xjsTplFunction(f)) {
                error("Invalid $template function parameters", p);
            }
            return f.content![0]! as XjsTplFunction;
        }
    }

    function xjsSpaces(required = false): boolean {
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

        return p1 !== pos;
    }

    function xjsTplFunction(parent: XjsContentHost, root = true): boolean {
        // e.g. (arg:Type, arg2) => { ... }  -> root === true
        // or   $template foo(arg) { ... }   -> root === false
        // return true if a tpl function is found
        if ((root && cc !== CHAR_PARS) || (!root && cc !== CHAR_$)) return false; // ( or $
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
        eat(CHAR_PARS); // (
        let keepGoing = true, jsId: string | undefined, p1: number;
        while (keepGoing) {
            xjsSpaces();
            p1 = pos;
            jsId = jsIdentifier();
            if (jsId !== U) {
                let arg = addArgument(tf, jsId, pos);
                xjsSpaces();
                if (cc === CHAR_QM) { // ? -> optional arg
                    arg.optional = true;
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
            }
            xjsSpaces();
            if (cc !== CHAR_COMMA) {
                keepGoing = false;
            } else {
                cc = moveNext();
            }
        }
        eat(CHAR_PARE); // )

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
        xjsContent(tf); // content
        eat(CHAR_CE);   // }
        return true;
    }

    function xjsContent(parent: XjsContentHost) {
        // parse xjs content: text or element or fragments or cdata
        let keepGoing = true;
        while (keepGoing) {
            if (!xjsElement(parent) && !xjsJsStatement(parent) && !xjsText(parent)) {
                keepGoing = false;
            }
        }
    }

    function xjsText(parent: XjsContentHost): boolean {
        // return true if blank spaces or text characters have been found
        if ((cc === CHAR_LT && pcc !== CHAR_BANG) || cc === CHAR_EOS || cc === CHAR_CE || (cc === CHAR_$ && pcc !== CHAR_BANG)) return false;
        let spacesFound = xjsSpaces(), startPos = pos;
        if (cc !== CHAR_LT && cc !== CHAR_EOS && cc !== CHAR_$) {
            const tn = createText([], startPos);
            let charCodes: number[] = [];
            if (spacesFound) {
                charCodes[0] = CHAR_SPACE; // leading spaces are transformed in a single space
            }
            let lastIsSpace = spacesFound;
            while (cc !== CHAR_LT && cc !== CHAR_EOS && cc !== CHAR_CE && cc !== CHAR_$) {
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
                            moveNext();
                        } else {
                            lastIsSpace = false;
                            moveNext();
                            charCodes.push(escValue);
                            pcc = newPcc;
                        }
                    } else {
                        charCodes.push(CHAR_BANG);
                        lastIsSpace = false;
                    }
                } else if (cc === CHAR_CS) { // { -> expression
                    pushExpression(xjsExpression());
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

            pushExpression(null);
            if (tn.expressions === U && tn.textFragments.length === 1 && tn.textFragments[0] === " ") {
                // ignore space text node unless spaces were explicitly requested
                return false;
            }
            addContent(tn, parent);

            function pushExpression(e: XjsExpression | null) {
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
        return true;
    }

    function xjsElement(parent: XjsContentHost): boolean {
        // return true if an element, a fragment or a cdata section has been found
        if (cc !== CHAR_LT || nextCharCode() === CHAR_FSLA) return false;
        cc = eat(CHAR_LT); // <
        // prefix: [none] or * or . or @ (! is treated separately)
        let prefix = 0, posRef = -1;
        eatPrefix();
        let name = "", node: XjsContentHost;
        if (cc === CHAR_BANG) {
            eat(CHAR_BANG);
            if (xjsCData(parent)) {
                return true;
            }
            node = createFragment(pos);
            addContent(node, parent);
        } else {
            posRef = pos;
            name = xjsIdentifier(true, prefix === 0);
            node = createNode();
        }

        // let ppDataList: XtrPreProcessorData[] | null = null;

        if (xjsSpaces()) {
            // spaces have been found: parse params
            const ppNodes = xjsParams(node as XjsParamHost, parent as XjsParamHost, endParamReached);
            // if (ppDataList !== null) {
            //     await callPreProcessors(ppDataList, eltOrFragment, parent, "setup", 3);
            // }
        }
        if (cc === CHAR_FSLA) {
            // end of element
            eat(CHAR_FSLA); // /
            eat(CHAR_GT); // >
        } else if (cc === CHAR_GT) {
            eat(CHAR_GT); // >
            // parse element content
            xjsContent(node);
            // parse end of element
            eat(CHAR_LT); // <
            eat(CHAR_FSLA); // /
            let endPos = pos;
            let p1 = prefix, p2 = eatPrefix(), name2 = xjsIdentifier(false);
            if (name2 === "" && p2 === 0 && CHAR_BANG === cc as any) {
                eat(CHAR_BANG); // end of fragment !
            } else if (name2 !== "" || p2 !== 0) {
                // end tag name is provided
                if (p1 !== p2 || (name2 !== "" && name2 !== name)) {
                    error('End tag </' + eltName(p2, name2) + '> doesn\'t match <' + eltName(p1, name) + '>', endPos);
                }
            }
            xjsSpaces();
            eat(CHAR_GT); // >
        } else {
            error("Unexpected parameter character: " + charName(cc), pos);
        }

        // if (ppDataList !== null) {
        //     await callPreProcessors(ppDataList, eltOrFragment, parent, "process", 4);
        // }
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
            let ch: XjsContentHost;
            if (prefix === CHAR_STAR) { // *
                return addContent(createComponent(createExpression(name, posRef), pos), parent) as XjsContentHost;
            } else if (prefix === CHAR_DOT) { // .
                return addContent(createParamNode(name, pos), parent) as XjsContentHost;
            } else if (prefix === CHAR_AT) { // @
                // decorator node: stored as param
                return addParam(createDecoNode(createExpression(name, posRef), pos), parent as any) as any;
            }
            return addContent(createElement(name, pos), parent) as XjsContentHost;
        }

        function eltName(prefix: number, nm: string) {
            return (prefix === 0 ? "" : String.fromCharCode(prefix)) + nm;
        }
    }

    function xjsParams(parent: XjsParamHost, grandParent: XjsParamHost, endReached: () => boolean): XjsPreProcessorNode[] | null {
        let prefix = 0, keepGoing = true, result: XjsPreProcessorNode[] | null = null, startPos = -1;
        while (keepGoing && !endReached()) {
            // param name: prefix + name
            startPos = pos;
            prefix = eatPrefix();
            let ppn: XjsPreProcessorNode | null = null, isProperty = false, isFwdLabel = false, name: string;
            if (prefix === CHAR_AT && cc === CHAR_AT) {
                // this is a pre-processor
                eat(CHAR_AT); // 2nd @
                name = jsIdentifier() || "";
                const ppnPos = pos - 2; // to be before the '@@' prefix

                if (name === "") {
                    error("Invalid preprocessor reference", ppnPos);
                } else if (parent.kind === "#preprocessor") {
                    error("Pre-processors cannot be used on pre-processors: check @@" + name, ppnPos);
                }

                ppn = {
                    kind: "#preprocessor",
                    ref: createExpression("@@" + name, pos),
                    pos: ppnPos,
                    hasDefaultPropValue: false,
                    isOrphan: false,
                    parent: parent,
                    grandParent: grandParent
                }
                if (result === null) {
                    result = [];
                }
                result.push(ppn);
            } else if (prefix === 0 && cc === CHAR_CS) {
                // binding shortcut {type} or {::type} or {::[type]}
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
                continue
            } else {
                if (prefix === CHAR_HASH && cc === CHAR_HASH) {
                    eat(CHAR_HASH);
                    isFwdLabel = true;
                }
                name = xjsIdentifier(true, prefix === 0);
                if (prefix === CHAR_SBRS) { // [
                    eat(CHAR_SBRE); // ]
                    isProperty = true;
                } else if (prefix === CHAR_HASH && parent.kind === "#preprocessor") {
                    error("Labels cannot be used on pre-processors", parent.pos);
                }
            }

            let spacesFound = xjsSpaces();
            if (cc === CHAR_EQ) {
                // look for value
                eat(CHAR_EQ);
                xjsSpaces();
                if (ppn !== null) {
                    registerParam("value", ppn, xjsParamValue(), false, isFwdLabel);
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

                let r = xjsParams(d, parent, endDecoParamReached);
                eat(CHAR_PARE); // ) parens end

                if (!xjsSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
                // if (r != null && ppData === null) {
                //     await callPreProcessors(r, d, grandParent as any, "process", 7);
                // }
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
        }
        if (!endReached()) {
            error();
        }

        return result;

        function endDecoParamReached() {
            return (cc === CHAR_PARE); // )
        }

        function registerParam(name: string, p: XjsParamHost, value?: any, isProperty: boolean = false, isFwdLabel = false): XjsNodeParam {
            // create the param node and add it to the params collection
            let param: XjsNodeParam;
            if (prefix === CHAR_AT) {
                // decorator param
                param = createDecorator(createExpression(name, startPos), startPos);
                if (value !== U) {
                    param.hasDefaultPropValue = true;
                    param.defaultPropValue = value;
                } else {
                    param.isOrphan = true;
                }
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
                param = createParam(name, startPos);
                param.value = value;
                param.isOrphan = value === U;
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

    function xjsParamValue(): XjsParamValue {
        const p = pos;
        // return the param value
        if (cc === CHAR_SQ) {
            return stringContent(CHAR_SQ); // single quote string
        } else if (cc === CHAR_DQ) {
            return stringContent(CHAR_DQ); // double quote string
        } else if (cc === CHAR_CS) { // {
            return xjsExpression();
        } else if (cc === CHAR_t) {
            // true
            eat(CHAR_t); eat(CHAR_r); eat(CHAR_u); eat(CHAR_e);
            return true;
        } else if (cc === CHAR_f) {
            // false
            eat(CHAR_f); eat(CHAR_a); eat(CHAR_l); eat(CHAR_s); eat(CHAR_e);
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
        }
        error("Invalid parameter value: " + charName(cc), p);
        return 0;
    }

    function endParamReached() {
        return (cc === CHAR_FSLA || cc === CHAR_GT); // / or >
    }

    function xjsCData(parent: XjsContentHost): boolean {
        if (CDATA === nextChars(CDATA_LENGTH)) {
            let startPos = pos;
            eatWord(CDATA);
            let cdata = createCData(pos), ppNodes: XjsPreProcessorNode[] | null = null;
            addContent(cdata, parent);
            if (xjsSpaces()) {
                // spaces have been found: parse params
                ppNodes = xjsParams(cdata, parent as XjsParamHost, endParamReached);
                // if (ppNodes !== null) {
                //     callPreProcessors(ppNodes, cdata, parent, "setup", 5);
                // }
            }
            eat(CHAR_GT); // >

            let charCodes: number[] = [], processing = true;

            while (processing) {
                if (cc === CHAR_EOS) {
                    processing = false;
                    error("Invalid cdata section: end marker '</!cdata>' not found", startPos - 2)
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

            // if (ppNodes !== null) {
            //     callPreProcessors(ppNodes, cdata, parent, "process", 6);
            // }
            return true;
        }
        return false;
    }

    function xjsIdentifier(mandatory: boolean, acceptDashes = false): string {
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
                error("Invalid XJS identifier");
            }
        } else if (mandatory) {
            error("Invalid XJS identifier");
        }
        if (charCodes.length === 0) return "";
        return String.fromCharCode.apply(null, charCodes);
    }

    function xjsExpression(): XjsExpression {
        // e.g. {exp(123) + 42} if isContentMode === true
        let oneTime = false, isBinding = false, isFunction = false;;
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
        const e = createExpression(jsExpression(false), pos);
        e.oneTime = oneTime;
        e.isBinding = isBinding;
        const c = e.code;
        if (isFunction) {
            e.code = "()=>" + e.code; // function expression shortcut
        }
        eat(CHAR_CE); // }
        return e;
    }

    function xjsJsStatement(parent: XjsContentHost): boolean {
        // return true if a statement has been found
        if (cc !== CHAR_$) return false;
        const start = nextChars(3), startPos = pos;
        let e: string;
        switch (start) {
            case "$ex":
                // e.g. $exec someExpression("abc") + foo.getNbr({x:123});
                e = xjsJsSimpleStatementExpr("$exec");
                addContent(createJsStatement(e + ";", startPos), parent);
                break;
            case "$le":
                // e.g. $let foo='bar', baz={a:"AA", b:42};
                e = xjsJsSimpleStatementExpr("$let");
                addContent(createJsStatement("let " + e + ";", startPos), parent);
                break;
            case "$lo":
                // e.g. $log(abc, "some info", 123);
                e = xjsJsParenStatementExpr("$log");
                if (cc as any === CHAR_S_COLON) {
                    eat(CHAR_S_COLON);
                }
                addContent(createJsStatement("console.log" + e + ";", startPos), parent);
                break;
            case "$if":
                // e.g. $if (exp()) { ... } else if (exp2) { ... } else { ... }
                e = xjsJsParenStatementExpr("$if");
                let errPos = -1, jsb = createJsBlockStatement("if " + e + " {", startPos);
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
                        e = xjsJsParenStatementExpr("if");
                        jsb = createJsBlockStatement("else if " + e + " {", ps);
                    } else {
                        // else {
                        jsb = createJsBlockStatement("else {", ps);
                    }
                    eat(CHAR_CS);
                    addContent(jsb, parent);
                    xjsContent(jsb);
                    eat(CHAR_CE); // }
                }
                break;
            case "$fo":
                // e.g. $for (let i=0;10>i;i++) {
                e = xjsJsParenStatementExpr("$for");
                const fb = createJsBlockStatement("for " + e + " {", startPos);
                addContent(fb, parent);
                eat(CHAR_CS); // {
                xjsContent(fb);
                eat(CHAR_CE); // }
                break;
            case "$ea":
                // e.g. $each(items, (item, index, isLast) => {
                eatWord("$each");
                xjsSpaces();
                eat(CHAR_PARS); // (
                const e1 = jsExpression(false);
                eat(CHAR_COMMA); // ,
                xjsSpaces();
                const e2 = jsExpression(false, CHAR_PARS, CHAR_PARE);
                xjsSpaces();
                eatWord("=>");
                xjsSpaces();
                const eb = createJsBlockStatement("each(" + e1 + "," + e2 + " => {", startPos);
                eb.endCode = "});";
                addContent(eb, parent);
                eat(CHAR_CS); // {
                xjsContent(eb);
                eat(CHAR_CE); // }
                xjsSpaces();
                eat(CHAR_PARE); // )
                xjsSpaces();
                eat(CHAR_S_COLON); // ;
                break;
            case "$te":
                // $template function
                xjsTplFunction(parent, false);
                break;
            default:
                error("Invalid JS statement", pos);
        }
        return true;
    }

    function xjsJsSimpleStatementExpr(name: string): string {
        eatWord(name);
        xjsSpaces(true);
        const e = jsExpression(false, U, U, false, true);
        if (cc === CHAR_S_COLON) {
            eat(CHAR_S_COLON);
        }
        return e;
    }

    function xjsJsParenStatementExpr(name: string): string {
        eatWord(name);
        xjsSpaces();
        if (cc as any !== CHAR_PARS) {
            error("Invalid " + name + " statement", pos);
        }
        const e = jsExpression(false, CHAR_PARS, CHAR_PARE);
        xjsSpaces();
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

function createFragment(pos: number = -1): XjsFragment {
    return {
        kind: "#fragment",
        pos: pos
    }
}

function createElement(name: string, pos: number = -1): XjsElement {
    return {
        kind: "#element",
        name: name,
        pos: pos
    }
}

function createComponent(ref: XjsExpression, pos: number = -1): XjsComponent {
    return {
        kind: "#component",
        ref: ref,
        pos: pos
    }
}

function createParamNode(name: string, pos: number = -1): XjsParamNode {
    return {
        kind: "#paramNode",
        name: name,
        pos: pos
    }
}

function createDecoNode(ref: XjsExpression, pos: number = -1): XjsDecoratorNode {
    return {
        kind: "#decoratorNode",
        ref: ref,
        pos: pos
    }
}

function createText(textFragments: string[], pos: number = -1): XjsText {
    return {
        kind: "#textNode",
        pos: pos,
        textFragments: textFragments
    }
}

function createExpression(code: string, pos: number = -1): XjsExpression {
    return {
        kind: "#expression",
        oneTime: false,
        isBinding: false,
        code: code,
        pos: pos
    }
}

function createParam(name: string, pos: number = -1): XjsParam {
    return {
        kind: "#param",
        name: name,
        isOrphan: false,
        pos: pos
    }
}

function createProperty(name: string, value: XjsParamValue, pos: number = -1): XjsProperty {
    return {
        kind: "#property",
        name: name,
        value: value,
        pos: pos
    }
}

function createDecorator(ref: XjsExpression, pos: number = -1): XjsDecorator {
    return {
        kind: "#decorator",
        pos: pos,
        ref: ref,
        hasDefaultPropValue: false,
        isOrphan: false
    }
}

function createCData(pos: number = -1): XjsCData {
    return {
        kind: "#cdata",
        pos: pos,
        text: ""
    }
}

function createLabel(name: string, pos: number = -1): XjsLabel {
    return {
        kind: "#label",
        pos: pos,
        name: name,
        fwdLabel: false,
        isOrphan: false
    }
}

function createJsStatement(code: string, pos: number = -1): XjsJsStatement {
    return {
        kind: "#jsStatement",
        code: code,
        pos: pos
    }
}

function createJsBlockStatement(startCode: string, pos: number = -1): XjsJsBlock {
    return {
        kind: "#jsBlock",
        startCode: startCode,
        endCode: "}",
        pos: pos
    }
}