import { XdfFragment, createXdfFragment, XdfElement, addText, addElement, addComponent, addParamNode, XdfParam, addParam, addDecorator, addLabel, addFragment, addCData, XdfCData, XdfPreProcessor, XdfParamHost, XdfPreProcessorCtxt } from './ast';

const CDATA = "cdata",
    CDATA_LENGTH = CDATA.length,
    CDATA_END = "</!cdata>",
    CDATA_END_LENGTH = CDATA_END.length,
    CHAR_EOS = -1, // end of string
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
    RX_TRAILING_SPACES = /[ \t\r\f\n]+$/;

interface XdfPreProcessorDictionary {
    [name: string]: XdfPreProcessor;
}

interface XdfPreProcessorData {
    kind: "#preprocessorData";
    name: string; // pre-processor name with @@ prefix
    pos: number;
    params?: XdfParam[];
}

export interface XdfParserContext {
    preProcessors?: XdfPreProcessorDictionary;
    fileName?: string;
    filePath?: string;
}

// parse generates an XdfFragment (XDF tree)
export function parse(xdf: string, context?: XdfParserContext): XdfFragment {
    let xf = createXdfFragment(),
        posEOS = xdf.length,
        pos = 0,    // current position
        cc: number = CHAR_EOS,   // current char code at current position
        ppContext: XdfPreProcessorCtxt | undefined,
        currentPpName = "",
        currentPpPos = 0,
        preProcessors = context ? context.preProcessors || {} : {};
    if (posEOS > 0) {
        cc = xdf.charCodeAt(0);
        xdfContent(xf);
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
        return cc = pos < posEOS ? xdf.charCodeAt(pos) : CHAR_EOS;
    }

    function nextCharCode() {
        return pos + 1 < posEOS ? xdf.charCodeAt(pos + 1) : CHAR_EOS;
    }

    function nextChars(length: number) {
        return pos + length < posEOS ? xdf.substr(pos, length) : "";
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

    function xdfContent(parent: XdfFragment | XdfElement) {
        // parse xdf content: text or element or fragments or cdata
        let keepGoing = true;
        while (keepGoing) {
            if (!xdfElement(parent) && !xdfText(parent)) {
                keepGoing = false;
            }
        }
    }

    function xdfText(parent: XdfFragment | XdfElement): boolean {
        // return true if blank spaces or text characters have been found
        if (cc === CHAR_LT || cc === CHAR_EOS) return false;
        let spacesFound = xdfSpaces();
        if (cc !== CHAR_LT && cc !== CHAR_EOS) {
            let charCodes: number[] = [];
            if (spacesFound) {
                charCodes[0] = CHAR_SPACE; // leading spaces are transformed in a single space
            }
            while (cc !== CHAR_LT && cc !== CHAR_EOS) {
                // capture string
                if (cc === CHAR_BSLA) {
                    cc = eat(CHAR_BSLA); // \
                    if (cc === CHAR_SPACE || cc === CHAR_s) {
                        // transform into non-breaking space
                        moveNext();
                        charCodes.push(CHAR_NBSP);
                    } else if (cc == CHAR_n) {
                        // \n new line
                        moveNext();
                        charCodes.push(CHAR_NL);
                    }
                } else {
                    charCodes.push(cc);
                    moveNext();
                }
            }
            addText(parent, String.fromCharCode.apply(null, charCodes).replace(RX_TRAILING_SPACES, " "));
        }
        return true;
    }

    function xdfSpaces(): boolean {
        // eat spaces (white spaces or carriage return, tabs, etc.) 
        // return true if spaces have been found
        if (cc === CHAR_EOS) return false;
        let startPos = pos;

        // CHAR_BACK = 8,   // \b backspace
        // CHAR_TAB = 9,    // \t tab
        // CHAR_NL = 10,    // \n new line
        // CHAR_VTAB = 11,  // \v vertical tab
        // CHAR_FEED = 12,  // \f form feed
        // CHAR_CR = 13,    // \r carriage return
        while (cc === CHAR_SPACE || (cc > 7 && cc < 14)) {
            // white spaces
            moveNext();
        }
        return pos !== startPos;
    }

    function xdfElement(parent: XdfFragment | XdfElement): boolean {
        // return true if an element, a fragment or a cdata section has been found
        if (cc !== CHAR_LT || nextCharCode() === CHAR_FSLA) return false;
        cc = eat(CHAR_LT); // <
        // prefix: [none] or * or . or @
        let prefix = 0;
        eatPrefix();
        let name = "", eltOrFragment: XdfElement | XdfFragment;
        if (cc === CHAR_BANG) {
            eat(CHAR_BANG);
            if (xdfCData(parent)) {
                return true;
            }
            eltOrFragment = addFragment(parent);
        } else {
            name = xdfIdentifier(true, prefix === 0);
            eltOrFragment = createElement();
        }

        let ppDataList: XdfPreProcessorData[] | null = null;

        if (xdfSpaces()) {
            // spaces have been found: parse params
            ppDataList = xdfParams(eltOrFragment, parent, endParamReached);
        }
        if (cc === CHAR_FSLA) {
            // end of element
            eat(CHAR_FSLA); // /
            eat(CHAR_GT); // >
        } else if (cc === CHAR_GT) {
            eat(CHAR_GT); // >
            // parse element content
            xdfContent(eltOrFragment);
            // parse end of element
            eat(CHAR_LT); // <
            eat(CHAR_FSLA); // /
            let endPos = pos;
            let p1 = prefix, p2 = eatPrefix(), name2 = xdfIdentifier(false);
            if (name2 !== "" || p2 !== 0) {
                // end tag name is provided
                if (p1 !== p2 || (name2 !== "" && name2 !== name)) {
                    error('End tag </' + eltName(p2, name2) + '> doesn\'t match <' + eltName(p1, name) + '>', endPos);
                }
            }
            xdfSpaces();
            eat(CHAR_GT); // >
        } else {
            error();
        }

        if (ppDataList !== null) {
            callPreProcessors(ppDataList, eltOrFragment, parent);
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

        function createElement(): XdfElement {
            if (prefix === CHAR_STAR) { // *
                return addComponent(parent, xf.ref(name));
            } else if (prefix === CHAR_DOT) { // .
                return addParamNode(parent, name);
            } else if (prefix === CHAR_AT) { // @
                // decorator node
                error("Decorator node are not supported yet");
            }
            return addElement(parent, name);
        }

        function eltName(prefix: number, nm: string) {
            return (prefix === 0 ? "" : String.fromCharCode(prefix)) + nm;
        }
    }

    function callPreProcessors(ppDataList: XdfPreProcessorData[], target: XdfParamHost, parent: XdfParamHost) {
        for (let ppData of ppDataList) {
            if (preProcessors === undefined || preProcessors[ppData.name] === undefined) {
                error("Undefined pre-processor '" + ppData.name + "'", ppData.pos);
                return;
            }
            let pp = preProcessors[ppData.name];
            try {
                pp(target, ppData.params || [], getPreProcessorContext(ppData.name, parent, ppData.pos));
            } catch (ex) {
                let msg = ex.message || ex;
                if (msg.match(/^XDF\:/)) {
                    // error was triggered through context.error()
                    throw ex;
                } else {
                    error("Error in " + ppData.name + " execution: " + msg, ppData.pos);
                }
            }

        }
    }

    function getPreProcessorContext(ppName: string, parent: XdfParamHost, processorPos: number) {
        currentPpName = ppName;
        currentPpPos = processorPos;
        if (ppContext === undefined) {
            ppContext = {
                parent: parent,
                fileName: context ? context.fileName || "" : "",
                filePath: context ? context.filePath || "" : "",
                rootFragment: xf,
                error: function (msg: string) {
                    error(currentPpName + ": " + msg, currentPpPos);
                },
                preProcessors: preProcessors
            }
        } else {
            ppContext.parent = parent;
        }
        return ppContext;
    }

    function endParamReached() {
        return (cc === CHAR_FSLA || cc === CHAR_GT); // / or >
    }

    function xdfCData(parent: XdfFragment | XdfElement): boolean {
        if (CDATA === nextChars(CDATA_LENGTH)) {
            let startPos = pos;
            shiftNext(CDATA_LENGTH);
            let cdata = addCData(parent, ""), ppDataList: XdfPreProcessorData[] | null = null;
            if (xdfSpaces()) {
                // spaces have been found: parse params
                ppDataList = xdfParams(cdata, parent, endParamReached);
            }
            eat(CHAR_GT); // >

            let charCodes: number[] = [], processing = true;

            while (processing) {
                if (cc === CHAR_EOS) {
                    processing = false;
                    error("Invalid cdata section: end marker '</!cdata>' not found", startPos - 2)
                } else if (cc === CHAR_BSLA) {
                    // backslash
                    moveNext();
                    if (CDATA_END === nextChars(CDATA_END_LENGTH)) {
                        // we escape end of cdata
                        charCodes.push(cc);
                        moveNext();
                    } else {
                        // push the backslash
                        charCodes.push(CHAR_BSLA);
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
                callPreProcessors(ppDataList, cdata, parent);
            }
            return true;
        }
        return false;
    }

    function xdfIdentifier(mandatory: boolean, acceptDashes = false): string {
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
            error("Invalid XDF identifier");
        }
        if (charCodes.length === 0) return "";
        return String.fromCharCode.apply(null, charCodes);
    }

    function xdfParams(parent: XdfParamHost | XdfPreProcessorData, grandParent: XdfParamHost | XdfPreProcessorData, endReached: () => boolean): XdfPreProcessorData[] | null {
        let prefix = 0, keepGoing = true, result: XdfPreProcessorData[] | null = null;
        while (keepGoing && !endReached()) {
            // param name: prefix + name
            prefix = eatPrefix();
            let ppData: XdfPreProcessorData | null = null;
            if (prefix === CHAR_AT && cc === CHAR_AT) {
                // this is a pre-processor
                eat(CHAR_AT); // 2nd @

                if (parent.kind === "#preprocessorData") {
                    let errorPos = pos - 2;
                    error("Pre-processors cannot be used on pre-processors: check @@" + xdfIdentifier(true, false), errorPos);
                }

                ppData = {
                    kind: "#preprocessorData",
                    name: "",
                    pos: pos - 2 // to be before the '@@' prefix
                }
            }
            let name = xdfIdentifier(true, prefix === 0), isProperty = false;
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

            let spacesFound = xdfSpaces();
            if (cc === CHAR_EQ) {
                // look for value
                eat(CHAR_EQ);
                xdfSpaces();
                if (ppData !== null) {
                    registerParam("value", ppData, xdfParamValue());
                } else {
                    registerParam(name, ppData, xdfParamValue(), isProperty);
                }
                if (!xdfSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
            } else if (prefix === CHAR_AT && cc === CHAR_PARS) {
                let d: XdfParamHost;
                if (ppData !== null) {
                    d = ppData as any;
                } else {
                    d = registerParam(name, ppData);
                }
                // look for attribute params for decorators
                eat(CHAR_PARS); // ( parens start
                xdfSpaces();

                let r = xdfParams(d, parent, endDecoParamReached);
                eat(CHAR_PARE); // ) parens end

                if (!xdfSpaces()) {
                    // no spaces found -> we have reached the end of the param list
                    keepGoing = false;
                }
                if (r != null && ppData === null) {
                    callPreProcessors(r, d, grandParent as any);
                }
            } else if (spacesFound) {
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

        function registerParam(name: string, ppData: XdfPreProcessorData | null, value?: any, isProperty: boolean = false) {
            let p = parent as any;
            if (ppData !== null) {
                p = ppData as any;
            }
            if (prefix === CHAR_AT) {
                return addDecorator(p, xf.ref(name), value);
            } else if (prefix === CHAR_HASH) {
                // todo error if ppData
                return addLabel(p, name, value);
            }
            return addParam(p, name, value, isProperty);
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

    function xdfParamValue() {
        // return the param value
        if (cc === CHAR_SQUO) {
            return stringContent(CHAR_SQUO); // single quote string
        } else if (cc === CHAR_DQUO) {
            return stringContent(CHAR_DQUO); // double quote string
        } else if (cc === CHAR_CS) { // {
            // reference
            eat(CHAR_CS);
            xdfSpaces();
            let refName = xdfIdentifier(true, false);
            xdfSpaces();
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
                xdfSpaces();
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
        let lines = xdf.split("\n"), lineLen = 0, posCount = 0, idx = 0, lineNbr = lines.length, columnNbr = lines[lineNbr - 1].length;
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

        if (msg === undefined) {
            msg = "Invalid character: " + charName(cc);
        }
        throw "XDF: " + msg + "\nLine " + lineNbr + " / Col " + columnNbr + "\nExtract: >> " + lines[lineNbr - 1].trim() + " <<";
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