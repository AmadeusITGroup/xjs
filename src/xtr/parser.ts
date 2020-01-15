import { XtrFragment, createXtrFragment, XtrElement, addText, addElement, addComponent, addParamNode, XtrParam, addParam, addDecorator, addLabel, addFragment, addCData, XtrCData, XtrPreProcessorFactory, XtrParamHost, XtrPreProcessorCtxt, XtrPreProcessor, XtrParamDictionary } from './ast';

const U = undefined,
    CDATA = "cdata",
    CDATA_LENGTH = CDATA.length,
    CDATA_END = "</!cdata>",
    CDATA_END_LENGTH = CDATA_END.length,
    CHAR_BOS = -1,     // beginning of string
    CHAR_EOS = -2,     // end of string
    CHAR_NL = 10,      // \n new line
    CHAR_SPACE = 32,   // space
    CHAR_BANG = 33,    // !
    CHAR_DQUO = 34,    // "
    CHAR_HASH = 35,    // #
    CHAR_SQUO = 39,    // '
    CHAR_PARS = 40,    // (
    CHAR_PARE = 41,    // )
    CHAR_STAR = 42,    // *
    CHAR_PLUS = 43,    // +
    CHAR_MINUS = 45,   // -
    CHAR_DOT = 46,     // .
    CHAR_AT = 64,      // @
    CHAR_FSLA = 47,    // forward slash: /
    CHAR_BSLA = 92,    // back slash: \
    CHAR_SBRS = 91,    // [
    CHAR_SBRE = 93,    // ]
    CHAR_UNDER = 95,   // _
    CHAR_LT = 60,      // <
    CHAR_EQ = 61,      // =
    CHAR_GT = 62,      // >
    CHAR_CS = 123,     // {
    CHAR_CE = 125,     // }
    CHAR_n = 110,
    CHAR_t = 116,
    CHAR_r = 114,
    CHAR_u = 117,
    CHAR_e = 101,
    CHAR_f = 102,
    CHAR_a = 97,
    CHAR_l = 108,
    CHAR_s = 115,
    CHAR_NBSP = '\u00A0'.charCodeAt(0), // non breaking space
    ESCAPED_CHARS = {
        "33": CHAR_BANG,  // !!
        "47": CHAR_FSLA,  // !/
        "60": CHAR_LT,    // !<
        "110": CHAR_NL,   // !n
        "115": CHAR_NBSP  // !s
    },
    RX_TRAILING_SPACES = /[ \t\r\f\n]+$/;

export interface XtrPreProcessorDictionary {
    [name: string]: XtrPreProcessorFactory;
}

interface XtrPreProcessorData {
    kind: "#preprocessorData";
    name: string; // pre-processor name with @@ prefix
    pos: number;
    params?: XtrParam[];
    paramsDict?: { [name: string]: XtrParam };
}

export interface XtrParserContext {
    preProcessors?: XtrPreProcessorDictionary;
    fileId: string;                 // e.g. /Users/blaporte/Dev/iv/src/doc/samples.ts
    line1?: number;                 // line 1 position - used to calculate offset for error messages - default: 1
    col1?: number;                  // col 1 position - used to calculate offset for error messages - default: 1
    globalPreProcessors?: string[]; // e.g. ["@@json"]
}

// parse generates an XtrFragment (XTR tree)
export async function parse(xtr: string, context?: XtrParserContext): Promise<XtrFragment> {
    let xf = createXtrFragment(),
        posEOS = xtr.length,
        pos = 0,    // current position
        cc: number = CHAR_EOS,   // current char code at current position
        pcc: number = CHAR_BOS,  // previous cc
        ppContext: XtrPreProcessorCtxt | undefined,
        currentPpName = "",
        currentPpPos = 0,
        globalPreProcessors = context ? context.globalPreProcessors : U,
        ppFactories = context ? context.preProcessors || {} : {},
        preProcessors = {}; // dictionary of pre-processor instances
    if (posEOS > 0) {
        cc = xtr.charCodeAt(0);

        let ppDataList: XtrPreProcessorData[] | undefined;

        if (globalPreProcessors !== U) {
            ppDataList = [];
            for (let pp of globalPreProcessors) {
                ppDataList.push({
                    kind: "#preprocessorData",
                    name: pp, // e.g. "@@json"
                    pos: 0
                })
            }
            await callPreProcessors(ppDataList, xf, null, "setup", 1);
        }
        await xtrContent(xf);
        if (ppDataList !== U) {
            await callPreProcessors(ppDataList, xf, null, "process", 2);
        }

        if (cc !== CHAR_EOS) {
            error();
        }
    }
    return xf;

    function moveNext() {
        return shiftNext(1);
    }

    function shiftNext(length: number) {
        pos += length;
        pcc = cc; // pcc is used to manage escaped chars
        return cc = pos < posEOS ? xtr.charCodeAt(pos) : CHAR_EOS;
    }

    function nextCharCode() {
        return pos + 1 < posEOS ? xtr.charCodeAt(pos + 1) : CHAR_EOS;
    }

    function nextChars(length: number) {
        return pos + length < posEOS ? xtr.substr(pos, length) : "";
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

    async function xtrContent(parent: XtrFragment | XtrElement) {
        // parse xtr content: text or element or fragments or cdata
        let keepGoing = true;
        while (keepGoing) {
            if (!await xtrElement(parent) && !xtrText(parent)) {
                keepGoing = false;
            }
        }
    }

    function xtrText(parent: XtrFragment | XtrElement): boolean {
        // return true if blank spaces or text characters have been found
        if ((cc === CHAR_LT && pcc !== CHAR_BANG) || cc === CHAR_EOS) return false;
        let spacesFound = xtrSpaces(), startPos = pos;
        if (cc !== CHAR_LT && cc !== CHAR_EOS) {
            let charCodes: number[] = [];
            if (spacesFound) {
                charCodes[0] = CHAR_SPACE; // leading spaces are transformed in a single space
            }
            let lastIsSpace = spacesFound;
            while (cc !== CHAR_LT && cc !== CHAR_EOS) {
                eatComments();
                // capture string
                if (cc === CHAR_BANG) {
                    // escaped chars
                    const newPcc = pcc;
                    cc = eat(CHAR_BANG); // !
                    const escValue = ESCAPED_CHARS["" + cc];
                    if (escValue !== U) {
                        lastIsSpace = (cc === CHAR_s || cc === CHAR_n);
                        moveNext();
                        charCodes.push(escValue);
                        pcc = newPcc;
                    } else {
                        charCodes.push(CHAR_BANG);
                        lastIsSpace = false;
                    }
                } else {
                    if (lastIsSpace && isSpace(cc) && cc !== CHAR_NL) {
                        moveNext(); // keep only one space but keep new lines
                    } else {
                        lastIsSpace = isSpace(cc);
                        charCodes.push(cc);
                        moveNext();
                    }
                }
            }
            addText(parent, String.fromCharCode.apply(null, charCodes).replace(RX_TRAILING_SPACES, " "), startPos);
        }
        return true;
    }

    function xtrSpaces(): boolean {
        // eat spaces (white spaces or carriage return, tabs, etc.) 
        // return true if spaces have been found
        if (cc === CHAR_EOS) return false;
        let startPos = pos, processing = true;

        while (processing) {
            if (isSpace(cc)) {
                // white spaces
                moveNext();
                eatComments();
            } else if (!eatComments()) {
                processing = false;
            }
        }
        return pos !== startPos;
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

    async function xtrElement(parent: XtrFragment | XtrElement): Promise<boolean> {
        // return true if an element, a fragment or a cdata section has been found
        if (cc !== CHAR_LT || nextCharCode() === CHAR_FSLA) return false;
        cc = eat(CHAR_LT); // <
        // prefix: [none] or * or . or @
        let prefix = 0;
        eatPrefix();
        let name = "", eltOrFragment: XtrElement | XtrFragment;
        if (cc === CHAR_BANG) {
            eat(CHAR_BANG);
            if (await xtrCData(parent)) {
                return true;
            }
            eltOrFragment = addFragment(parent, pos);
        } else {
            name = xtrIdentifier(true, prefix === 0);
            eltOrFragment = createElement();
        }

        let ppDataList: XtrPreProcessorData[] | null = null;

        if (xtrSpaces()) {
            // spaces have been found: parse params
            ppDataList = await xtrParams(eltOrFragment, parent, endParamReached);
            if (ppDataList !== null) {
                await callPreProcessors(ppDataList, eltOrFragment, parent, "setup", 3);
            }
        }
        if (cc === CHAR_FSLA) {
            // end of element
            eat(CHAR_FSLA); // /
            eat(CHAR_GT); // >
        } else if (cc === CHAR_GT) {
            eat(CHAR_GT); // >
            // parse element content
            await xtrContent(eltOrFragment);
            // parse end of element
            eat(CHAR_LT); // <
            eat(CHAR_FSLA); // /
            let endPos = pos;
            let p1 = prefix, p2 = eatPrefix(), name2 = xtrIdentifier(false);
            if (name2 === "" && p2 === 0 && CHAR_BANG === cc as any) {
                eat(CHAR_BANG); // end of fragment !
            } else if (name2 !== "" || p2 !== 0) {
                // end tag name is provided
                if (p1 !== p2 || (name2 !== "" && name2 !== name)) {
                    error('End tag </' + eltName(p2, name2) + '> doesn\'t match <' + eltName(p1, name) + '>', endPos);
                }
            }
            xtrSpaces();
            eat(CHAR_GT); // >
        } else {
            error();
        }

        if (ppDataList !== null) {
            await callPreProcessors(ppDataList, eltOrFragment, parent, "process", 4);
        }

        return true;

        function eatPrefix() {
            if (cc === CHAR_STAR || cc === CHAR_DOT || cc === CHAR_AT) { // * . @
                prefix = cc;
                cc = moveNext(); // eat prefix
                return prefix;
            }
            return 0;
        }

        function createElement(): XtrElement {
            if (prefix === CHAR_STAR) { // *
                return addComponent(parent, xf.ref(name), pos);
            } else if (prefix === CHAR_DOT) { // .
                return addParamNode(parent, name, pos);
            } else if (prefix === CHAR_AT) { // @
                // decorator node
                error("Decorator node are not supported yet");
            }
            return addElement(parent, name, pos);
        }

        function eltName(prefix: number, nm: string) {
            return (prefix === 0 ? "" : String.fromCharCode(prefix)) + nm;
        }
    }

    async function callPreProcessors(ppDataList: XtrPreProcessorData[], target: XtrParamHost, parent: XtrParamHost | null, hookName: "setup" | "process", src: number) {
        // console.log("callPreProcessors", src, ppDataList);
        for (let ppData of ppDataList) {
            if (ppFactories === U || ppFactories[ppData.name] === U) {
                error("Undefined pre-processor '" + ppData.name + "'", ppData.pos);
                return;
            }
            let pp: XtrPreProcessor = preProcessors[ppData.name];
            if (pp === U) {
                pp = preProcessors[ppData.name] = ppFactories[ppData.name]() as any;
            }

            if (pp[hookName] === U) continue;

            if (ppData.paramsDict === U) {
                let ppParams: XtrParamDictionary = {};
                if (ppData.params) {
                    for (let p of ppData.params) {
                        ppParams[p.name] = p;
                    }
                }
                ppData.paramsDict = ppParams;
            }

            try {
                await pp[hookName]!(target, ppData.paramsDict, getPreProcessorContext(ppData.name, parent, ppData.pos));
            } catch (ex) {
                let msg = ex.message || ex;
                if (msg.match(/^XTR\:/)) {
                    // error was triggered through context.error()
                    throw ex;
                } else {
                    error("Error in " + ppData.name + " " + hookName + "() execution: " + msg, ppData.pos);
                }
            }
        }
    }

    function getPreProcessorContext(ppName: string, parent: XtrParamHost | null, processorPos: number) {
        currentPpName = ppName;
        currentPpPos = processorPos;
        if (ppContext === U) {
            ppContext = {
                parent: parent,
                fileId: context ? context.fileId || "" : "",
                rootFragment: xf,
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

    function endParamReached() {
        return (cc === CHAR_FSLA || cc === CHAR_GT); // / or >
    }

    async function xtrCData(parent: XtrFragment | XtrElement): Promise<boolean> {
        if (CDATA === nextChars(CDATA_LENGTH)) {
            let startPos = pos;
            shiftNext(CDATA_LENGTH);
            let cdata = addCData(parent, "", pos), ppDataList: XtrPreProcessorData[] | null = null;
            if (xtrSpaces()) {
                // spaces have been found: parse params
                ppDataList = await xtrParams(cdata, parent, endParamReached);
                if (ppDataList !== null) {
                    await callPreProcessors(ppDataList, cdata, parent, "setup", 5);
                }
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
                        shiftNext(CDATA_END_LENGTH);
                        processing = false;
                    } else {
                        charCodes.push(cc);
                        moveNext();
                    }
                }
            }
            cdata.content = String.fromCharCode.apply(null, charCodes);

            if (ppDataList !== null) {
                await callPreProcessors(ppDataList, cdata, parent, "process", 6);
            }
            return true;
        }
        return false;
    }

    function xtrIdentifier(mandatory: boolean, acceptDashes = false): string {
        // identifier is used for references and component/decorators names (which area also references)
        // they cannot start with $ on the contrary to JS identifiers
        let charCodes: number[] = [];
        // first char cannot be a number
        if (ccIsChar() || cc === CHAR_UNDER) {
            charCodes.push(cc);
            moveNext();
            while (ccIsChar() || ccIsNumber() || cc === CHAR_UNDER || (acceptDashes && cc === CHAR_MINUS)) {
                charCodes.push(cc);
                moveNext();
            }
        } else if (mandatory) {
            error("Invalid XTR identifier");
        }
        if (charCodes.length === 0) return "";
        return String.fromCharCode.apply(null, charCodes);
    }

    async function xtrParams(parent: XtrParamHost | XtrPreProcessorData, grandParent: XtrParamHost | XtrPreProcessorData, endReached: () => boolean): Promise<XtrPreProcessorData[] | null> {
        let prefix = 0, keepGoing = true, result: XtrPreProcessorData[] | null = null, startPos = -1;
        while (keepGoing && !endReached()) {
            // param name: prefix + name
            startPos = pos;
            prefix = eatPrefix();
            let ppData: XtrPreProcessorData | null = null;
            if (prefix === CHAR_AT && cc === CHAR_AT) {
                // this is a pre-processor
                eat(CHAR_AT); // 2nd @

                if (parent.kind === "#preprocessorData") {
                    let errorPos = pos - 2;
                    error("Pre-processors cannot be used on pre-processors: check @@" + xtrIdentifier(true, false), errorPos);
                }

                ppData = {
                    kind: "#preprocessorData",
                    name: "",
                    pos: pos - 2 // to be before the '@@' prefix
                }
            }
            let name = xtrIdentifier(true, prefix === 0), isProperty = false;
            if (prefix === CHAR_SBRS) { // [
                eat(CHAR_SBRE); // ]
                isProperty = true;
            }
            if (ppData !== null) {
                ppData.name = "@@" + name;
            }
            if (prefix === CHAR_HASH && parent.kind === "#preprocessorData") {
                error("Labels cannot be used on pre-processors", parent.pos);
            }

            let spacesFound = xtrSpaces();
            if (cc === CHAR_EQ) {
                // look for value
                eat(CHAR_EQ);
                xtrSpaces();
                if (ppData !== null) {
                    registerParam("value", ppData, xtrParamValue());
                } else {
                    registerParam(name, ppData, xtrParamValue(), isProperty);
                }
                if (!xtrSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
            } else if (prefix === CHAR_AT && cc === CHAR_PARS) {
                let d: XtrParamHost;
                if (ppData !== null) {
                    d = ppData as any;
                } else {
                    d = registerParam(name, ppData);
                }
                // look for attribute params for decorators
                eat(CHAR_PARS); // ( parens start
                xtrSpaces();

                let r = await xtrParams(d, parent, endDecoParamReached);
                eat(CHAR_PARE); // ) parens end

                if (!xtrSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
                if (r != null && ppData === null) {
                    await callPreProcessors(r, d, grandParent as any, "process", 7);
                }
            } else if (spacesFound || cc === CHAR_GT || cc === CHAR_FSLA || cc === CHAR_PARE) { // > or / or )
                // orphan attribute
                if (ppData === null) {
                    registerParam(name, ppData);
                }
            } else {
                keepGoing = false;
            }
            if (ppData !== null) {
                if (result === null) {
                    result = [];
                }
                result.push(ppData);
            }
        }
        if (!endReached()) {
            error();
        }

        return result;

        function endDecoParamReached() {
            return (cc === CHAR_PARE); // )
        }

        function registerParam(name: string, ppData: XtrPreProcessorData | null, value?: any, isProperty: boolean = false) {
            let p = parent as any;
            if (ppData !== null) {
                p = ppData as any;
            }
            if (prefix === CHAR_AT) {
                return addDecorator(p, xf.ref(name), value, startPos);
            } else if (prefix === CHAR_HASH) {
                // todo error if ppData
                return addLabel(p, name, value, startPos);
            }
            return addParam(p, name, value, isProperty, startPos);
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

    function xtrParamValue() {
        // return the param value
        if (cc === CHAR_SQUO) {
            return stringContent(CHAR_SQUO); // single quote string
        } else if (cc === CHAR_DQUO) {
            return stringContent(CHAR_DQUO); // double quote string
        } else if (cc === CHAR_CS) { // {
            // reference
            eat(CHAR_CS);
            xtrSpaces();
            let refName = xtrIdentifier(true, false);
            xtrSpaces();
            eat(CHAR_CE);
            return xf.ref(refName);
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
                xtrSpaces();
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
        error("Invalid parameter value: " + charName(cc));
        return 0;
    }

    function error(msg?: string, errorPos?: number) {
        let lines = xtr.split("\n"), lineLen = 0, posCount = 0, idx = 0, lineNbr = lines.length, columnNbr = lines[lineNbr - 1].length;
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
            msg = "Invalid character: " + charName(cc);
        }
        throw "XTR: " + msg + "\nLine " + lineNbrMsg + " / Col " + columnNbr + fileInfo + "\nExtract: >> " + lines[lineNbr - 1].trim() + " <<";
    }

    function charName(c: number) {
        if (c === CHAR_EOS) return "End of Content";
        return "'" + String.fromCharCode(c) + "'";
    }

    function stringContent(delimiter: number): string {
        let charCodes: number[] = [];
        eat(delimiter);
        while (cc !== delimiter && cc !== CHAR_EOS) {
            if (cc === CHAR_BSLA) { // \
                moveNext();
            }
            charCodes.push(cc);
            moveNext();
        }
        eat(delimiter);
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
}